import { parse } from "csv-parse/sync";
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
  ParsedRecord
} from "../contracts";

const parserName = "openvitals.lab_csv";
const parserVersion = "0.1.0";

const headerAliases = {
  name: ["test_name", "name", "component", "analyte", "lab"],
  value: ["value", "result", "result_value"],
  unit: ["unit", "units"],
  date: ["collected_at", "observed_at", "result_date", "date", "collection_date"]
} as const;

function findHeader(headers: string[], aliases: readonly string[]): string | undefined {
  const normalized = new Map(headers.map((header) => [header.toLowerCase().trim(), header]));
  return aliases.map((alias) => normalized.get(alias)).find(Boolean);
}

function rowText(row: Record<string, unknown>): string {
  return Object.entries(row)
    .map(([key, value]) => `${key}: ${String(value ?? "")}`)
    .join("; ");
}

function parseOptionalDate(input: unknown): { date: Date | null; warning?: Warning } {
  if (input === null || input === undefined || String(input).trim() === "") {
    return { date: null };
  }

  const date = new Date(String(input));
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

function confidenceFor(input: {
  hasDate: boolean;
  hasName: boolean;
  hasValue: boolean;
  invalidDate: boolean;
}): number {
  let confidence = 0.94;
  if (!input.hasName) confidence -= 0.4;
  if (!input.hasValue) confidence -= 0.2;
  if (!input.hasDate) confidence -= 0.25;
  if (input.invalidDate) confidence -= 0.2;
  return Math.max(0, Number(confidence.toFixed(4)));
}

export const labCsvParser: HealthDataParser = {
  name: parserName,
  version: parserVersion,

  async classify(file: ImportFile): Promise<ClassificationResult> {
    const isCsv =
      file.mimeType === "text/csv" ||
      file.mimeType === "application/csv" ||
      file.fileName.toLowerCase().endsWith(".csv");

    if (!isCsv) {
      return {
        supported: false,
        classification: "unsupported",
        confidence: 0,
        warnings: [
          {
            code: "unsupported_mime_type",
            message: "The lab CSV parser only supports CSV files.",
            severity: "info"
          }
        ]
      };
    }

    const rows = parse(file.bytes, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as Record<string, unknown>[];

    if (rows.length === 0) {
      return {
        supported: true,
        classification: "lab_csv",
        confidence: 0.9,
        empty: true,
        warnings: []
      };
    }

    const headers = Object.keys(rows[0] ?? {});
    const hasName = Boolean(findHeader(headers, headerAliases.name));
    const hasValue = Boolean(findHeader(headers, headerAliases.value));

    return {
      supported: hasName && hasValue,
      classification: hasName && hasValue ? "lab_csv" : "unsupported_csv",
      confidence: hasName && hasValue ? 0.9 : 0.2,
      warnings:
        hasName && hasValue
          ? []
          : [
              {
                code: "missing_required_headers",
                message: "CSV must include lab name and result value columns.",
                severity: "warning"
              }
            ]
    };
  },

  async parse(file: ImportFile): Promise<ParsedRecord[]> {
    const rows = parse(file.bytes, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as Record<string, unknown>[];

    return rows.map((row, index) => ({
      temporaryId: `row-${index + 1}`,
      kind: "observation",
      sourceText: rowText(row),
      sourceReference: { rowNumber: index + 1, text: rowText(row) },
      original: row,
      confidence: 0.9,
      warnings: []
    }));
  },

  async normalize(records: ParsedRecord[]): Promise<NormalizedRecord[]> {
    return records.map((record): NormalizedObservation => {
      const headers = Object.keys(record.original);
      const nameHeader = findHeader(headers, headerAliases.name);
      const valueHeader = findHeader(headers, headerAliases.value);
      const unitHeader = findHeader(headers, headerAliases.unit);
      const dateHeader = findHeader(headers, headerAliases.date);

      const rawName = nameHeader ? record.original[nameHeader] : undefined;
      const rawValue = valueHeader ? record.original[valueHeader] : undefined;
      const rawUnit = unitHeader ? record.original[unitHeader] : undefined;
      const rawDate = dateHeader ? record.original[dateHeader] : undefined;
      const parsedDate = parseOptionalDate(rawDate);
      const valueNumeric = parseNullableDecimal(rawValue);
      const valueText = valueNumeric === null && rawValue != null ? String(rawValue) : null;
      const warnings = [...record.warnings];

      if (parsedDate.warning) {
        warnings.push(parsedDate.warning);
      }

      const confidence = confidenceFor({
        hasDate: Boolean(parsedDate.date),
        hasName: Boolean(rawName),
        hasValue: rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== "",
        invalidDate: Boolean(parsedDate.warning)
      });

      const reviewReasons = buildReviewReasons({
        confidence,
        observedAt: parsedDate.date,
        observedAtUnknown: parsedDate.date === null,
        numericExpected: valueText === null,
        numericValue: valueNumeric
      }) as ReviewReason[];

      return {
        temporaryId: record.temporaryId,
        kind: "observation",
        displayName: String(rawName ?? "Unknown lab result"),
        category: "labs",
        observedAt: parsedDate.date,
        observedAtUnknown: parsedDate.date === null,
        originalValue: rawValue == null || String(rawValue).trim() === "" ? null : String(rawValue),
        valueNumeric,
        valueText,
        unitOriginal: rawUnit == null || String(rawUnit).trim() === "" ? null : String(rawUnit),
        unitNormalized: rawUnit == null || String(rawUnit).trim() === "" ? null : String(rawUnit),
        confidence,
        ...(record.sourceText ? { sourceText: record.sourceText } : {}),
        ...(record.sourceReference ? { sourceReference: record.sourceReference } : {}),
        original: record.original,
        warnings,
        reviewReasons
      };
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

    for (const record of records) {
      if (record.kind !== "observation") {
        continue;
      }

      const reviewState = record.reviewReasons.length > 0 ? "needs_review" : "not_required";
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
        throw new Error("Failed to create source record");
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
          trustLevel: "parser_extracted",
          metadata: {
            parserName,
            parserVersion,
            sourceReference: record.sourceReference ?? null
          }
        })
        .returning();

      if (!observation) {
        throw new Error("Failed to create observation");
      }

      canonicalRecordCount += 1;
      const actor = workerActor(context.actorId);

      await db.insert(provenance).values({
        ownerUserId: context.ownerUserId,
        resourceType: "observation",
        resourceId: observation.id,
        sourceDocumentId: context.sourceDocumentId,
        sourceRecordId: sourceRecord.id,
        importJobId: context.importJobId,
        actorType: "worker",
        actorId: context.actorId,
        derivation: "normalized_from_source_record",
        parserName,
        parserVersion,
        confidence: record.confidence.toFixed(4),
        metadata: {
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
          trustLevel: "parser_extracted"
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
