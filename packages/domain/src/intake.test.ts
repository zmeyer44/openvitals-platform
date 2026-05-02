import { describe, expect, it } from "vitest";
import {
  defaultStepOrder,
  intakeAnswerPayloadSchema,
  nextIntakeStep,
  saveIntakeStepBodySchema,
  skipIntakeStepBodySchema
} from "./intake";

describe("intake validators", () => {
  it("rejects unknown answer kinds via the discriminated union", () => {
    const result = intakeAnswerPayloadSchema.safeParse({ kind: "alien", text: "abduction" });
    expect(result.success).toBe(false);
  });

  it("validates a condition answer with optional clinical metadata", () => {
    const result = intakeAnswerPayloadSchema.safeParse({
      kind: "condition",
      displayName: "Type 2 diabetes",
      clinicalStatus: "active",
      onsetAt: "2020-04-12"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("condition");
      if (result.data.kind === "condition") {
        expect(result.data.onsetAt).toBeInstanceOf(Date);
      }
    }
  });

  it("requires medication active to default to true when omitted", () => {
    const result = intakeAnswerPayloadSchema.safeParse({
      kind: "medication",
      displayName: "Metformin"
    });

    expect(result.success).toBe(true);
    if (result.success && result.data.kind === "medication") {
      expect(result.data.active).toBe(true);
    }
  });

  it("rejects empty notes payloads", () => {
    const result = intakeAnswerPayloadSchema.safeParse({ kind: "note", text: "   " });
    expect(result.success).toBe(false);
  });

  it("requires at least one answer when saving a step", () => {
    const empty = saveIntakeStepBodySchema.safeParse({ stepKey: "conditions", answers: [] });
    expect(empty.success).toBe(false);

    const provided = saveIntakeStepBodySchema.safeParse({
      stepKey: "conditions",
      answers: [
        {
          answerKey: "primary",
          payload: { kind: "condition", displayName: "Hypertension" }
        }
      ]
    });
    expect(provided.success).toBe(true);
  });

  it("accepts skip requests with optional reason and advance target", () => {
    const result = skipIntakeStepBodySchema.safeParse({
      stepKey: "lifestyle",
      reason: "Will revisit later",
      advanceTo: "notes"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.advanceTo).toBe("notes");
    }
  });

  it("derives the next step in default order, returning null past the last step", () => {
    const order = defaultStepOrder();
    expect(order[0]).toBe("profile");
    expect(nextIntakeStep("profile")).toBe("conditions");
    expect(nextIntakeStep(order[order.length - 1] as never)).toBeNull();
  });
});
