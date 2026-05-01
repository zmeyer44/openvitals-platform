import { z } from "zod";
import { recordCategories, reviewActions } from "./types";

const decimalLikeSchema = z.union([z.string(), z.number()]).nullable().optional();

export const observationDraftSchema = z
  .object({
    displayName: z.string().trim().min(1),
    category: z.enum(recordCategories).default("labs"),
    observedAt: z.coerce.date().nullable().optional(),
    observedAtUnknown: z.boolean().default(false),
    originalValue: z.string().nullable().optional(),
    valueNumeric: decimalLikeSchema,
    valueText: z.string().nullable().optional(),
    unitOriginal: z.string().nullable().optional(),
    unitNormalized: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1).nullable().optional(),
    sourceText: z.string().nullable().optional()
  })
  .superRefine((value, ctx) => {
    if (!value.observedAt && !value.observedAtUnknown) {
      ctx.addIssue({
        code: "custom",
        path: ["observedAt"],
        message: "Missing observation dates must be represented as unknown or review-needed."
      });
    }
  });

export type ObservationDraft = z.infer<typeof observationDraftSchema>;

export const reviewResolutionSchema = z
  .object({
    action: z.enum(reviewActions),
    note: z.string().trim().max(2000).optional(),
    corrections: z.record(z.string(), z.unknown()).optional(),
    mergeIntoResourceId: z.uuid().optional()
  })
  .superRefine((value, ctx) => {
    if (value.action === "correct" && (!value.corrections || Object.keys(value.corrections).length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["corrections"],
        message: "Corrections require at least one field to update."
      });
    }
    if (value.action === "merge_duplicate" && !value.mergeIntoResourceId) {
      ctx.addIssue({
        code: "custom",
        path: ["mergeIntoResourceId"],
        message: "Merging a duplicate requires the canonical record id to keep."
      });
    }
    if (value.action === "attach_note" && (!value.note || value.note.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Attaching a note requires note text."
      });
    }
  });

export type ReviewResolution = z.infer<typeof reviewResolutionSchema>;

export const observationCorrectionSchema = z
  .object({
    displayName: z.string().trim().min(1),
    category: z.enum(recordCategories),
    observedAt: z.coerce.date().nullable(),
    observedAtUnknown: z.boolean(),
    originalValue: z.string().nullable(),
    valueNumeric: decimalLikeSchema,
    valueText: z.string().nullable(),
    normalizedValueNumeric: decimalLikeSchema,
    unitOriginal: z.string().nullable(),
    unitNormalized: z.string().nullable(),
    referenceRangeLow: decimalLikeSchema,
    referenceRangeHigh: decimalLikeSchema,
    interpretation: z.string().nullable(),
    loincCode: z.string().nullable()
  })
  .partial();

export type ObservationCorrection = z.infer<typeof observationCorrectionSchema>;

export const conditionCorrectionSchema = z
  .object({
    displayName: z.string().trim().min(1),
    snomedCode: z.string().nullable(),
    icd10Code: z.string().nullable(),
    clinicalStatus: z.string().nullable(),
    verificationStatus: z.string().nullable(),
    onsetAt: z.coerce.date().nullable(),
    abatementAt: z.coerce.date().nullable(),
    notes: z.string().nullable()
  })
  .partial();

export type ConditionCorrection = z.infer<typeof conditionCorrectionSchema>;

export const medicationCorrectionSchema = z
  .object({
    displayName: z.string().trim().min(1),
    rxnormCode: z.string().nullable(),
    dosageText: z.string().nullable(),
    route: z.string().nullable(),
    frequency: z.string().nullable(),
    startedAt: z.coerce.date().nullable(),
    stoppedAt: z.coerce.date().nullable(),
    active: z.boolean()
  })
  .partial();

export type MedicationCorrection = z.infer<typeof medicationCorrectionSchema>;

export const encounterCorrectionSchema = z
  .object({
    encounterType: z.string().nullable(),
    providerName: z.string().nullable(),
    facilityName: z.string().nullable(),
    startedAt: z.coerce.date().nullable(),
    endedAt: z.coerce.date().nullable(),
    reason: z.string().nullable()
  })
  .partial();

export type EncounterCorrection = z.infer<typeof encounterCorrectionSchema>;

export const canonicalResourceTypes = ["observation", "condition", "medication", "encounter"] as const;
export type CanonicalResourceType = (typeof canonicalResourceTypes)[number];

export const reviewBuckets = ["trusted", "review_needed", "ignored", "unknown"] as const;
export type ReviewBucket = (typeof reviewBuckets)[number];

export function parseNullableDecimal(input: unknown): string | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === "string" && input.trim() === "") {
    return null;
  }

  const value = typeof input === "number" ? input : Number(String(input).trim());
  if (!Number.isFinite(value)) {
    return null;
  }

  return String(value);
}

export function confidenceNeedsReview(confidence: number | null | undefined, threshold = 0.85): boolean {
  return confidence === null || confidence === undefined || confidence < threshold;
}

export function buildReviewReasons(input: {
  confidence?: number | null;
  observedAt?: Date | null;
  observedAtUnknown?: boolean;
  numericExpected?: boolean;
  numericValue?: string | null;
}): string[] {
  const reasons: string[] = [];

  if (confidenceNeedsReview(input.confidence)) {
    reasons.push("low_confidence");
  }

  if (!input.observedAt || input.observedAtUnknown) {
    reasons.push("missing_date");
  }

  if (input.numericExpected && input.numericValue === null) {
    reasons.push("missing_numeric_value");
  }

  return [...new Set(reasons)];
}
