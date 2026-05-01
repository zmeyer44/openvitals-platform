import {
  reviewTasks,
  sourceRecords,
  type OpenVitalsDbExecutor
} from "@openvitals/database";
import { workerActor } from "@openvitals/domain";
import { enqueueOutboxEvent, writeAuditEvent } from "@openvitals/events";
import type {
  ClassificationResult,
  HealthDataParser,
  ImportFile,
  MaterializeContext,
  MaterializeResult,
  NormalizedRecord,
  NormalizedReviewPlaceholder,
  ParsedRecord
} from "../contracts";

type PlaceholderDefinition = {
  name: string;
  version: string;
  classification: string;
  recordType: "unsupported" | "note";
  reason: string;
  supportedMimeTypes: string[];
  extensions: string[];
  message: string;
};

function fileMatches(file: ImportFile, definition: PlaceholderDefinition): boolean {
  const lowerName = file.fileName.toLowerCase();
  return (
    definition.supportedMimeTypes.includes(file.mimeType.toLowerCase()) ||
    definition.extensions.some((extension) => lowerName.endsWith(extension))
  );
}

function createPlaceholderParser(definition: PlaceholderDefinition): HealthDataParser {
  return {
    name: definition.name,
    version: definition.version,

    async classify(file: ImportFile): Promise<ClassificationResult> {
      if (!fileMatches(file, definition)) {
        return {
          supported: false,
          classification: "unsupported",
          confidence: 0,
          warnings: [
            {
              code: "unsupported_mime_type",
              message: `${definition.name} does not support this file type.`,
              severity: "info"
            }
          ]
        };
      }

      return {
        supported: true,
        classification: definition.classification,
        confidence: 0.95,
        reviewRequired: true,
        warnings: [
          {
            code: definition.reason,
            message: definition.message,
            severity: "warning"
          }
        ]
      };
    },

    async parse(file: ImportFile): Promise<ParsedRecord[]> {
      return [
        {
          temporaryId: "document-placeholder",
          kind: "note",
          sourceText: `${file.fileName} (${file.mimeType}) requires manual review before extraction.`,
          original: {
            fileName: file.fileName,
            mimeType: file.mimeType,
            sha256: file.sha256
          },
          confidence: 0.95,
          warnings: [
            {
              code: definition.reason,
              message: definition.message,
              severity: "warning"
            }
          ]
        }
      ];
    },

    async normalize(records: ParsedRecord[]): Promise<NormalizedRecord[]> {
      return records.map(
        (record): NormalizedReviewPlaceholder => ({
          temporaryId: record.temporaryId,
          kind: "review_placeholder",
          recordType: definition.recordType,
          reason: definition.reason,
          confidence: record.confidence,
          ...(record.sourceText ? { sourceText: record.sourceText } : {}),
          ...(record.sourceReference ? { sourceReference: record.sourceReference } : {}),
          original: record.original,
          warnings: record.warnings,
          suggestedValue: {
            ...record.original,
            classification: definition.classification,
            message: definition.message
          }
        })
      );
    },

    async materialize(
      db: OpenVitalsDbExecutor,
      records: NormalizedRecord[],
      context: MaterializeContext
    ): Promise<MaterializeResult> {
      let sourceRecordCount = 0;
      let reviewTaskCount = 0;
      const actor = workerActor(context.actorId);

      for (const record of records) {
        if (record.kind !== "review_placeholder") {
          continue;
        }

        const [sourceRecord] = await db
          .insert(sourceRecords)
          .values({
            ownerUserId: context.ownerUserId,
            sourceDocumentId: context.sourceDocumentId,
            importJobId: context.importJobId,
            recordType: record.recordType,
            parserName: definition.name,
            parserVersion: definition.version,
            sourceText: record.sourceText ?? null,
            sourcePage: record.sourceReference?.page ?? null,
            sourceLocation: record.sourceReference?.location ?? null,
            extractionConfidence: record.confidence.toFixed(4),
            originalPayload: record.original,
            warnings: { items: record.warnings },
            reviewState: "needs_review"
          })
          .returning();

        if (!sourceRecord) {
          throw new Error("Failed to create source record for review placeholder");
        }

        sourceRecordCount += 1;

        const [reviewTask] = await db
          .insert(reviewTasks)
          .values({
            ownerUserId: context.ownerUserId,
            sourceRecordId: sourceRecord.id,
            resourceType: "source_document",
            resourceId: context.sourceDocumentId,
            reason: record.reason,
            confidence: record.confidence.toFixed(4),
            suggestedValue: record.suggestedValue
          })
          .returning();

        if (!reviewTask) {
          throw new Error("Failed to create review task for review placeholder");
        }

        await enqueueOutboxEvent(db, {
          eventType: "review_task.created",
          aggregateType: "source_document",
          aggregateId: context.sourceDocumentId,
          ownerUserId: context.ownerUserId,
          actor,
          payload: {
            reason: record.reason,
            sourceRecordId: sourceRecord.id,
            reviewTaskId: reviewTask.id
          }
        });

        await writeAuditEvent(db, {
          action: "review_task.created",
          resourceType: "review_task",
          resourceId: reviewTask.id,
          ownerUserId: context.ownerUserId,
          actor,
          metadata: {
            sourceDocumentId: context.sourceDocumentId,
            sourceRecordId: sourceRecord.id,
            reason: record.reason
          }
        });

        reviewTaskCount += 1;
      }

      return {
        sourceRecordCount,
        canonicalRecordCount: 0,
        reviewTaskCount
      };
    }
  };
}

export const pdfPlaceholderParser = createPlaceholderParser({
  name: "openvitals.pdf_review_placeholder",
  version: "0.1.0",
  classification: "pdf_review_placeholder",
  recordType: "unsupported",
  reason: "pdf_requires_review",
  supportedMimeTypes: ["application/pdf"],
  extensions: [".pdf"],
  message: "PDF extraction is not enabled yet, so this document requires manual review."
});

export const imagePlaceholderParser = createPlaceholderParser({
  name: "openvitals.image_review_placeholder",
  version: "0.1.0",
  classification: "image_review_placeholder",
  recordType: "unsupported",
  reason: "image_requires_review",
  supportedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/heic", "image/webp"],
  extensions: [".png", ".jpg", ".jpeg", ".heic", ".webp"],
  message: "Image extraction is not enabled yet, so this image requires manual review."
});
