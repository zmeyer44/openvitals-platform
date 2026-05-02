import { z } from "zod";

export const intakeStepKeys = [
  "profile",
  "conditions",
  "medications",
  "allergies",
  "family_history",
  "lifestyle",
  "notes"
] as const;

export type IntakeStepKey = (typeof intakeStepKeys)[number];

export const intakeAnswerKinds = [
  "profile_field",
  "condition",
  "medication",
  "note",
  "family_history",
  "lifestyle"
] as const;

export type IntakeAnswerKind = (typeof intakeAnswerKinds)[number];

const trimmedString = (max = 1000) => z.string().trim().min(1).max(max);

export const profileFieldAnswerSchema = z.object({
  kind: z.literal("profile_field"),
  field: z.enum(["dateOfBirth", "sexAtBirth", "genderIdentity", "bloodType"]),
  value: z.union([z.string().trim().max(200).nullable(), z.coerce.date()])
});

export const conditionAnswerSchema = z.object({
  kind: z.literal("condition"),
  displayName: trimmedString(200),
  clinicalStatus: z.string().trim().max(60).optional(),
  verificationStatus: z.string().trim().max(60).optional(),
  onsetAt: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(2000).optional()
});

export const medicationAnswerSchema = z.object({
  kind: z.literal("medication"),
  displayName: trimmedString(200),
  dosageText: z.string().trim().max(200).optional(),
  route: z.string().trim().max(60).optional(),
  frequency: z.string().trim().max(120).optional(),
  active: z.boolean().default(true),
  startedAt: z.coerce.date().nullable().optional(),
  stoppedAt: z.coerce.date().nullable().optional()
});

export const noteAnswerSchema = z.object({
  kind: z.literal("note"),
  text: trimmedString(2000),
  topic: z.string().trim().max(200).optional()
});

export const familyHistoryAnswerSchema = z.object({
  kind: z.literal("family_history"),
  relation: z.string().trim().max(60),
  condition: trimmedString(200),
  notes: z.string().trim().max(2000).optional()
});

export const lifestyleAnswerSchema = z.object({
  kind: z.literal("lifestyle"),
  topic: z.string().trim().max(60),
  detail: trimmedString(2000)
});

export const intakeAnswerPayloadSchema = z.discriminatedUnion("kind", [
  profileFieldAnswerSchema,
  conditionAnswerSchema,
  medicationAnswerSchema,
  noteAnswerSchema,
  familyHistoryAnswerSchema,
  lifestyleAnswerSchema
]);

export type IntakeAnswerPayload = z.infer<typeof intakeAnswerPayloadSchema>;

export const intakeAnswerInputSchema = z.object({
  answerKey: z.string().trim().min(1).max(120),
  payload: intakeAnswerPayloadSchema
});

export type IntakeAnswerInput = z.infer<typeof intakeAnswerInputSchema>;

export const intakeStepKeySchema = z.enum(intakeStepKeys);

export const saveIntakeStepBodySchema = z.object({
  stepKey: intakeStepKeySchema,
  answers: z.array(intakeAnswerInputSchema).min(1),
  advanceTo: intakeStepKeySchema.nullable().optional()
});

export type SaveIntakeStepBody = z.infer<typeof saveIntakeStepBodySchema>;

export const skipIntakeStepBodySchema = z.object({
  stepKey: intakeStepKeySchema,
  reason: z.string().trim().max(500).optional(),
  advanceTo: intakeStepKeySchema.nullable().optional()
});

export type SkipIntakeStepBody = z.infer<typeof skipIntakeStepBodySchema>;

export const completeIntakeBodySchema = z
  .object({
    note: z.string().trim().max(2000).optional()
  })
  .optional();

export type CompleteIntakeBody = z.infer<typeof completeIntakeBodySchema>;

const profileFieldsByKey: Record<
  z.infer<typeof profileFieldAnswerSchema>["field"],
  "dateOfBirth" | "sexAtBirth" | "genderIdentity" | "bloodType"
> = {
  dateOfBirth: "dateOfBirth",
  sexAtBirth: "sexAtBirth",
  genderIdentity: "genderIdentity",
  bloodType: "bloodType"
};

export function profileFieldColumn(field: z.infer<typeof profileFieldAnswerSchema>["field"]): string {
  return profileFieldsByKey[field];
}

export function defaultStepOrder(): readonly IntakeStepKey[] {
  return intakeStepKeys;
}

export function nextIntakeStep(current: IntakeStepKey): IntakeStepKey | null {
  const order = defaultStepOrder();
  const index = order.indexOf(current);
  if (index < 0 || index >= order.length - 1) {
    return null;
  }
  return order[index + 1] ?? null;
}
