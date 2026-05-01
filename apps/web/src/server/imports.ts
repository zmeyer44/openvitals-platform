import { Buffer } from "node:buffer";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  appendImportStatusHistory,
  blobObjects,
  enqueueJob,
  fileClassifications,
  importJobs,
  importQueueIdempotencyKey,
  importStatusHistory,
  jobQueue,
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
  status: "uploaded";
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

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new ImportApiError(400, "file_required", "Multipart upload requires a file field named file.");
  }

  const content = Buffer.from(await file.arrayBuffer());
  if (content.length === 0) {
    throw new ImportApiError(400, "empty_file", "Uploaded files must not be empty.");
  }

  return {
    fileName: file.name || "uploaded-file",
    mimeType: file.type || "application/octet-stream",
    content,
    idempotencyKey: getOptionalString(formData.get("idempotencyKey"))
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
  const objectStore = createLocalObjectStore(input.objectStorageRoot ?? process.env.OPENVITALS_OBJECT_STORAGE_ROOT ?? ".data/blobs");
  const ownerUserId = input.owner.ownerUserId;

  const result = await db.transaction(async (tx) => {
    const [sourceDocument] = await tx
      .insert(sourceDocuments)
      .values({
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

    const objectKey = buildSourceDocumentObjectKey({
      ownerUserId,
      sourceDocumentId: sourceDocument.id,
      sha256,
      fileName: input.fileName
    });

    await objectStore.write(objectKey, bytes);

    const [blob] = await tx
      .insert(blobObjects)
      .values({
        ownerUserId,
        objectKey,
        sha256,
        mimeType: input.mimeType,
        byteSize: bytes.length
      })
      .returning();

    if (!blob) {
      throw new Error("Failed to create blob object");
    }

    await tx.update(sourceDocuments).set({ blobObjectId: blob.id }).where(eq(sourceDocuments.id, sourceDocument.id));

    const [importJob] = await tx
      .insert(importJobs)
      .values({
        ownerUserId,
        sourceDocumentId: sourceDocument.id,
        status: "uploaded",
        idempotencyKey: input.idempotencyKey ?? `import:${ownerUserId}:${sha256}`
      })
      .returning();

    if (!importJob) {
      throw new Error("Failed to create import job");
    }

    await appendImportStatusHistory(tx as unknown as OpenVitalsDatabase, {
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

    await enqueueJob(tx as unknown as OpenVitalsDatabase, {
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

  return {
    status: "uploaded",
    ...result
  };
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

  await db.transaction(async (tx) => {
    const now = new Date();

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
      .where(eq(importJobs.id, detail.importJob.id));

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
      .where(eq(sourceDocuments.id, detail.sourceDocument.id));

    await appendImportStatusHistory(tx as unknown as OpenVitalsDatabase, {
      ownerUserId: input.owner.ownerUserId,
      importJobId: detail.importJob.id,
      sourceDocumentId: detail.sourceDocument.id,
      fromStatus: detail.importJob.status,
      toStatus: "uploaded",
      actor: input.owner.actor,
      reason: "manual_retry"
    });

    await retryJobByIdempotencyKey(tx as unknown as OpenVitalsDatabase, {
      kind: "import.health_data",
      idempotencyKey: importQueueIdempotencyKey(detail.importJob.id),
      payload: { importJobId: detail.importJob.id },
      maxAttempts: detail.queueJob?.maxAttempts ?? detail.importJob.maxAttempts
    });
  });

  return getImportDetail(db, input);
}
