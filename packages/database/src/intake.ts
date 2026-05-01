import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import type { OpenVitalsDbExecutor } from "./client";
import {
  intakeAnswers,
  intakeWorkflows,
  type JsonObject
} from "./schema";

export type IntakeWorkflow = typeof intakeWorkflows.$inferSelect;
export type IntakeWorkflowStatus = IntakeWorkflow["status"];
export type IntakeAnswer = typeof intakeAnswers.$inferSelect;

export type StartIntakeWorkflowInput = {
  ownerUserId: string;
  currentStep?: string | undefined;
};

export async function findActiveIntakeWorkflow(
  db: OpenVitalsDbExecutor,
  input: { ownerUserId: string }
): Promise<IntakeWorkflow | null> {
  const [row] = await db
    .select()
    .from(intakeWorkflows)
    .where(
      and(
        eq(intakeWorkflows.ownerUserId, input.ownerUserId),
        eq(intakeWorkflows.status, "in_progress")
      )
    )
    .orderBy(desc(intakeWorkflows.createdAt))
    .limit(1);

  return row ?? null;
}

export async function getIntakeWorkflowById(
  db: OpenVitalsDbExecutor,
  input: { ownerUserId: string; workflowId: string }
): Promise<IntakeWorkflow | null> {
  const [row] = await db
    .select()
    .from(intakeWorkflows)
    .where(
      and(
        eq(intakeWorkflows.ownerUserId, input.ownerUserId),
        eq(intakeWorkflows.id, input.workflowId)
      )
    )
    .limit(1);

  return row ?? null;
}

export async function startIntakeWorkflow(
  db: OpenVitalsDbExecutor,
  input: StartIntakeWorkflowInput
): Promise<IntakeWorkflow> {
  const [row] = await db
    .insert(intakeWorkflows)
    .values({
      ownerUserId: input.ownerUserId,
      status: "in_progress",
      currentStep: input.currentStep ?? null,
      skippedSteps: []
    })
    .returning();

  if (!row) {
    throw new Error("Failed to start intake workflow");
  }

  return row;
}

export type UpdateIntakeWorkflowInput = {
  ownerUserId: string;
  workflowId: string;
  currentStep?: string | null | undefined;
  status?: IntakeWorkflowStatus | undefined;
  appendSkippedStep?: string | undefined;
  completedAt?: Date | null | undefined;
};

export async function updateIntakeWorkflow(
  db: OpenVitalsDbExecutor,
  input: UpdateIntakeWorkflowInput
): Promise<IntakeWorkflow | null> {
  const update: Partial<typeof intakeWorkflows.$inferInsert> = {
    updatedAt: new Date()
  };

  if (input.currentStep !== undefined) {
    update.currentStep = input.currentStep;
  }

  if (input.status !== undefined) {
    update.status = input.status;
  }

  if (input.completedAt !== undefined) {
    update.completedAt = input.completedAt;
  }

  if (input.appendSkippedStep !== undefined) {
    const stepKey = input.appendSkippedStep;
    update.skippedSteps = sql`(
      select coalesce(jsonb_agg(distinct value), '[]'::jsonb)
      from jsonb_array_elements_text(${intakeWorkflows.skippedSteps} || ${JSON.stringify([
        stepKey
      ])}::jsonb) as value
    )` as unknown as string[];
  }

  const [row] = await db
    .update(intakeWorkflows)
    .set(update)
    .where(
      and(
        eq(intakeWorkflows.ownerUserId, input.ownerUserId),
        eq(intakeWorkflows.id, input.workflowId)
      )
    )
    .returning();

  return row ?? null;
}

export type UpsertIntakeAnswerInput = {
  workflowId: string;
  ownerUserId: string;
  stepKey: string;
  answerKey: string;
  answerValue: JsonObject | null;
  skipped?: boolean | undefined;
  canonicalResourceType?: string | null | undefined;
  canonicalResourceId?: string | null | undefined;
};

export async function upsertIntakeAnswer(
  db: OpenVitalsDbExecutor,
  input: UpsertIntakeAnswerInput
): Promise<IntakeAnswer> {
  const now = new Date();
  const [row] = await db
    .insert(intakeAnswers)
    .values({
      workflowId: input.workflowId,
      ownerUserId: input.ownerUserId,
      stepKey: input.stepKey,
      answerKey: input.answerKey,
      answerValue: input.answerValue,
      skipped: input.skipped ?? false,
      canonicalResourceType: input.canonicalResourceType ?? null,
      canonicalResourceId: input.canonicalResourceId ?? null,
      answeredAt: now
    })
    .onConflictDoUpdate({
      target: [intakeAnswers.workflowId, intakeAnswers.stepKey, intakeAnswers.answerKey],
      set: {
        answerValue: input.answerValue,
        skipped: input.skipped ?? false,
        canonicalResourceType: input.canonicalResourceType ?? null,
        canonicalResourceId: input.canonicalResourceId ?? null,
        answeredAt: now
      }
    })
    .returning();

  if (!row) {
    throw new Error("Failed to persist intake answer");
  }

  return row;
}

export async function listIntakeAnswers(
  db: OpenVitalsDbExecutor,
  input: { ownerUserId: string; workflowId: string; stepKey?: string | undefined }
): Promise<IntakeAnswer[]> {
  const filters: SQL[] = [
    eq(intakeAnswers.ownerUserId, input.ownerUserId),
    eq(intakeAnswers.workflowId, input.workflowId)
  ];

  if (input.stepKey) {
    filters.push(eq(intakeAnswers.stepKey, input.stepKey));
  }

  return db
    .select()
    .from(intakeAnswers)
    .where(and(...filters))
    .orderBy(asc(intakeAnswers.answeredAt), asc(intakeAnswers.id));
}

export async function deleteIntakeAnswersForStep(
  db: OpenVitalsDbExecutor,
  input: { ownerUserId: string; workflowId: string; stepKey: string }
): Promise<void> {
  await db
    .delete(intakeAnswers)
    .where(
      and(
        eq(intakeAnswers.ownerUserId, input.ownerUserId),
        eq(intakeAnswers.workflowId, input.workflowId),
        eq(intakeAnswers.stepKey, input.stepKey)
      )
    );
}
