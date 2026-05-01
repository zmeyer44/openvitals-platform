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

export const reviewResolutionSchema = z.object({
  action: z.enum(reviewActions),
  note: z.string().trim().max(2000).optional(),
  correctedValue: z.record(z.string(), z.unknown()).optional()
});

export type ReviewResolution = z.infer<typeof reviewResolutionSchema>;

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
