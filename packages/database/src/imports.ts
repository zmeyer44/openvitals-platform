import type { Actor } from "@openvitals/domain";
import type { OpenVitalsDatabase } from "./client";
import {
  fileClassifications,
  importJobs,
  importStatusHistory,
  type JsonObject
} from "./schema";

export type ImportJobStatus = (typeof importJobs.$inferSelect)["status"];
export type FileClassificationDecision = (typeof fileClassifications.$inferSelect)["decision"];

export type AppendImportStatusHistoryInput = {
  ownerUserId: string;
  importJobId: string;
  sourceDocumentId: string;
  fromStatus?: ImportJobStatus | null;
  toStatus: ImportJobStatus;
  actor: Actor;
  reason?: string | undefined;
  errorCode?: string | undefined;
  metadata?: JsonObject | undefined;
};

export type RecordFileClassificationInput = {
  ownerUserId: string;
  importJobId: string;
  sourceDocumentId: string;
  parserName: string;
  parserVersion: string;
  decision: FileClassificationDecision;
  classification: string;
  confidence?: number | null | undefined;
  empty?: boolean | undefined;
  selected?: boolean | undefined;
  reason?: string | undefined;
  warnings?: JsonObject | undefined;
  metadata?: JsonObject | undefined;
};

export function importQueueIdempotencyKey(importJobId: string): string {
  return `job:import.health_data:${importJobId}`;
}

export async function appendImportStatusHistory(
  db: OpenVitalsDatabase,
  input: AppendImportStatusHistoryInput
): Promise<void> {
  await db.insert(importStatusHistory).values({
    ownerUserId: input.ownerUserId,
    importJobId: input.importJobId,
    sourceDocumentId: input.sourceDocumentId,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus,
    actorType: input.actor.type,
    actorId: "id" in input.actor ? input.actor.id : null,
    reason: input.reason,
    errorCode: input.errorCode,
    metadata: input.metadata ?? {}
  });
}

export async function recordFileClassifications(
  db: OpenVitalsDatabase,
  records: RecordFileClassificationInput[]
): Promise<void> {
  if (records.length === 0) {
    return;
  }

  await db.insert(fileClassifications).values(
    records.map((record) => ({
      ownerUserId: record.ownerUserId,
      importJobId: record.importJobId,
      sourceDocumentId: record.sourceDocumentId,
      parserName: record.parserName,
      parserVersion: record.parserVersion,
      decision: record.decision,
      classification: record.classification,
      confidence: record.confidence == null ? null : record.confidence.toFixed(4),
      empty: record.empty ?? false,
      selected: record.selected ?? false,
      reason: record.reason,
      warnings: record.warnings ?? {},
      metadata: record.metadata ?? {}
    }))
  );
}
