import { describe, expect, it } from "vitest";
import { actorForUser, integrationActor, recipientActor, systemActor, workerActor } from "./types";
import {
  buildReviewReasons,
  observationCorrectionSchema,
  observationDraftSchema,
  parseNullableDecimal,
  reviewResolutionSchema
} from "./validators";

describe("health record validators", () => {
  it("does not fabricate a date when one is missing", () => {
    const result = observationDraftSchema.safeParse({
      displayName: "Hemoglobin",
      originalValue: "13.2",
      valueNumeric: "13.2"
    });

    expect(result.success).toBe(false);
  });

  it("preserves missing numeric values as null instead of zero", () => {
    expect(parseNullableDecimal("")).toBeNull();
    expect(parseNullableDecimal(null)).toBeNull();
    expect(parseNullableDecimal("0")).toBe("0");
  });

  it("creates review reasons for missing dates and low confidence", () => {
    expect(
      buildReviewReasons({
        confidence: 0.4,
        observedAt: null,
        numericExpected: true,
        numericValue: null
      })
    ).toEqual(["low_confidence", "missing_date", "missing_numeric_value"]);
  });

  it("requires corrections payloads when the action is 'correct'", () => {
    const missing = reviewResolutionSchema.safeParse({ action: "correct" });
    expect(missing.success).toBe(false);

    const provided = reviewResolutionSchema.safeParse({
      action: "correct",
      corrections: { displayName: "Hemoglobin A1c" }
    });
    expect(provided.success).toBe(true);
  });

  it("requires merge target id when the action is 'merge_duplicate'", () => {
    const missing = reviewResolutionSchema.safeParse({ action: "merge_duplicate" });
    expect(missing.success).toBe(false);

    const provided = reviewResolutionSchema.safeParse({
      action: "merge_duplicate",
      mergeIntoResourceId: "00000000-0000-4000-8000-000000000000"
    });
    expect(provided.success).toBe(true);
  });

  it("rejects empty notes for 'attach_note' but accepts non-empty notes", () => {
    const empty = reviewResolutionSchema.safeParse({ action: "attach_note" });
    expect(empty.success).toBe(false);

    const provided = reviewResolutionSchema.safeParse({
      action: "attach_note",
      note: "Follow up with lab"
    });
    expect(provided.success).toBe(true);
  });

  it("treats missing observation correction fields as no-ops", () => {
    const result = observationCorrectionSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(Object.keys(result.data ?? {})).toHaveLength(0);
  });

  it("defines actor identities for audit and provenance boundaries", () => {
    expect(actorForUser({ id: "user-1", role: "user" })).toEqual({ type: "user", id: "user-1" });
    expect(actorForUser({ id: "admin-1", role: "admin" })).toEqual({ type: "admin", id: "admin-1" });
    expect(recipientActor("recipient-1")).toEqual({ type: "recipient", id: "recipient-1" });
    expect(workerActor("worker-1")).toEqual({ type: "worker", id: "worker-1" });
    expect(integrationActor("integration-1")).toEqual({ type: "integration", id: "integration-1" });
    expect(systemActor()).toEqual({ type: "system" });
  });
});
