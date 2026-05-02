export const importJobStates = [
  "uploaded",
  "classified",
  "parsed",
  "normalized",
  "needs_review",
  "completed",
  "failed"
] as const;

export type ImportJobState = (typeof importJobStates)[number];

export const recordCategories = [
  "labs",
  "medications",
  "conditions",
  "vitals",
  "documents",
  "encounters",
  "family_history",
  "lifestyle",
  "notes"
] as const;

export type RecordCategory = (typeof recordCategories)[number];

export const reviewActions = [
  "confirm",
  "correct",
  "ignore",
  "merge_duplicate",
  "mark_unknown",
  "attach_note"
] as const;

export type ReviewAction = (typeof reviewActions)[number];

export const actorTypes = ["user", "recipient", "system", "worker", "admin", "integration"] as const;

export type ActorType = (typeof actorTypes)[number];

export type UserRole = "user" | "clinician" | "caregiver" | "admin";

export type UserActor = {
  type: "user";
  id: string;
};

export type RecipientActor = {
  type: "recipient";
  id: string;
};

export type WorkerActor = {
  type: "worker";
  id: string;
};

export type AdminActor = {
  type: "admin";
  id: string;
};

export type IntegrationActor = {
  type: "integration";
  id: string;
};

export type SystemActor = {
  type: "system";
  id?: string;
};

export type Actor =
  | UserActor
  | RecipientActor
  | WorkerActor
  | AdminActor
  | IntegrationActor
  | SystemActor;

export function actorForUser(input: { id: string; role?: UserRole }): UserActor | AdminActor {
  return input.role === "admin" ? { type: "admin", id: input.id } : { type: "user", id: input.id };
}

export function recipientActor(id: string): RecipientActor {
  return { type: "recipient", id };
}

export function workerActor(id: string): WorkerActor {
  return { type: "worker", id };
}

export function integrationActor(id: string): IntegrationActor {
  return { type: "integration", id };
}

export function systemActor(id?: string): SystemActor {
  return id ? { type: "system", id } : { type: "system" };
}

export type SourceReference = {
  page?: number;
  rowNumber?: number;
  text?: string;
  location?: Record<string, unknown>;
};

export type Warning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export type ReviewReason =
  | "low_confidence"
  | "missing_date"
  | "missing_numeric_value"
  | "unsupported_format"
  | "empty_import"
  | "ambiguous_unit"
  | "duplicate_candidate"
  | "pdf_extraction_failed";
