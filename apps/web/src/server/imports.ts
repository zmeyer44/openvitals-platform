import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  appendImportStatusHistory,
  blobObjects,
  conditions,
  encounters,
  enqueueJob,
  fileClassifications,
  importJobs,
  importQueueIdempotencyKey,
  importStatusHistory,
  JobRetryConflictError,
  jobQueue,
  medications,
  observations,
  retryJobByIdempotencyKey,
  reviewTasks,
  sourceDocuments,
  sourceRecords,
  type ImportJobStatus,
  type OpenVitalsDatabase
} from "@openvitals/database";
import { buildSourceDocumentObjectKey, sha256Hex } from "@openvitals/domain";
import { createLocalObjectStore } from "@openvitals/ingestion";
import type { AuthenticatedOwnerContext } from "./ownership";

export type CreateImportInput = {
  owner: Pick<AuthenticatedOwnerContext, "ownerUserId" | "actor">;
  fileName: string;
  mimeType: string;
  content: Buffer | Uint8Array | ArrayBuffer;
  idempotencyKey?: string | undefined;
  objectStorageRoot?: string | undefined;
};

export type CreateImportResult = {
  status: "uploaded" | "deduplicated";
  sourceDocumentId: string;
  importJobId: string;
  objectKey: string;
};

export class ImportApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

function getOptionalString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

const DEFAULT_MAX_IMPORT_FILE_BYTES = 25 * 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 4 * 1024;

function getMaxImportFileBytes(): number {
  const raw = process.env.OPENVITALS_MAX_IMPORT_BYTES;
  if (!raw) {
    return DEFAULT_MAX_IMPORT_FILE_BYTES;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_IMPORT_FILE_BYTES;
}

export async function parseMultipartImportRequest(request: Request): Promise<{
  fileName: string;
  mimeType: string;
  content: Buffer;
  idempotencyKey?: string | undefined;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new ImportApiError(415, "multipart_required", "Imports must be uploaded as multipart/form-data.");
  }

  const maxBytes = getMaxImportFileBytes();
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const declared = Number.parseInt(contentLengthHeader, 10);
    if (!Number.isFinite(declared) || declared < 0) {
      throw new ImportApiError(400, "invalid_content_length", "Content-Length header is not a valid byte count.");
    }
    if (declared > maxBytes + MULTIPART_OVERHEAD_BYTES) {
      throw new ImportApiError(413, "file_too_large", `Uploads must not exceed ${maxBytes} bytes.`);
    }
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new ImportApiError(400, "file_required", "Multipart upload requires a file field named file.");
  }

  if (file.size > maxBytes) {
    throw new ImportApiError(413, "file_too_large", `Uploads must not exceed ${maxBytes} bytes.`);
  }

  const content = Buffer.from(await file.arrayBuffer());
  if (content.length === 0) {
    throw new ImportApiError(400, "empty_file", "Uploaded files must not be empty.");
  }
  if (content.length > maxBytes) {
    throw new ImportApiError(413, "file_too_large", `Uploads must not exceed ${maxBytes} bytes.`);
  }

  return {
    fileName: file.name || "uploaded-file",
    mimeType: file.type || "application/octet-stream",
    content,
    idempotencyKey: getOptionalString(formData.get("idempotencyKey"))
  };
}

async function findExistingImportByKey(
  db: OpenVitalsDatabase,
  ownerUserId: string,
  idempotencyKey: string
): Promise<{ sourceDocumentId: string; importJobId: string; objectKey: string } | null> {
  const [existing] = await db
    .select({
      importJobId: importJobs.id,
      sourceDocumentId: sourceDocuments.id,
      objectKey: blobObjects.objectKey
    })
    .from(importJobs)
    .innerJoin(sourceDocuments, eq(sourceDocuments.id, importJobs.sourceDocumentId))
    .leftJoin(blobObjects, eq(blobObjects.id, sourceDocuments.blobObjectId))
    .where(and(eq(importJobs.ownerUserId, ownerUserId), eq(importJobs.idempotencyKey, idempotencyKey)))
    .limit(1);

  if (!existing) {
    return null;
  }

  return {
    sourceDocumentId: existing.sourceDocumentId,
    importJobId: existing.importJobId,
    objectKey: existing.objectKey ?? ""
  };
}

export async function createImport(
  db: OpenVitalsDatabase,
  input: CreateImportInput
): Promise<CreateImportResult> {
  const bytes = Buffer.isBuffer(input.content)
    ? input.content
    : input.content instanceof ArrayBuffer
      ? Buffer.from(input.content)
      : Buffer.from(input.content);
  const sha256 = sha256Hex(bytes);
  const ownerUserId = input.owner.ownerUserId;
  const idempotencyKey = input.idempotencyKey ?? `import:${ownerUserId}:${sha256}`;

  const existing = await findExistingImportByKey(db, ownerUserId, idempotencyKey);
  if (existing) {
    return { status: "deduplicated", ...existing };
  }

  const sourceDocumentId = randomUUID();
  const objectKey = buildSourceDocumentObjectKey({
    ownerUserId,
    sourceDocumentId,
    sha256,
    fileName: input.fileName
  });
  const objectStore = createLocalObjectStore(
    input.objectStorageRoot ?? process.env.OPENVITALS_OBJECT_STORAGE_ROOT ?? ".data/blobs"
  );

  await objectStore.write(objectKey, bytes);

  try {
    const result = await db.transaction(async (tx) => {
      const [sourceDocument] = await tx
        .insert(sourceDocuments)
        .values({
          id: sourceDocumentId,
          ownerUserId,
          sourceKind: "file",
          fileName: input.fileName,
          mimeType: input.mimeType,
          sha256,
          status: "uploaded"
        })
        .returning();

      if (!sourceDocument) {
        throw new Error("Failed to create source document");
      }

      const [blob] = await tx
        .insert(blobObjects)
        .values({
          ownerUserId,
          objectKey,
          sha256,
          mimeType: input.mimeType,
          byteSize: bytes.length
        })
        .onConflictDoUpdate({
          target: blobObjects.objectKey,
          set: {
            mimeType: input.mimeType,
            byteSize: bytes.length,
            updatedAt: new Date()
          }
        })
        .returning();

      if (!blob) {
        throw new Error("Failed to create blob object");
      }

      await tx
        .update(sourceDocuments)
        .set({ blobObjectId: blob.id })
        .where(eq(sourceDocuments.id, sourceDocument.id));

      const [importJob] = await tx
        .insert(importJobs)
        .values({
          ownerUserId,
          sourceDocumentId: sourceDocument.id,
          status: "uploaded",
          idempotencyKey
        })
        .returning();

      if (!importJob) {
        throw new Error("Failed to create import job");
      }

      await appendImportStatusHistory(tx, {
        ownerUserId,
        importJobId: importJob.id,
        sourceDocumentId: sourceDocument.id,
        fromStatus: null,
        toStatus: "uploaded",
        actor: input.owner.actor,
        reason: "file_uploaded",
        metadata: {
          fileName: input.fileName,
          mimeType: input.mimeType,
          byteSize: bytes.length,
          sha256
        }
      });

      await enqueueJob(tx, {
        kind: "import.health_data",
        payload: { importJobId: importJob.id },
        idempotencyKey: importQueueIdempotencyKey(importJob.id)
      });

      return {
        sourceDocumentId: sourceDocument.id,
        importJobId: importJob.id,
        objectKey
      };
    });

    return { status: "uploaded", ...result };
  } catch (error) {
    if (isUniqueViolation(error, "import_jobs_idempotency_key_unique")) {
      const raced = await findExistingImportByKey(db, ownerUserId, idempotencyKey);
      if (raced) {
        await safeDeleteUnreferencedObject(db, objectStore, objectKey);
        return { status: "deduplicated", ...raced };
      }
    }
    await safeDeleteUnreferencedObject(db, objectStore, objectKey);
    throw error;
  }
}

async function safeDeleteObject(objectStore: { delete(objectKey: string): Promise<void> }, objectKey: string): Promise<void> {
  try {
    await objectStore.delete(objectKey);
  } catch {
    // Best-effort: leave a reaper to mop up if delete fails (e.g. file already missing or transient I/O).
  }
}

// Best-effort cleanup after a failed createImport: only deletes the blob if no
// committed row references it. There is a residual TOCTOU window — a concurrent
// import that wrote the same sha256 key could commit between our SELECT and the
// FS delete, leaving its row pointing at a missing file. The local filestore
// accepts that risk; production object storage should switch to refcounting or
// an async unreferenced-blob reaper.
async function safeDeleteUnreferencedObject(
  db: OpenVitalsDatabase,
  objectStore: { delete(objectKey: string): Promise<void> },
  objectKey: string
): Promise<void> {
  const [referenced] = await db
    .select({ id: blobObjects.id })
    .from(blobObjects)
    .where(eq(blobObjects.objectKey, objectKey))
    .limit(1);

  if (!referenced) {
    await safeDeleteObject(objectStore, objectKey);
  }
}

function isUniqueViolation(error: unknown, constraintName?: string): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as { code?: unknown; constraint?: unknown };
  if (candidate.code !== "23505") {
    return false;
  }
  if (constraintName && candidate.constraint !== constraintName) {
    return false;
  }
  return true;
}

export async function listImports(
  db: OpenVitalsDatabase,
  input: {
    owner: Pick<AuthenticatedOwnerContext, "ownerUserId">;
    status?: ImportJobStatus | undefined;
    limit?: number | undefined;
  }
) {
  const conditions = [eq(importJobs.ownerUserId, input.owner.ownerUserId)];
  if (input.status) {
    conditions.push(eq(importJobs.status, input.status));
  }

  const rows = await db
    .select({ job: importJobs, document: sourceDocuments })
    .from(importJobs)
    .innerJoin(sourceDocuments, eq(sourceDocuments.id, importJobs.sourceDocumentId))
    .where(and(...conditions))
    .orderBy(desc(importJobs.createdAt))
    .limit(input.limit ?? 25);

  const queueKeys = rows.map((row) => importQueueIdempotencyKey(row.job.id));
  const queuedJobs =
    queueKeys.length > 0
      ? await db.select().from(jobQueue).where(inArray(jobQueue.idempotencyKey, queueKeys))
      : [];
  const queueByKey = new Map(queuedJobs.map((queueJob) => [queueJob.idempotencyKey, queueJob]));

  return rows.map((row) => ({
    importJob: row.job,
    sourceDocument: row.document,
    queueJob: queueByKey.get(importQueueIdempotencyKey(row.job.id)) ?? null
  }));
}

export async function getImportDetail(
  db: OpenVitalsDatabase,
  input: {
    owner: Pick<AuthenticatedOwnerContext, "ownerUserId">;
    importJobId: string;
  }
) {
  const [row] = await db
    .select({ job: importJobs, document: sourceDocuments })
    .from(importJobs)
    .innerJoin(sourceDocuments, eq(sourceDocuments.id, importJobs.sourceDocumentId))
    .where(and(eq(importJobs.ownerUserId, input.owner.ownerUserId), eq(importJobs.id, input.importJobId)))
    .limit(1);

  if (!row) {
    return null;
  }

  const classifications = await db
    .select()
    .from(fileClassifications)
    .where(and(eq(fileClassifications.ownerUserId, input.owner.ownerUserId), eq(fileClassifications.importJobId, row.job.id)))
    .orderBy(asc(fileClassifications.createdAt));

  const history = await db
    .select()
    .from(importStatusHistory)
    .where(and(eq(importStatusHistory.ownerUserId, input.owner.ownerUserId), eq(importStatusHistory.importJobId, row.job.id)))
    .orderBy(asc(importStatusHistory.createdAt));

  const records = await db
    .select()
    .from(sourceRecords)
    .where(and(eq(sourceRecords.ownerUserId, input.owner.ownerUserId), eq(sourceRecords.importJobId, row.job.id)))
    .orderBy(asc(sourceRecords.createdAt));

  const recordIds = records.map((record) => record.id);
  const documentReviewTasks = await db
    .select()
    .from(reviewTasks)
    .where(and(eq(reviewTasks.ownerUserId, input.owner.ownerUserId), eq(reviewTasks.resourceId, row.document.id)))
    .orderBy(asc(reviewTasks.createdAt));
  const recordReviewTasks =
    recordIds.length > 0
      ? await db
          .select()
          .from(reviewTasks)
          .where(and(eq(reviewTasks.ownerUserId, input.owner.ownerUserId), inArray(reviewTasks.sourceRecordId, recordIds)))
          .orderBy(asc(reviewTasks.createdAt))
      : [];
  const reviewTaskById = new Map([...documentReviewTasks, ...recordReviewTasks].map((task) => [task.id, task]));

  const [queueJob] = await db
    .select()
    .from(jobQueue)
    .where(eq(jobQueue.idempotencyKey, importQueueIdempotencyKey(row.job.id)))
    .limit(1);

  return {
    importJob: row.job,
    sourceDocument: row.document,
    classifications,
    history,
    sourceRecords: records,
    reviewTasks: [...reviewTaskById.values()],
    queueJob: queueJob ?? null
  };
}

export async function retryImport(
  db: OpenVitalsDatabase,
  input: {
    owner: Pick<AuthenticatedOwnerContext, "ownerUserId" | "actor">;
    importJobId: string;
  }
) {
  const detail = await getImportDetail(db, input);
  if (!detail) {
    return null;
  }

  const retryableQueueStates = new Set(["dead_letter", "failed", "retryable"]);
  const canRetry =
    detail.importJob.status === "failed" ||
    (detail.queueJob ? retryableQueueStates.has(detail.queueJob.status) : false);

  if (!canRetry) {
    throw new ImportApiError(409, "import_not_retryable", "Only failed, retryable, or dead-lettered imports can be retried.");
  }

  if (detail.queueJob?.status === "running") {
    throw new ImportApiError(409, "import_in_flight", "Import is currently being processed and cannot be retried.");
  }

  await assertImportHasNoCanonicalRecords(db, {
    ownerUserId: input.owner.ownerUserId,
    sourceRecordIds: detail.sourceRecords.map((record) => record.id)
  });

  try {
    await db.transaction(async (tx) => {
      const now = new Date();
      const importJobId = detail.importJob.id;
      const sourceDocumentId = detail.sourceDocument.id;
      const ownerUserId = input.owner.ownerUserId;

      await tx
        .delete(reviewTasks)
        .where(
          and(
            eq(reviewTasks.ownerUserId, ownerUserId),
            isNull(reviewTasks.sourceRecordId),
            eq(reviewTasks.resourceType, "source_document"),
            eq(reviewTasks.resourceId, sourceDocumentId)
          )
        );

      await tx
        .delete(sourceRecords)
        .where(
          and(eq(sourceRecords.ownerUserId, ownerUserId), eq(sourceRecords.importJobId, importJobId))
        );

      await tx
        .delete(fileClassifications)
        .where(
          and(
            eq(fileClassifications.ownerUserId, ownerUserId),
            eq(fileClassifications.importJobId, importJobId)
          )
        );

      await tx
        .update(importJobs)
        .set({
          status: "uploaded",
          errorCode: null,
          errorMessage: null,
          retryAfter: null,
          completedAt: null,
          updatedAt: now
        })
        .where(eq(importJobs.id, importJobId));

      await tx
        .update(sourceDocuments)
        .set({
          status: "uploaded",
          classification: null,
          parserName: null,
          parserVersion: null,
          classifiedAt: null,
          parsedAt: null,
          normalizedAt: null,
          completedAt: null,
          updatedAt: now
        })
        .where(eq(sourceDocuments.id, sourceDocumentId));

      await appendImportStatusHistory(tx, {
        ownerUserId,
        importJobId,
        sourceDocumentId,
        fromStatus: detail.importJob.status,
        toStatus: "uploaded",
        actor: input.owner.actor,
        reason: "manual_retry"
      });

      await retryJobByIdempotencyKey(tx, {
        kind: "import.health_data",
        idempotencyKey: importQueueIdempotencyKey(importJobId),
        payload: { importJobId },
        maxAttempts: detail.queueJob?.maxAttempts ?? detail.importJob.maxAttempts
      });
    });
  } catch (error) {
    if (error instanceof JobRetryConflictError) {
      throw new ImportApiError(409, "import_in_flight", "Import is currently being processed and cannot be retried.");
    }
    throw error;
  }

  return getImportDetail(db, input);
}

async function assertImportHasNoCanonicalRecords(
  db: OpenVitalsDatabase,
  input: { ownerUserId: string; sourceRecordIds: string[] }
): Promise<void> {
  if (input.sourceRecordIds.length === 0) {
    return;
  }

  for (const table of [observations, conditions, medications, encounters] as const) {
    const [existing] = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.ownerUserId, input.ownerUserId), inArray(table.sourceRecordId, input.sourceRecordIds)))
      .limit(1);

    if (existing) {
      throw new ImportApiError(
        409,
        "import_retry_has_canonical_records",
        "Imports that have already materialized canonical records cannot be reset for retry."
      );
    }
  }
}
