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
import { sha256Hex, workerActor, type Actor } from "@openvitals/domain";
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

type StatusTransitionInput = {
  importJobId: string;
  sourceDocumentId: string;
  ownerUserId: string;
  fromStatus: ImportJobStatus;
  toStatus: ImportJobStatus;
  actor: Actor;
  reason: string;
  errorCode?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  jobUpdates?: Partial<typeof importJobs.$inferInsert> | undefined;
  documentUpdates?: Partial<typeof sourceDocuments.$inferInsert> | undefined;
};

async function applyStatusTransition(db: OpenVitalsDatabase, input: StatusTransitionInput): Promise<void> {
  const now = new Date();

  await db
    .update(importJobs)
    .set({
      status: input.toStatus,
      updatedAt: now,
      ...input.jobUpdates
    })
    .where(eq(importJobs.id, input.importJobId));

  await db
    .update(sourceDocuments)
    .set({
      status: input.toStatus,
      updatedAt: now,
      ...input.documentUpdates
    })
    .where(eq(sourceDocuments.id, input.sourceDocumentId));

  await appendImportStatusHistory(db, {
    ownerUserId: input.ownerUserId,
    importJobId: input.importJobId,
    sourceDocumentId: input.sourceDocumentId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actor: input.actor,
    reason: input.reason,
    errorCode: input.errorCode,
    metadata: input.metadata
  });
}

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
  const actor = workerActor(input.workerId);

  await db.transaction(async (tx) => {
    const txDb = tx as unknown as OpenVitalsDatabase;

    await applyStatusTransition(txDb, {
      importJobId: input.importJobId,
      sourceDocumentId: input.sourceDocumentId,
      ownerUserId: input.ownerUserId,
      fromStatus: input.fromStatus,
      toStatus: "failed",
      actor,
      reason: "import_failed",
      errorCode: input.errorCode,
      jobUpdates: {
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        completedAt: new Date()
      },
      documentUpdates: {
        completedAt: new Date()
      }
    });

    await enqueueOutboxEvent(txDb, {
      eventType: "import.failed",
      aggregateType: "import_job",
      aggregateId: input.importJobId,
      ownerUserId: input.ownerUserId,
      actor,
      payload: {
        sourceDocumentId: input.sourceDocumentId,
        errorCode: input.errorCode
      }
    });

    await writeAuditEvent(txDb, {
      action: "import.failed",
      resourceType: "import_job",
      resourceId: input.importJobId,
      ownerUserId: input.ownerUserId,
      actor,
      metadata: {
        sourceDocumentId: input.sourceDocumentId,
        errorCode: input.errorCode
      }
    });
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

  let currentStatus: ImportJobStatus = job.status;

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

  await input.db.transaction(async (tx) => {
    const txDb = tx as unknown as OpenVitalsDatabase;
    await enqueueOutboxEvent(txDb, {
      eventType: "import.started",
      aggregateType: "import_job",
      aggregateId: job.id,
      ownerUserId: job.ownerUserId,
      actor,
      payload: {
        sourceDocumentId: document.id
      }
    });

    await writeAuditEvent(txDb, {
      action: "import.started",
      resourceType: "import_job",
      resourceId: job.id,
      ownerUserId: job.ownerUserId,
      actor,
      metadata: {
        sourceDocumentId: document.id
      }
    });
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

  if (!selected) {
    await input.db.transaction(async (tx) => {
      const txDb = tx as unknown as OpenVitalsDatabase;

      await recordFileClassifications(
        txDb,
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
          selected: false,
          reason: decision.reason,
          warnings: { items: decision.warnings },
          metadata: {
            supported: decision.supported,
            reviewRequired: decision.reviewRequired
          }
        }))
      );

      await applyStatusTransition(txDb, {
        importJobId: job.id,
        sourceDocumentId: document.id,
        ownerUserId: job.ownerUserId,
        fromStatus: currentStatus,
        toStatus: "needs_review",
        actor,
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

      await txDb.insert(reviewTasks).values({
        ownerUserId: job.ownerUserId,
        resourceType: "source_document",
        resourceId: document.id,
        reason: "unsupported_format",
        suggestedValue: {
          fileName: document.fileName,
          mimeType: document.mimeType
        }
      });
    });
    currentStatus = "needs_review";

    return { status: "needs_review", sourceRecordCount: 0, canonicalRecordCount: 0, reviewTaskCount: 1 };
  }

  await input.db.transaction(async (tx) => {
    const txDb = tx as unknown as OpenVitalsDatabase;

    await recordFileClassifications(
      txDb,
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

    await applyStatusTransition(txDb, {
      importJobId: job.id,
      sourceDocumentId: document.id,
      ownerUserId: job.ownerUserId,
      fromStatus: currentStatus,
      toStatus: "classified",
      actor,
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
  });
  currentStatus = "classified";

  if (selected.empty) {
    await input.db.transaction(async (tx) => {
      await applyStatusTransition(tx as unknown as OpenVitalsDatabase, {
        importJobId: job.id,
        sourceDocumentId: document.id,
        ownerUserId: job.ownerUserId,
        fromStatus: currentStatus,
        toStatus: "completed",
        actor,
        reason: "empty_import",
        jobUpdates: {
          metrics: { empty: true, recordCount: 0 },
          completedAt: new Date()
        },
        documentUpdates: {
          completedAt: new Date()
        }
      });
    });
    currentStatus = "completed";

    return { status: "completed", sourceRecordCount: 0, canonicalRecordCount: 0, reviewTaskCount: 0 };
  }

  const parser = selected.parser;
  const parsed = await parser.parse(file);

  await input.db.transaction(async (tx) => {
    await applyStatusTransition(tx as unknown as OpenVitalsDatabase, {
      importJobId: job.id,
      sourceDocumentId: document.id,
      ownerUserId: job.ownerUserId,
      fromStatus: currentStatus,
      toStatus: "parsed",
      actor,
      reason: "parser_parse_completed",
      documentUpdates: {
        parsedAt: new Date()
      },
      metadata: {
        parsedRecordCount: parsed.length
      }
    });
  });
  currentStatus = "parsed";

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

  await input.db.transaction(async (tx) => {
    await applyStatusTransition(tx as unknown as OpenVitalsDatabase, {
      importJobId: job.id,
      sourceDocumentId: document.id,
      ownerUserId: job.ownerUserId,
      fromStatus: currentStatus,
      toStatus: "normalized",
      actor,
      reason: "parser_normalize_completed",
      documentUpdates: {
        normalizedAt: new Date()
      },
      metadata: {
        normalizedRecordCount: normalized.length
      }
    });
  });
  currentStatus = "normalized";

  const result = await input.db.transaction(async (tx) => {
    const txDb = tx as unknown as OpenVitalsDatabase;

    const materialized = await parser.materialize(txDb, normalized, {
      ownerUserId: job.ownerUserId,
      sourceDocumentId: document.id,
      importJobId: job.id,
      actorId: input.workerId
    });

    const finalStatus: ImportJobStatus = materialized.reviewTaskCount > 0 ? "needs_review" : "completed";

    await applyStatusTransition(txDb, {
      importJobId: job.id,
      sourceDocumentId: document.id,
      ownerUserId: job.ownerUserId,
      fromStatus: currentStatus,
      toStatus: finalStatus,
      actor,
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

    await enqueueOutboxEvent(txDb, {
      eventType: "import.completed",
      aggregateType: "import_job",
      aggregateId: job.id,
      ownerUserId: job.ownerUserId,
      actor,
      payload: {
        sourceDocumentId: document.id,
        status: finalStatus,
        reviewTaskCount: materialized.reviewTaskCount
      }
    });

    await writeAuditEvent(txDb, {
      action: "import.completed",
      resourceType: "import_job",
      resourceId: job.id,
      ownerUserId: job.ownerUserId,
      actor,
      metadata: {
        sourceDocumentId: document.id,
        status: finalStatus
      }
    });

    return { materialized, finalStatus };
  });

  return {
    status: result.finalStatus,
    ...result.materialized
  };
}
