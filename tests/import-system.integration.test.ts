import { Buffer } from "node:buffer";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { Pool } from "pg";
import { createDb, type OpenVitalsDatabase } from "../packages/database/src/client";
import {
  appUsers,
  auditEvents,
  authUsers,
  importJobs,
  jobQueue,
  observations,
  outboxEvents,
  sourceDocuments,
  sourceRecords
} from "../packages/database/src/schema";
import { createLocalObjectStore } from "../packages/ingestion/src/objectStore";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl && process.env.CI) {
  throw new Error("TEST_DATABASE_URL or DATABASE_URL is required for import system integration tests in CI.");
}

const describeWithDatabase = databaseUrl ? describe.sequential : describe.skip;

let pool: Pool;
let db: OpenVitalsDatabase;
let objectStorageRoot: string;

const tableNames = [
  "audit_events",
  "outbox_events",
  "review_tasks",
  "record_revisions",
  "provenance",
  "observations",
  "conditions",
  "medications",
  "encounters",
  "source_records",
  "file_classifications",
  "import_status_history",
  "import_jobs",
  "source_documents",
  "blob_objects",
  "share_policy_scopes",
  "share_policies",
  "intake_answers",
  "intake_workflows",
  "integrations",
  "integration_webhook_events",
  "user_profiles",
  "job_queue",
  "app_users",
  "auth_accounts",
  "auth_sessions",
  "auth_verifications",
  "auth_users"
];

async function truncateAllTables(): Promise<void> {
  await pool.query(`truncate table ${tableNames.join(", ")} restart identity cascade`);
}

async function createOwner() {
  await db.insert(authUsers).values({
    id: "auth-import-v1-owner",
    name: "Import V1 Owner",
    email: "import-v1-owner@example.test",
    emailVerified: true
  });

  const { createOwnerContextForAuthUser } = await import("../apps/web/src/server/ownership");
  return createOwnerContextForAuthUser(
    {
      id: "auth-import-v1-owner",
      email: "import-v1-owner@example.test",
      name: "Import V1 Owner"
    },
    db
  );
}

describeWithDatabase("import system v1 integration", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
    process.env.BETTER_AUTH_SECRET ??= "test-better-auth-secret-with-enough-entropy-for-openvitals";

    pool = new Pool({ connectionString: databaseUrl, max: 1 });
    db = createDb(pool);
    objectStorageRoot = await mkdtemp(join(tmpdir(), "openvitals-import-v1-"));
    await pool.query("select 1");
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await pool?.end();
    if (objectStorageRoot) {
      await rm(objectStorageRoot, { recursive: true, force: true });
    }
  });

  it("parses multipart uploads and records the initial visible status", async () => {
    const owner = await createOwner();
    const { createImport, getImportDetail, listImports, parseMultipartImportRequest } = await import("../apps/web/src/server/imports");
    const formData = new FormData();
    formData.set(
      "file",
      new File([Buffer.from("test_name,value,unit\nHemoglobin,13.2,g/dL\n")], "labs.csv", { type: "text/csv" })
    );
    formData.set("idempotencyKey", "import-v1:multipart-labs");

    const upload = await parseMultipartImportRequest(
      new Request("http://localhost:3000/api/imports", {
        method: "POST",
        body: formData
      })
    );

    const result = await createImport(db, {
      owner,
      ...upload,
      objectStorageRoot
    });

    const detail = await getImportDetail(db, { owner, importJobId: result.importJobId });
    expect(detail?.history.map((entry) => entry.toStatus)).toEqual(["uploaded"]);
    expect(detail?.history[0]?.reason).toBe("file_uploaded");
    expect(detail?.sourceDocument.fileName).toBe("labs.csv");
    expect(detail?.sourceDocument.mimeType).toBe("text/csv");

    const imports = await listImports(db, { owner, status: "uploaded" });
    expect(imports).toHaveLength(1);
    expect(imports[0]?.queueJob?.status).toBe("available");
  });

  it.each([
    {
      fileName: "lab-report.pdf",
      mimeType: "application/pdf",
      bytes: Buffer.from("%PDF-1.4\nplaceholder"),
      selectedParser: "openvitals.pdf_review_placeholder",
      reason: "pdf_requires_review"
    },
    {
      fileName: "lab-photo.png",
      mimeType: "image/png",
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
      selectedParser: "openvitals.image_review_placeholder",
      reason: "image_requires_review"
    }
  ])("creates review-needed placeholders for $mimeType imports", async (file) => {
    const owner = await createOwner();
    const { createImport, getImportDetail } = await import("../apps/web/src/server/imports");
    const { processImportJob } = await import("../packages/ingestion/src/importPipeline");

    const created = await createImport(db, {
      owner,
      fileName: file.fileName,
      mimeType: file.mimeType,
      content: file.bytes,
      idempotencyKey: `import-v1:${file.fileName}`,
      objectStorageRoot
    });

    const result = await processImportJob({
      db,
      importJobId: created.importJobId,
      objectStore: createLocalObjectStore(objectStorageRoot),
      workerId: "worker-import-v1"
    });

    expect(result).toMatchObject({
      status: "needs_review",
      sourceRecordCount: 1,
      canonicalRecordCount: 0,
      reviewTaskCount: 1
    });

    const detail = await getImportDetail(db, { owner, importJobId: created.importJobId });
    expect(detail?.history.map((entry) => entry.toStatus)).toEqual([
      "uploaded",
      "classified",
      "parsed",
      "normalized",
      "needs_review"
    ]);
    expect(detail?.sourceDocument.status).toBe("needs_review");
    expect(detail?.sourceRecords[0]?.recordType).toBe("unsupported");
    expect(detail?.reviewTasks[0]?.reason).toBe(file.reason);

    const selected = detail?.classifications.find((classification) => classification.selected);
    expect(selected?.parserName).toBe(file.selectedParser);
    expect(selected?.decision).toBe("review_needed");
    expect(detail?.classifications.every((classification) => classification.decision !== "error")).toBe(true);
  });

  it("stores explicit unsupported parser decisions and keeps unsupported files in review", async () => {
    const owner = await createOwner();
    const { createImport, getImportDetail } = await import("../apps/web/src/server/imports");
    const { processImportJob } = await import("../packages/ingestion/src/importPipeline");

    const created = await createImport(db, {
      owner,
      fileName: "notes.txt",
      mimeType: "text/plain",
      content: Buffer.from("Plain notes are not a supported health import format yet."),
      idempotencyKey: "import-v1:unsupported-text",
      objectStorageRoot
    });

    const result = await processImportJob({
      db,
      importJobId: created.importJobId,
      objectStore: createLocalObjectStore(objectStorageRoot),
      workerId: "worker-import-v1"
    });

    expect(result).toEqual({
      status: "needs_review",
      sourceRecordCount: 0,
      canonicalRecordCount: 0,
      reviewTaskCount: 1
    });

    const detail = await getImportDetail(db, { owner, importJobId: created.importJobId });
    expect(detail?.sourceDocument.classification).toBe("unsupported");
    expect(detail?.history.map((entry) => entry.toStatus)).toEqual(["uploaded", "needs_review"]);
    expect(detail?.reviewTasks[0]?.reason).toBe("unsupported_format");
    expect(detail?.classifications).toHaveLength(3);
    expect(detail?.classifications.every((classification) => classification.decision === "unsupported")).toBe(true);

    const outbox = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.aggregateId, detail!.sourceDocument.id));
    expect(outbox.find((event) => event.eventType === "review_task.created")).toBeDefined();

    const audit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.resourceId, detail!.reviewTasks[0]!.id));
    expect(audit.find((event) => event.action === "review_task.created")).toBeDefined();
  });

  it("surfaces and requeues failed or dead-lettered import jobs", async () => {
    const owner = await createOwner();
    const { createImport, getImportDetail, retryImport } = await import("../apps/web/src/server/imports");
    const created = await createImport(db, {
      owner,
      fileName: "retry.csv",
      mimeType: "text/csv",
      content: Buffer.from("test_name,value,unit\nHemoglobin,13.2,g/dL\n"),
      idempotencyKey: "import-v1:retry",
      objectStorageRoot
    });

    await db
      .update(importJobs)
      .set({
        status: "failed",
        errorCode: "parser_crashed",
        errorMessage: "Parser crashed in a retry test.",
        completedAt: new Date()
      })
      .where(eq(importJobs.id, created.importJobId));

    await db
      .update(sourceDocuments)
      .set({
        status: "failed",
        classification: "lab_csv",
        parserName: "openvitals.lab_csv",
        parserVersion: "0.1.0",
        completedAt: new Date()
      })
      .where(eq(sourceDocuments.id, created.sourceDocumentId));

    await db
      .update(jobQueue)
      .set({
        status: "dead_letter",
        attempts: 5,
        lastError: "Parser crashed in a retry test.",
        deadLetterReason: "Parser crashed in a retry test."
      })
      .where(eq(jobQueue.idempotencyKey, `job:import.health_data:${created.importJobId}`));

    const failedDetail = await getImportDetail(db, { owner, importJobId: created.importJobId });
    expect(failedDetail?.queueJob?.status).toBe("dead_letter");
    expect(failedDetail?.importJob.status).toBe("failed");

    const retried = await retryImport(db, {
      owner,
      importJobId: created.importJobId
    });

    expect(retried?.importJob.status).toBe("uploaded");
    expect(retried?.importJob.errorCode).toBeNull();
    expect(retried?.sourceDocument.classification).toBeNull();
    expect(retried?.queueJob?.status).toBe("available");
    expect(retried?.queueJob?.attempts).toBe(0);
    expect(retried?.queueJob?.deadLetterReason).toBeNull();
    expect(retried?.history.at(-1)?.reason).toBe("manual_retry");

    const [appUser] = await db.select().from(appUsers).where(eq(appUsers.id, owner.ownerUserId)).limit(1);
    expect(appUser?.externalAuthId).toBe("auth-import-v1-owner");
  });

  it("returns the existing import when the same content is uploaded twice", async () => {
    const owner = await createOwner();
    const { createImport } = await import("../apps/web/src/server/imports");

    const first = await createImport(db, {
      owner,
      fileName: "labs.csv",
      mimeType: "text/csv",
      content: Buffer.from("test_name,value,unit\nHemoglobin,13.2,g/dL\n"),
      objectStorageRoot
    });
    expect(first.status).toBe("uploaded");

    const second = await createImport(db, {
      owner,
      fileName: "labs.csv",
      mimeType: "text/csv",
      content: Buffer.from("test_name,value,unit\nHemoglobin,13.2,g/dL\n"),
      objectStorageRoot
    });

    expect(second.status).toBe("deduplicated");
    expect(second.importJobId).toBe(first.importJobId);
    expect(second.sourceDocumentId).toBe(first.sourceDocumentId);
    expect(second.objectKey).toBe(first.objectKey);

    const jobs = await db
      .select()
      .from(importJobs)
      .where(eq(importJobs.ownerUserId, owner.ownerUserId));
    expect(jobs).toHaveLength(1);
  });

  it("retains and supersedes prior pipeline output before requeueing a retried import", async () => {
    const owner = await createOwner();
    const { createImport, getImportDetail, retryImport } = await import("../apps/web/src/server/imports");
    const { processImportJob } = await import("../packages/ingestion/src/importPipeline");

    const created = await createImport(db, {
      owner,
      fileName: "labs-needs-review.pdf",
      mimeType: "application/pdf",
      content: Buffer.from("%PDF-1.4\nplaceholder"),
      idempotencyKey: "import-v1:retry-cleanup",
      objectStorageRoot
    });

    await processImportJob({
      db,
      importJobId: created.importJobId,
      objectStore: createLocalObjectStore(objectStorageRoot),
      workerId: "worker-import-v1"
    });

    const beforeRetry = await getImportDetail(db, { owner, importJobId: created.importJobId });
    expect(beforeRetry?.classifications.length).toBeGreaterThan(0);
    expect(beforeRetry?.sourceRecords.length).toBeGreaterThan(0);
    expect(beforeRetry?.reviewTasks.length).toBeGreaterThan(0);
    const originalSourceRecordIds = beforeRetry?.sourceRecords.map((record) => record.id) ?? [];
    const originalReviewTaskIds = beforeRetry?.reviewTasks.map((task) => task.id) ?? [];

    await db
      .update(importJobs)
      .set({ status: "failed", errorCode: "synthetic", completedAt: new Date() })
      .where(eq(importJobs.id, created.importJobId));

    await retryImport(db, { owner, importJobId: created.importJobId });

    const afterRetry = await getImportDetail(db, { owner, importJobId: created.importJobId });
    expect(afterRetry?.classifications).toHaveLength(beforeRetry?.classifications.length ?? 0);
    expect(afterRetry?.sourceRecords.map((record) => record.id)).toEqual(originalSourceRecordIds);
    expect(afterRetry?.sourceRecords.every((record) => record.reviewState === "ignored")).toBe(true);
    expect(afterRetry?.reviewTasks.map((task) => task.id)).toEqual(originalReviewTaskIds);
    expect(afterRetry?.reviewTasks.every((task) => task.status === "dismissed")).toBe(true);
    expect(afterRetry?.classifications.every((classification) => classification.selected === false)).toBe(true);
    expect(afterRetry?.importJob.status).toBe("uploaded");
    expect(afterRetry?.queueJob?.status).toBe("available");
    expect(afterRetry?.history.at(-1)?.reason).toBe("manual_retry");

    const reprocessed = await processImportJob({
      db,
      importJobId: created.importJobId,
      objectStore: createLocalObjectStore(objectStorageRoot),
      workerId: "worker-import-v1"
    });
    expect(reprocessed.status).toBe("needs_review");

    const afterRerun = await getImportDetail(db, { owner, importJobId: created.importJobId });
    expect(afterRerun?.classifications).toHaveLength((beforeRetry?.classifications.length ?? 0) * 2);
    expect(afterRerun?.sourceRecords).toHaveLength((beforeRetry?.sourceRecords.length ?? 0) * 2);
    expect(afterRerun?.reviewTasks).toHaveLength((beforeRetry?.reviewTasks.length ?? 0) * 2);
    expect(afterRerun?.sourceRecords.filter((record) => record.reviewState === "ignored")).toHaveLength(
      beforeRetry?.sourceRecords.length ?? 0
    );
    expect(afterRerun?.reviewTasks.filter((task) => task.status === "dismissed")).toHaveLength(
      beforeRetry?.reviewTasks.length ?? 0
    );
  });

  it("refuses to retry imports that have materialized canonical records", async () => {
    const owner = await createOwner();
    const { createImport, retryImport } = await import("../apps/web/src/server/imports");
    const { processImportJob } = await import("../packages/ingestion/src/importPipeline");

    const created = await createImport(db, {
      owner,
      fileName: "canonical.csv",
      mimeType: "text/csv",
      content: Buffer.from("test_name,value,unit,date\nHemoglobin,13.2,g/dL,2025-01-02\n"),
      idempotencyKey: "import-v1:retry-canonical-block",
      objectStorageRoot
    });

    await processImportJob({
      db,
      importJobId: created.importJobId,
      objectStore: createLocalObjectStore(objectStorageRoot),
      workerId: "worker-import-v1"
    });

    const [sourceRecord] = await db
      .select()
      .from(sourceRecords)
      .where(eq(sourceRecords.importJobId, created.importJobId))
      .limit(1);
    const [observation] = await db
      .select()
      .from(observations)
      .where(eq(observations.sourceRecordId, sourceRecord!.id))
      .limit(1);
    expect(observation?.displayName).toBe("Hemoglobin");

    await db
      .update(importJobs)
      .set({ status: "failed", errorCode: "synthetic", completedAt: new Date() })
      .where(eq(importJobs.id, created.importJobId));
    await db
      .update(jobQueue)
      .set({ status: "dead_letter", attempts: 5, deadLetterReason: "synthetic" })
      .where(eq(jobQueue.idempotencyKey, `job:import.health_data:${created.importJobId}`));

    await expect(retryImport(db, { owner, importJobId: created.importJobId })).rejects.toMatchObject({
      status: 409,
      code: "import_retry_has_canonical_records"
    });

    const stillThere = await db
      .select()
      .from(observations)
      .where(eq(observations.id, observation!.id));
    expect(stillThere).toHaveLength(1);
  });

  it("refuses to retry while the queued job is running", async () => {
    const owner = await createOwner();
    const { createImport, retryImport } = await import("../apps/web/src/server/imports");

    const created = await createImport(db, {
      owner,
      fileName: "running.csv",
      mimeType: "text/csv",
      content: Buffer.from("test_name,value,unit\nHemoglobin,13.2,g/dL\n"),
      idempotencyKey: "import-v1:running-guard",
      objectStorageRoot
    });

    await db
      .update(importJobs)
      .set({ status: "failed", errorCode: "synthetic", completedAt: new Date() })
      .where(eq(importJobs.id, created.importJobId));
    await db
      .update(jobQueue)
      .set({ status: "running", lockedBy: "test-worker", lockedAt: new Date(), attempts: 1 })
      .where(eq(jobQueue.idempotencyKey, `job:import.health_data:${created.importJobId}`));

    await expect(
      retryImport(db, { owner, importJobId: created.importJobId })
    ).rejects.toMatchObject({ status: 409, code: "import_in_flight" });
  });

  it("marks import domain status failed when the worker catches an unexpected pipeline error", async () => {
    const owner = await createOwner();
    const { createImport, getImportDetail } = await import("../apps/web/src/server/imports");
    const { runImportWorkerLoop } = await import("../packages/workers/src/importWorker");

    const created = await createImport(db, {
      owner,
      fileName: "missing-object.csv",
      mimeType: "text/csv",
      content: Buffer.from("test_name,value,unit\nHemoglobin,13.2,g/dL\n"),
      idempotencyKey: "import-v1:worker-error",
      objectStorageRoot
    });

    await createLocalObjectStore(objectStorageRoot).delete(created.objectKey);

    const previousRoot = process.env.OPENVITALS_OBJECT_STORAGE_ROOT;
    process.env.OPENVITALS_OBJECT_STORAGE_ROOT = objectStorageRoot;
    const controller = new AbortController();
    const workerPromise = runImportWorkerLoop({
      db,
      workerId: "worker-import-v1-error",
      signal: controller.signal,
      pollIntervalMs: 10
    });

    try {
      let detail = await getImportDetail(db, { owner, importJobId: created.importJobId });
      for (
        let attempt = 0;
        attempt < 50 && (detail?.queueJob?.status !== "retryable" || detail.importJob.status !== "failed");
        attempt += 1
      ) {
        await delay(20);
        detail = await getImportDetail(db, { owner, importJobId: created.importJobId });
      }

      expect(detail?.queueJob?.status).toBe("retryable");
      expect(detail?.importJob.status).toBe("failed");
      expect(detail?.importJob.errorCode).toBe("worker_error");
      expect(detail?.sourceDocument.status).toBe("failed");
      expect(detail?.history.at(-1)?.reason).toBe("worker_error");

      const [failedEvent] = await db
        .select()
        .from(outboxEvents)
        .where(and(eq(outboxEvents.aggregateId, created.importJobId), eq(outboxEvents.eventType, "import.failed")))
        .limit(1);
      expect(failedEvent?.eventType).toBe("import.failed");
    } finally {
      controller.abort();
      await workerPromise;
      if (previousRoot === undefined) {
        delete process.env.OPENVITALS_OBJECT_STORAGE_ROOT;
      } else {
        process.env.OPENVITALS_OBJECT_STORAGE_ROOT = previousRoot;
      }
    }
  });

  it("rejects multipart uploads larger than the configured byte cap", async () => {
    const previous = process.env.OPENVITALS_MAX_IMPORT_BYTES;
    process.env.OPENVITALS_MAX_IMPORT_BYTES = "1024";

    try {
      const { parseMultipartImportRequest } = await import("../apps/web/src/server/imports");
      const oversized = Buffer.alloc(2048, 0x41);
      const formData = new FormData();
      formData.set("file", new File([oversized], "big.csv", { type: "text/csv" }));

      await expect(
        parseMultipartImportRequest(
          new Request("http://localhost:3000/api/imports", { method: "POST", body: formData })
        )
      ).rejects.toMatchObject({ status: 413, code: "file_too_large" });
    } finally {
      if (previous === undefined) {
        delete process.env.OPENVITALS_MAX_IMPORT_BYTES;
      } else {
        process.env.OPENVITALS_MAX_IMPORT_BYTES = previous;
      }
    }
  });

  it("deletes the staged blob when the import transaction fails", async () => {
    const owner = await createOwner();
    const { createImport } = await import("../apps/web/src/server/imports");

    const failingDb = new Proxy(db as object, {
      get(target, key, receiver) {
        if (key === "transaction") {
          return async () => {
            throw new Error("synthetic transaction failure");
          };
        }
        return Reflect.get(target, key, receiver);
      }
    }) as typeof db;

    await expect(
      createImport(failingDb, {
        owner,
        fileName: "orphan.csv",
        mimeType: "text/csv",
        content: Buffer.from("test_name,value,unit\nHemoglobin,13.2,g/dL\n"),
        idempotencyKey: "import-v1:orphan-cleanup",
        objectStorageRoot
      })
    ).rejects.toThrow(/synthetic transaction failure/);

    const remaining = await listFilesRecursively(join(objectStorageRoot, "users", owner.ownerUserId));
    expect(remaining).toEqual([]);
  });
});

async function listFilesRecursively(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}
