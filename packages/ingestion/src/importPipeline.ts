import { and, eq } from "drizzle-orm";
import {
  appendImportStatusHistory,
  blobObjects,
  importJobs,
  recordFileClassifications,
  reviewTasks,
  sourceDocuments,
  type ImportJobStatus,
  type OpenVitalsDatabase
} from "@openvitals/database";
import { sha256Hex, workerActor } from "@openvitals/domain";
import { enqueueOutboxEvent, writeAuditEvent } from "@openvitals/events";
import type { HealthDataParser, ImportFile, MaterializeResult } from "./contracts";
import type { ObjectStore } from "./objectStore";
import { createParserRegistry } from "./parserRegistry";
import { labCsvParser } from "./parsers/labCsvParser";
import { imagePlaceholderParser, pdfPlaceholderParser } from "./parsers/reviewPlaceholderParsers";

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

const defaultParsers = [labCsvParser, pdfPlaceholderParser, imagePlaceholderParser];

async function markImportFailed(
  db: OpenVitalsDatabase,
  input: {
    importJobId: string;
    sourceDocumentId: string;
    ownerUserId: string;
    workerId: string;
    fromStatus: ImportJobStatus;
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

  await appendImportStatusHistory(db, {
    ownerUserId: input.ownerUserId,
    importJobId: input.importJobId,
    sourceDocumentId: input.sourceDocumentId,
    fromStatus: input.fromStatus,
    toStatus: "failed",
    actor: workerActor(input.workerId),
    reason: "import_failed",
    errorCode: input.errorCode
  });

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
  const parserRegistry = createParserRegistry(parsers);
  const actor = workerActor(input.workerId);
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

  const importJob = job;
  const sourceDocument = document;
  let currentStatus: ImportJobStatus = job.status;

  async function transitionStatus(
    toStatus: ImportJobStatus,
    inputStatus: {
      reason: string;
      errorCode?: string | undefined;
      metadata?: Record<string, unknown> | undefined;
      jobUpdates?: Partial<typeof importJobs.$inferInsert> | undefined;
      documentUpdates?: Partial<typeof sourceDocuments.$inferInsert> | undefined;
    }
  ): Promise<void> {
    const fromStatus = currentStatus;
    const now = new Date();

    await input.db
      .update(importJobs)
      .set({
        status: toStatus,
        updatedAt: now,
        ...inputStatus.jobUpdates
      })
      .where(eq(importJobs.id, importJob.id));

    await input.db
      .update(sourceDocuments)
      .set({
        status: toStatus,
        updatedAt: now,
        ...inputStatus.documentUpdates
      })
      .where(eq(sourceDocuments.id, sourceDocument.id));

    await appendImportStatusHistory(input.db, {
      ownerUserId: importJob.ownerUserId,
      importJobId: importJob.id,
      sourceDocumentId: sourceDocument.id,
      fromStatus,
      toStatus,
      actor,
      reason: inputStatus.reason,
      errorCode: inputStatus.errorCode,
      metadata: inputStatus.metadata
    });

    currentStatus = toStatus;
  }

  if (!document.blobObjectId) {
    await markImportFailed(input.db, {
      importJobId: job.id,
      sourceDocumentId: document.id,
      ownerUserId: job.ownerUserId,
      workerId: input.workerId,
      fromStatus: currentStatus,
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
      fromStatus: currentStatus,
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

  const classificationResult = await parserRegistry.classify(file);
  const selected = classificationResult.selected;

  await recordFileClassifications(
    input.db,
    classificationResult.decisions.map((decision) => ({
      ownerUserId: job.ownerUserId,
      importJobId: job.id,
      sourceDocumentId: document.id,
      parserName: decision.parserName,
      parserVersion: decision.parserVersion,
      decision: decision.decision,
      classification: decision.classification,
      confidence: decision.confidence,
      empty: decision.empty,
      selected: selected === decision,
      reason: decision.reason,
      warnings: { items: decision.warnings },
      metadata: {
        supported: decision.supported,
        reviewRequired: decision.reviewRequired
      }
    }))
  );

  if (!selected) {
    await transitionStatus("needs_review", {
      reason: "unsupported_format",
      documentUpdates: {
        classification: "unsupported",
        parserName: null,
        parserVersion: null,
        classifiedAt: new Date()
      },
      metadata: {
        decisions: classificationResult.decisions.map((decision) => ({
          parserName: decision.parserName,
          parserVersion: decision.parserVersion,
          decision: decision.decision,
          classification: decision.classification,
          confidence: decision.confidence
        }))
      }
    });

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

  const parser = selected.parser;
  await transitionStatus("classified", {
    reason: "parser_selected",
    documentUpdates: {
      classification: selected.classification,
      parserName: selected.parserName,
      parserVersion: selected.parserVersion,
      classifiedAt: new Date()
    },
    metadata: {
      parserName: selected.parserName,
      parserVersion: selected.parserVersion,
      classification: selected.classification,
      decision: selected.decision,
      confidence: selected.confidence
    }
  });

  if (selected.empty) {
    await transitionStatus("completed", {
      reason: "empty_import",
      jobUpdates: {
        metrics: { empty: true, recordCount: 0 },
        completedAt: new Date()
      },
      documentUpdates: {
        completedAt: new Date()
      }
    });

    return { status: "completed", sourceRecordCount: 0, canonicalRecordCount: 0, reviewTaskCount: 0 };
  }

  const parsed = await parser.parse(file);
  await transitionStatus("parsed", {
    reason: "parser_parse_completed",
    documentUpdates: {
      parsedAt: new Date()
    },
    metadata: {
      parsedRecordCount: parsed.length
    }
  });

  const normalized = await parser.normalize(parsed);
  if (normalized.length === 0) {
    await markImportFailed(input.db, {
      importJobId: job.id,
      sourceDocumentId: document.id,
      ownerUserId: job.ownerUserId,
      workerId: input.workerId,
      fromStatus: currentStatus,
      errorCode: "zero_records_not_empty",
      errorMessage: "Parser returned zero records without classifying the import as empty."
    });
    return { status: "failed", sourceRecordCount: 0, canonicalRecordCount: 0, reviewTaskCount: 0 };
  }

  await transitionStatus("normalized", {
    reason: "parser_normalize_completed",
    documentUpdates: {
      normalizedAt: new Date()
    },
    metadata: {
      normalizedRecordCount: normalized.length
    }
  });

  const materialized = await parser.materialize(input.db, normalized, {
    ownerUserId: job.ownerUserId,
    sourceDocumentId: document.id,
    importJobId: job.id,
    actorId: input.workerId
  });

  const finalStatus = materialized.reviewTaskCount > 0 ? "needs_review" : "completed";

  await transitionStatus(finalStatus, {
    reason: finalStatus === "needs_review" ? "materialized_with_review_tasks" : "materialized",
    jobUpdates: {
      metrics: {
        sourceRecordCount: materialized.sourceRecordCount,
        canonicalRecordCount: materialized.canonicalRecordCount,
        reviewTaskCount: materialized.reviewTaskCount
      },
      completedAt: finalStatus === "completed" ? new Date() : null
    },
    documentUpdates: {
      completedAt: finalStatus === "completed" ? new Date() : null
    },
    metadata: {
      sourceRecordCount: materialized.sourceRecordCount,
      canonicalRecordCount: materialized.canonicalRecordCount,
      reviewTaskCount: materialized.reviewTaskCount
    }
  });

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
