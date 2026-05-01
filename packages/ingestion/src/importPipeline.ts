import { and, eq } from "drizzle-orm";
import {
  blobObjects,
  importJobs,
  reviewTasks,
  sourceDocuments,
  type OpenVitalsDatabase
} from "@openvitals/database";
import { sha256Hex } from "@openvitals/domain";
import { enqueueOutboxEvent, writeAuditEvent } from "@openvitals/events";
import type { HealthDataParser, ImportFile, MaterializeResult } from "./contracts";
import type { ObjectStore } from "./objectStore";
import { labCsvParser } from "./parsers/labCsvParser";

export type ProcessImportJobInput = {
  db: OpenVitalsDatabase;
  importJobId: string;
  objectStore: ObjectStore;
  workerId: string;
  parsers?: HealthDataParser[];
};

export type ProcessImportJobResult = MaterializeResult & {
  status: "completed" | "needs_review" | "failed";
};

const defaultParsers = [labCsvParser];

async function markImportFailed(
  db: OpenVitalsDatabase,
  input: {
    importJobId: string;
    sourceDocumentId: string;
    ownerUserId: string;
    workerId: string;
    errorCode: string;
    errorMessage: string;
  }
): Promise<void> {
  await db
    .update(importJobs)
    .set({
      status: "failed",
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      completedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(importJobs.id, input.importJobId));

  await db
    .update(sourceDocuments)
    .set({
      status: "failed",
      completedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(sourceDocuments.id, input.sourceDocumentId));

  await enqueueOutboxEvent(db, {
    eventType: "import.failed",
    aggregateType: "import_job",
    aggregateId: input.importJobId,
    ownerUserId: input.ownerUserId,
    actor: { type: "worker", id: input.workerId },
    payload: {
      sourceDocumentId: input.sourceDocumentId,
      errorCode: input.errorCode
    }
  });

  await writeAuditEvent(db, {
    action: "import.failed",
    resourceType: "import_job",
    resourceId: input.importJobId,
    ownerUserId: input.ownerUserId,
    actor: { type: "worker", id: input.workerId },
    metadata: {
      sourceDocumentId: input.sourceDocumentId,
      errorCode: input.errorCode
    }
  });
}

export async function processImportJob(input: ProcessImportJobInput): Promise<ProcessImportJobResult> {
  const parsers = input.parsers ?? defaultParsers;
  const [job] = await input.db.select().from(importJobs).where(eq(importJobs.id, input.importJobId)).limit(1);

  if (!job) {
    throw new Error(`Import job ${input.importJobId} not found`);
  }

  const [document] = await input.db
    .select()
    .from(sourceDocuments)
    .where(and(eq(sourceDocuments.id, job.sourceDocumentId), eq(sourceDocuments.ownerUserId, job.ownerUserId)))
    .limit(1);

  if (!document) {
    throw new Error(`Source document ${job.sourceDocumentId} not found`);
  }

  if (!document.blobObjectId) {
    await markImportFailed(input.db, {
      importJobId: job.id,
      sourceDocumentId: document.id,
      ownerUserId: job.ownerUserId,
      workerId: input.workerId,
      errorCode: "missing_blob",
      errorMessage: "Source document has no blob object."
    });
    return { status: "failed", sourceRecordCount: 0, canonicalRecordCount: 0, reviewTaskCount: 0 };
  }

  const [blob] = await input.db
    .select()
    .from(blobObjects)
    .where(and(eq(blobObjects.id, document.blobObjectId), eq(blobObjects.ownerUserId, job.ownerUserId)))
    .limit(1);

  if (!blob) {
    throw new Error(`Blob object ${document.blobObjectId} not found`);
  }

  await enqueueOutboxEvent(input.db, {
    eventType: "import.started",
    aggregateType: "import_job",
    aggregateId: job.id,
    ownerUserId: job.ownerUserId,
    actor: { type: "worker", id: input.workerId },
    payload: {
      sourceDocumentId: document.id
    }
  });

  await writeAuditEvent(input.db, {
    action: "import.started",
    resourceType: "import_job",
    resourceId: job.id,
    ownerUserId: job.ownerUserId,
    actor: { type: "worker", id: input.workerId },
    metadata: {
      sourceDocumentId: document.id
    }
  });

  const bytes = await input.objectStore.read(blob.objectKey);
  const sha256 = sha256Hex(bytes);
  if (sha256 !== blob.sha256) {
    await markImportFailed(input.db, {
      importJobId: job.id,
      sourceDocumentId: document.id,
      ownerUserId: job.ownerUserId,
      workerId: input.workerId,
      errorCode: "blob_hash_mismatch",
      errorMessage: "Blob content hash did not match the source document record."
    });
    return { status: "failed", sourceRecordCount: 0, canonicalRecordCount: 0, reviewTaskCount: 0 };
  }

  const file: ImportFile = {
    fileName: document.fileName ?? blob.objectKey,
    mimeType: document.mimeType ?? blob.mimeType,
    bytes,
    sha256
  };

  const classifications = await Promise.all(parsers.map(async (parser) => [parser, await parser.classify(file)] as const));
  const selected = classifications
    .filter(([, classification]) => classification.supported)
    .sort(([, a], [, b]) => b.confidence - a.confidence)[0];

  if (!selected) {
    await input.db
      .update(importJobs)
      .set({ status: "needs_review", updatedAt: new Date() })
      .where(eq(importJobs.id, job.id));

    await input.db
      .update(sourceDocuments)
      .set({
        status: "needs_review",
        classification: "unsupported",
        updatedAt: new Date()
      })
      .where(eq(sourceDocuments.id, document.id));

    await input.db.insert(reviewTasks).values({
      ownerUserId: job.ownerUserId,
      resourceType: "source_document",
      resourceId: document.id,
      reason: "unsupported_format",
      suggestedValue: {
        fileName: document.fileName,
        mimeType: document.mimeType
      }
    });

    return { status: "needs_review", sourceRecordCount: 0, canonicalRecordCount: 0, reviewTaskCount: 1 };
  }

  const [parser, classification] = selected;
  await input.db
    .update(importJobs)
    .set({ status: "classified", updatedAt: new Date() })
    .where(eq(importJobs.id, job.id));

  await input.db
    .update(sourceDocuments)
    .set({
      status: "classified",
      classification: classification.classification,
      parserName: parser.name,
      parserVersion: parser.version,
      classifiedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(sourceDocuments.id, document.id));

  if (classification.empty) {
    await input.db
      .update(importJobs)
      .set({
        status: "completed",
        metrics: { empty: true, recordCount: 0 },
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(importJobs.id, job.id));

    await input.db
      .update(sourceDocuments)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(sourceDocuments.id, document.id));

    return { status: "completed", sourceRecordCount: 0, canonicalRecordCount: 0, reviewTaskCount: 0 };
  }

  const parsed = await parser.parse(file);
  await input.db
    .update(importJobs)
    .set({ status: "parsed", updatedAt: new Date() })
    .where(eq(importJobs.id, job.id));

  await input.db
    .update(sourceDocuments)
    .set({ status: "parsed", parsedAt: new Date(), updatedAt: new Date() })
    .where(eq(sourceDocuments.id, document.id));

  const normalized = await parser.normalize(parsed);
  if (normalized.length === 0) {
    await markImportFailed(input.db, {
      importJobId: job.id,
      sourceDocumentId: document.id,
      ownerUserId: job.ownerUserId,
      workerId: input.workerId,
      errorCode: "zero_records_not_empty",
      errorMessage: "Parser returned zero records without classifying the import as empty."
    });
    return { status: "failed", sourceRecordCount: 0, canonicalRecordCount: 0, reviewTaskCount: 0 };
  }

  await input.db
    .update(importJobs)
    .set({ status: "normalized", updatedAt: new Date() })
    .where(eq(importJobs.id, job.id));

  await input.db
    .update(sourceDocuments)
    .set({ status: "normalized", normalizedAt: new Date(), updatedAt: new Date() })
    .where(eq(sourceDocuments.id, document.id));

  const materialized = await parser.materialize(input.db, normalized, {
    ownerUserId: job.ownerUserId,
    sourceDocumentId: document.id,
    importJobId: job.id,
    actorId: input.workerId
  });

  const finalStatus = materialized.reviewTaskCount > 0 ? "needs_review" : "completed";

  await input.db
    .update(importJobs)
    .set({
      status: finalStatus,
      metrics: {
        sourceRecordCount: materialized.sourceRecordCount,
        canonicalRecordCount: materialized.canonicalRecordCount,
        reviewTaskCount: materialized.reviewTaskCount
      },
      completedAt: finalStatus === "completed" ? new Date() : null,
      updatedAt: new Date()
    })
    .where(eq(importJobs.id, job.id));

  await input.db
    .update(sourceDocuments)
    .set({
      status: finalStatus,
      completedAt: finalStatus === "completed" ? new Date() : null,
      updatedAt: new Date()
    })
    .where(eq(sourceDocuments.id, document.id));

  await enqueueOutboxEvent(input.db, {
    eventType: "import.completed",
    aggregateType: "import_job",
    aggregateId: job.id,
    ownerUserId: job.ownerUserId,
    actor: { type: "worker", id: input.workerId },
    payload: {
      sourceDocumentId: document.id,
      status: finalStatus,
      reviewTaskCount: materialized.reviewTaskCount
    }
  });

  await writeAuditEvent(input.db, {
    action: "import.completed",
    resourceType: "import_job",
    resourceId: job.id,
    ownerUserId: job.ownerUserId,
    actor: { type: "worker", id: input.workerId },
    metadata: {
      sourceDocumentId: document.id,
      status: finalStatus
    }
  });

  return {
    status: finalStatus,
    ...materialized
  };
}
