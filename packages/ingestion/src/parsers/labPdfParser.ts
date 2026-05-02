import {
  observations,
  provenance,
  reviewTasks,
  sourceRecords,
  type OpenVitalsDbExecutor
} from "@openvitals/database";
import {
  buildReviewReasons,
  parseNullableDecimal,
  workerActor,
  type ReviewReason,
  type Warning
} from "@openvitals/domain";
import { enqueueOutboxEvent, writeAuditEvent } from "@openvitals/events";
import type {
  ClassificationResult,
  HealthDataParser,
  ImportFile,
  MaterializeContext,
  MaterializeResult,
  NormalizedObservation,
  NormalizedRecord,
  NormalizedReviewPlaceholder,
  ParsedRecord
} from "../contracts";
import {
  PDF_EXTRACTOR_PROMPT_VERSION,
  extractObservationsFromPdf,
  type ExtractObservationsFn,
  type ExtractedObservation,
  type PdfExtractionResult
} from "../pdf/extractObservations";

const parserName = "openvitals.lab_pdf";
const parserVersion = "0.1.0";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF-");

const PLACEHOLDER_TEMPORARY_ID = "pdf-placeholder";

function looksLikePdf(file: ImportFile): boolean {
  if (file.mimeType?.toLowerCase() === "application/pdf") return true;
  if (file.fileName?.toLowerCase().endsWith(".pdf")) return true;
  if (file.bytes.length >= PDF_MAGIC.length && file.bytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    return true;
  }
  return false;
}

function parseOptionalDate(input: string | null): { date: Date | null; warning?: Warning } {
  if (input === null || input.trim() === "") {
    return { date: null };
  }
  const date = new Date(input);
  if (Number.isNaN(date.valueOf())) {
    return {
      date: null,
      warning: {
        code: "invalid_date",
        message: "Date could not be parsed and was stored as unknown.",
        severity: "warning"
      }
    };
  }
  return { date };
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(4));
}

function toCategory(input: ExtractedObservation["category"]): "labs" | "vitals" {
  return input === "vitals" ? "vitals" : "labs";
}

function buildPlaceholderRecord(reason: ReviewReason, message: string, original: Record<string, unknown>): ParsedRecord {
  return {
    temporaryId: PLACEHOLDER_TEMPORARY_ID,
    kind: "note",
    sourceText: message,
    original,
    confidence: 0.5,
    warnings: [
      {
        code: reason,
        message,
        severity: "warning"
      }
    ]
  };
}

function isPlaceholder(record: ParsedRecord): boolean {
  return record.temporaryId === PLACEHOLDER_TEMPORARY_ID;
}

export type CreateLabPdfParserOptions = {
  extract?: ExtractObservationsFn;
};

export function createLabPdfParser(options: CreateLabPdfParserOptions = {}): HealthDataParser {
  const extract = options.extract ?? extractObservationsFromPdf;

  return {
    name: parserName,
    version: parserVersion,

    async classify(file: ImportFile): Promise<ClassificationResult> {
      if (!looksLikePdf(file)) {
        return {
          supported: false,
          classification: "unsupported",
          confidence: 0,
          warnings: [
            {
              code: "unsupported_mime_type",
              message: "The lab PDF parser only supports PDF files.",
              severity: "info"
            }
          ]
        };
      }

      if (file.bytes.length > MAX_PDF_BYTES) {
        return {
          supported: false,
          classification: "pdf_too_large",
          confidence: 0,
          warnings: [
            {
              code: "pdf_too_large",
              message: `PDF exceeds the ${MAX_PDF_BYTES} byte cap for AI extraction.`,
              severity: "warning"
            }
          ]
        };
      }

      return {
        supported: true,
        classification: "lab_pdf",
        confidence: 0.97,
        warnings: []
      };
    },

    async parse(file: ImportFile): Promise<ParsedRecord[]> {
      let extraction: PdfExtractionResult;
      try {
        extraction = await extract({
          bytes: file.bytes,
          fileName: file.fileName,
          signal: AbortSignal.timeout(60_000)
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return [
          buildPlaceholderRecord("pdf_extraction_failed", `PDF extraction failed: ${message.slice(0, 500)}`, {
            fileName: file.fileName,
            mimeType: file.mimeType,
            sha256: file.sha256,
            error: message.slice(0, 500),
            promptVersion: PDF_EXTRACTOR_PROMPT_VERSION
          })
        ];
      }

      if (extraction.observations.length === 0) {
        const note = extraction.documentNotes?.trim()
          ? extraction.documentNotes
          : "The model could not extract any laboratory or vital observations from this PDF.";

        return [
          buildPlaceholderRecord("pdf_extraction_failed", note, {
            fileName: file.fileName,
            mimeType: file.mimeType,
            sha256: file.sha256,
            documentNotes: extraction.documentNotes,
            model: extraction.modelUsed,
            promptVersion: extraction.promptVersion
          })
        ];
      }

      return extraction.observations.map((observation, index) => {
        const sourcePage = observation.sourcePage ?? undefined;
        const original: Record<string, unknown> = {
          ...observation,
          model: extraction.modelUsed,
          promptVersion: extraction.promptVersion
        };

        const parsed: ParsedRecord = {
          temporaryId: `pdf-row-${index + 1}`,
          kind: "observation",
          sourceText: observation.sourceText,
          ...(sourcePage !== undefined ? { sourceReference: { page: sourcePage, text: observation.sourceText } } : {}),
          original,
          confidence: clampConfidence(observation.confidence),
          warnings: []
        };

        return parsed;
      });
    },

    async normalize(records: ParsedRecord[]): Promise<NormalizedRecord[]> {
      return records.map((record): NormalizedRecord => {
        if (isPlaceholder(record)) {
          const placeholder: NormalizedReviewPlaceholder = {
            temporaryId: record.temporaryId,
            kind: "review_placeholder",
            recordType: "note",
            reason: "pdf_extraction_failed",
            confidence: record.confidence,
            ...(record.sourceText ? { sourceText: record.sourceText } : {}),
            ...(record.sourceReference ? { sourceReference: record.sourceReference } : {}),
            original: record.original,
            warnings: record.warnings,
            suggestedValue: {
              ...record.original,
              classification: "lab_pdf",
              message: record.sourceText ?? "PDF could not be extracted into observations."
            }
          };
          return placeholder;
        }

        const original = record.original as ExtractedObservation & { model?: string; promptVersion?: string };

        const parsedDate = parseOptionalDate(original.observedAt);
        const valueNumeric = original.valueNumeric !== null
          ? parseNullableDecimal(original.valueNumeric)
          : parseNullableDecimal(original.valueRaw);
        const valueText = valueNumeric === null && original.valueRaw.trim() !== "" ? original.valueRaw : null;
        const warnings = [...record.warnings];
        if (parsedDate.warning) {
          warnings.push(parsedDate.warning);
        }

        const reviewReasons = buildReviewReasons({
          confidence: record.confidence,
          observedAt: parsedDate.date,
          observedAtUnknown: parsedDate.date === null,
          numericExpected: valueText === null,
          numericValue: valueNumeric
        }) as ReviewReason[];

        const observation: NormalizedObservation = {
          temporaryId: record.temporaryId,
          kind: "observation",
          displayName: original.displayName,
          category: toCategory(original.category),
          observedAt: parsedDate.date,
          observedAtUnknown: parsedDate.date === null,
          originalValue: original.valueRaw.trim() === "" ? null : original.valueRaw,
          valueNumeric,
          valueText,
          unitOriginal: original.unitOriginal && original.unitOriginal.trim() !== "" ? original.unitOriginal : null,
          unitNormalized: original.unitOriginal && original.unitOriginal.trim() !== "" ? original.unitOriginal : null,
          confidence: record.confidence,
          ...(record.sourceText ? { sourceText: record.sourceText } : {}),
          ...(record.sourceReference ? { sourceReference: record.sourceReference } : {}),
          original: record.original,
          warnings,
          reviewReasons
        };

        return observation;
      });
    },

    async materialize(
      db: OpenVitalsDbExecutor,
      records: NormalizedRecord[],
      context: MaterializeContext
    ): Promise<MaterializeResult> {
      let sourceRecordCount = 0;
      let canonicalRecordCount = 0;
      let reviewTaskCount = 0;
      const actor = workerActor(context.actorId);

      for (const record of records) {
        if (record.kind === "review_placeholder") {
          const [sourceRecord] = await db
            .insert(sourceRecords)
            .values({
              ownerUserId: context.ownerUserId,
              sourceDocumentId: context.sourceDocumentId,
              importJobId: context.importJobId,
              recordType: record.recordType,
              parserName,
              parserVersion,
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
            throw new Error("Failed to create source record for PDF placeholder");
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
            throw new Error("Failed to create review task for PDF placeholder");
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
          continue;
        }

        if (record.kind !== "observation") {
          continue;
        }

        const reviewState = record.reviewReasons.length > 0 ? "needs_review" : "not_required";
        const original = record.original as Record<string, unknown> & { model?: string; promptVersion?: string };
        const model = typeof original.model === "string" ? original.model : null;
        const promptVersion = typeof original.promptVersion === "string" ? original.promptVersion : null;

        const [sourceRecord] = await db
          .insert(sourceRecords)
          .values({
            ownerUserId: context.ownerUserId,
            sourceDocumentId: context.sourceDocumentId,
            importJobId: context.importJobId,
            recordType: "observation",
            parserName,
            parserVersion,
            sourceText: record.sourceText ?? null,
            sourcePage: record.sourceReference?.page ?? null,
            sourceLocation: record.sourceReference?.location ?? null,
            extractionConfidence: record.confidence.toFixed(4),
            originalPayload: record.original,
            warnings: { items: record.warnings },
            reviewState
          })
          .returning();

        if (!sourceRecord) {
          throw new Error("Failed to create source record for PDF observation");
        }

        sourceRecordCount += 1;

        const [observation] = await db
          .insert(observations)
          .values({
            ownerUserId: context.ownerUserId,
            sourceRecordId: sourceRecord.id,
            category: record.category,
            displayName: record.displayName,
            observedAt: record.observedAt,
            observedAtUnknown: record.observedAtUnknown,
            originalValue: record.originalValue,
            valueNumeric: record.valueNumeric,
            valueText: record.valueText,
            normalizedValueNumeric: record.valueNumeric,
            unitOriginal: record.unitOriginal,
            unitNormalized: record.unitNormalized,
            confidence: record.confidence.toFixed(4),
            reviewState,
            trustLevel: "ai_extracted",
            metadata: {
              parserName,
              parserVersion,
              model,
              promptVersion,
              sourceReference: record.sourceReference ?? null
            }
          })
          .returning();

        if (!observation) {
          throw new Error("Failed to create observation");
        }

        canonicalRecordCount += 1;

        await db.insert(provenance).values({
          ownerUserId: context.ownerUserId,
          resourceType: "observation",
          resourceId: observation.id,
          sourceDocumentId: context.sourceDocumentId,
          sourceRecordId: sourceRecord.id,
          importJobId: context.importJobId,
          actorType: "worker",
          actorId: context.actorId,
          derivation: "ai_extracted_from_pdf",
          parserName,
          parserVersion,
          confidence: record.confidence.toFixed(4),
          metadata: {
            model,
            promptVersion,
            reviewReasons: record.reviewReasons
          }
        });

        await enqueueOutboxEvent(db, {
          eventType: "observation.created",
          aggregateType: "observation",
          aggregateId: observation.id,
          ownerUserId: context.ownerUserId,
          actor,
          payload: {
            sourceDocumentId: context.sourceDocumentId,
            sourceRecordId: sourceRecord.id,
            reviewState
          }
        });

        await writeAuditEvent(db, {
          action: "observation.created",
          resourceType: "observation",
          resourceId: observation.id,
          ownerUserId: context.ownerUserId,
          actor,
          metadata: {
            sourceDocumentId: context.sourceDocumentId,
            sourceRecordId: sourceRecord.id,
            trustLevel: "ai_extracted"
          }
        });

        for (const reason of record.reviewReasons) {
          await db.insert(reviewTasks).values({
            ownerUserId: context.ownerUserId,
            sourceRecordId: sourceRecord.id,
            resourceType: "observation",
            resourceId: observation.id,
            reason,
            confidence: record.confidence.toFixed(4),
            suggestedValue: {
              displayName: record.displayName,
              originalValue: record.originalValue,
              valueNumeric: record.valueNumeric,
              valueText: record.valueText,
              unitOriginal: record.unitOriginal,
              observedAt: record.observedAt?.toISOString() ?? null
            }
          });

          await enqueueOutboxEvent(db, {
            eventType: "review_task.created",
            aggregateType: "observation",
            aggregateId: observation.id,
            ownerUserId: context.ownerUserId,
            actor,
            payload: {
              reason,
              sourceRecordId: sourceRecord.id
            }
          });

          reviewTaskCount += 1;
        }
      }

      return {
        sourceRecordCount,
        canonicalRecordCount,
        reviewTaskCount
      };
    }
  };
}

export const labPdfParser = createLabPdfParser();
