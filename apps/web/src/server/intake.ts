import { and, eq } from "drizzle-orm";
import {
  conditions,
  deleteIntakeAnswersForStep,
  findActiveIntakeWorkflow,
  getIntakeWorkflowById,
  intakeWorkflows,
  listIntakeAnswers,
  medications,
  provenance,
  reviewTasks,
  sourceDocuments,
  sourceRecords,
  startIntakeWorkflow,
  updateIntakeWorkflow,
  upsertIntakeAnswer,
  userProfiles,
  writeRecordRevision,
  type IntakeAnswer,
  type IntakeWorkflow,
  type JsonObject,
  type OpenVitalsDatabase,
  type OpenVitalsDbExecutor
} from "@openvitals/database";
import {
  intakeStepKeys,
  nextIntakeStep,
  type CompleteIntakeBody,
  type IntakeAnswerInput,
  type IntakeAnswerPayload,
  type IntakeStepKey,
  type SaveIntakeStepBody,
  type SkipIntakeStepBody
} from "@openvitals/domain";
import { enqueueOutboxEvent, writeAuditEvent } from "@openvitals/events";
import type { AuthenticatedOwnerContext } from "./ownership";

export class IntakeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "IntakeApiError";
  }
}

const INTAKE_PARSER_NAME = "openvitals.intake";
const INTAKE_PARSER_VERSION = "0.1.0";

export type IntakeWorkflowDetail = {
  workflow: IntakeWorkflow;
  answers: IntakeAnswer[];
};

async function loadDetail(
  db: OpenVitalsDbExecutor,
  ownerUserId: string,
  workflow: IntakeWorkflow
): Promise<IntakeWorkflowDetail> {
  const answers = await listIntakeAnswers(db, {
    ownerUserId,
    workflowId: workflow.id
  });

  return { workflow, answers };
}

export async function startOrResumeIntake(
  database: OpenVitalsDatabase,
  input: { owner: Pick<AuthenticatedOwnerContext, "ownerUserId" | "actor"> }
): Promise<IntakeWorkflowDetail & { resumed: boolean }> {
  try {
    return await database.transaction(async (tx) => {
      const existing = await findActiveIntakeWorkflow(tx, { ownerUserId: input.owner.ownerUserId });
      if (existing) {
        const detail = await loadDetail(tx, input.owner.ownerUserId, existing);
        return { ...detail, resumed: true };
      }

      const workflow = await startIntakeWorkflow(tx, {
        ownerUserId: input.owner.ownerUserId,
        currentStep: intakeStepKeys[0]
      });

      await enqueueOutboxEvent(tx, {
        eventType: "intake.started",
        aggregateType: "intake_workflow",
        aggregateId: workflow.id,
        ownerUserId: input.owner.ownerUserId,
        actor: input.owner.actor,
        payload: { currentStep: workflow.currentStep }
      });

      await writeAuditEvent(tx, {
        action: "intake.started",
        resourceType: "intake_workflow",
        resourceId: workflow.id,
        ownerUserId: input.owner.ownerUserId,
        actor: input.owner.actor,
        metadata: { currentStep: workflow.currentStep }
      });

      return {
        workflow,
        answers: [],
        resumed: false
      };
    });
  } catch (error) {
    if (isUniqueViolation(error, "intake_workflows_one_active_per_owner")) {
      const existing = await findActiveIntakeWorkflow(database, { ownerUserId: input.owner.ownerUserId });
      if (existing) {
        const detail = await loadDetail(database, input.owner.ownerUserId, existing);
        return { ...detail, resumed: true };
      }
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown, constraintName?: string): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as { code?: unknown; constraint?: unknown };
  return candidate.code === "23505" && (!constraintName || candidate.constraint === constraintName);
}

export async function getCurrentIntake(
  database: OpenVitalsDatabase,
  input: { owner: Pick<AuthenticatedOwnerContext, "ownerUserId"> }
): Promise<IntakeWorkflowDetail | null> {
  const workflow = await findActiveIntakeWorkflow(database, {
    ownerUserId: input.owner.ownerUserId
  });
  if (!workflow) {
    return null;
  }
  return loadDetail(database, input.owner.ownerUserId, workflow);
}

export async function getIntakeDetail(
  database: OpenVitalsDatabase,
  input: { owner: Pick<AuthenticatedOwnerContext, "ownerUserId">; intakeId: string }
): Promise<IntakeWorkflowDetail | null> {
  const workflow = await getIntakeWorkflowById(database, {
    ownerUserId: input.owner.ownerUserId,
    workflowId: input.intakeId
  });
  if (!workflow) {
    return null;
  }
  return loadDetail(database, input.owner.ownerUserId, workflow);
}

async function ensureIntakeSourceDocument(
  db: OpenVitalsDbExecutor,
  ownerUserId: string,
  workflowId: string
): Promise<typeof sourceDocuments.$inferSelect> {
  const fileName = intakeDocumentName(workflowId);
  const [existing] = await db
    .select()
    .from(sourceDocuments)
    .where(
      and(
        eq(sourceDocuments.ownerUserId, ownerUserId),
        eq(sourceDocuments.sourceKind, "manual_intake"),
        eq(sourceDocuments.fileName, fileName)
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(sourceDocuments)
    .values({
      ownerUserId,
      sourceKind: "manual_intake",
      fileName,
      mimeType: "application/vnd.openvitals.intake+json",
      status: "normalized",
      classification: "manual_intake",
      parserName: INTAKE_PARSER_NAME,
      parserVersion: INTAKE_PARSER_VERSION,
      metadata: { intakeWorkflowId: workflowId }
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create intake source document");
  }

  return created;
}

function intakeDocumentName(workflowId: string): string {
  return `intake/${workflowId}.json`;
}

type RequiredWorkflowResult = {
  workflow: IntakeWorkflow;
};

async function requireOpenWorkflow(
  db: OpenVitalsDbExecutor,
  ownerUserId: string,
  workflowId: string
): Promise<RequiredWorkflowResult> {
  // Lock the workflow row so concurrent step saves serialize on this owner's
  // active intake. Without this, ensureIntakeSourceDocument's SELECT-then-INSERT
  // races and can hit the partial unique index on source_documents.
  const [workflow] = await db
    .select()
    .from(intakeWorkflows)
    .where(and(eq(intakeWorkflows.ownerUserId, ownerUserId), eq(intakeWorkflows.id, workflowId)))
    .for("update")
    .limit(1);

  if (!workflow) {
    throw new IntakeApiError(404, "intake_not_found", "Intake workflow not found.");
  }
  if (workflow.status !== "in_progress") {
    throw new IntakeApiError(
      409,
      "intake_not_open",
      "Intake workflow is no longer open for changes."
    );
  }
  return { workflow };
}

type MaterializeContext = {
  ownerUserId: string;
  workflowId: string;
  stepKey: IntakeStepKey;
  actor: AuthenticatedOwnerContext["actor"];
  sourceDocumentId: string;
};

type MaterializeResult = {
  canonicalResourceType: string | null;
  canonicalResourceId: string | null;
  reviewTaskId: string | null;
};

function snapshot(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

async function materializeAnswer(
  db: OpenVitalsDbExecutor,
  context: MaterializeContext,
  answer: IntakeAnswerInput,
  existingAnswer?: IntakeAnswer | null
): Promise<MaterializeResult> {
  const payload = answer.payload;

  switch (payload.kind) {
    case "profile_field":
      await applyProfileField(db, context, payload);
      return { canonicalResourceType: null, canonicalResourceId: null, reviewTaskId: null };
    case "condition":
      return materializeCondition(db, context, answer.answerKey, payload, existingAnswer);
    case "medication":
      return materializeMedication(db, context, answer.answerKey, payload, existingAnswer);
    case "note":
      return materializeNote(db, context, answer.answerKey, payload, existingAnswer);
    case "family_history":
      return materializeFamilyHistory(db, context, answer.answerKey, payload, existingAnswer);
    case "lifestyle":
      return materializeLifestyle(db, context, answer.answerKey, payload, existingAnswer);
  }
}

async function applyProfileField(
  db: OpenVitalsDbExecutor,
  context: MaterializeContext,
  payload: Extract<IntakeAnswerPayload, { kind: "profile_field" }>
): Promise<void> {
  const { field, value } = payload;
  const update: Partial<typeof userProfiles.$inferInsert> = {};

  if (field === "dateOfBirth") {
    update.dateOfBirth = value instanceof Date ? value : value ? new Date(value) : null;
  } else if (field === "sexAtBirth") {
    update.sexAtBirth = typeof value === "string" ? value : null;
  } else if (field === "genderIdentity") {
    update.genderIdentity = typeof value === "string" ? value : null;
  } else if (field === "bloodType") {
    update.bloodType = typeof value === "string" ? value : null;
  }

  await db
    .insert(userProfiles)
    .values({
      userId: context.ownerUserId,
      ...update
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { ...update, updatedAt: new Date() }
    });

  await db.insert(provenance).values({
    ownerUserId: context.ownerUserId,
    resourceType: "user_profile",
    resourceId: context.ownerUserId,
    sourceDocumentId: context.sourceDocumentId,
    actorType: context.actor.type,
    actorId: context.actor.id ?? null,
    derivation: "intake_profile_field",
    parserName: INTAKE_PARSER_NAME,
    parserVersion: INTAKE_PARSER_VERSION,
    metadata: {
      intakeWorkflowId: context.workflowId,
      stepKey: context.stepKey,
      field
    }
  });
}

async function createIntakeSourceRecord(
  db: OpenVitalsDbExecutor,
  context: MaterializeContext,
  recordType: typeof sourceRecords.$inferInsert.recordType,
  answerKey: string,
  payload: JsonObject,
  sourceText: string,
  reviewState: "not_required" | "needs_review" = "not_required"
): Promise<typeof sourceRecords.$inferSelect> {
  const [record] = await db
    .insert(sourceRecords)
    .values({
      ownerUserId: context.ownerUserId,
      sourceDocumentId: context.sourceDocumentId,
      importJobId: null,
      recordType,
      externalRecordId: `${context.workflowId}:${context.stepKey}:${answerKey}`,
      parserName: INTAKE_PARSER_NAME,
      parserVersion: INTAKE_PARSER_VERSION,
      sourceText,
      originalPayload: payload,
      reviewState
    })
    .returning();

  if (!record) {
    throw new Error("Failed to create intake source record");
  }

  return record;
}

async function updateIntakeSourceRecord(
  db: OpenVitalsDbExecutor,
  context: MaterializeContext,
  sourceRecordId: string,
  payload: JsonObject,
  sourceText: string,
  reviewState: "not_required" | "needs_review" = "not_required"
): Promise<typeof sourceRecords.$inferSelect> {
  const [record] = await db
    .update(sourceRecords)
    .set({
      sourceDocumentId: context.sourceDocumentId,
      parserName: INTAKE_PARSER_NAME,
      parserVersion: INTAKE_PARSER_VERSION,
      sourceText,
      originalPayload: payload,
      reviewState,
      updatedAt: new Date()
    })
    .where(and(eq(sourceRecords.id, sourceRecordId), eq(sourceRecords.ownerUserId, context.ownerUserId)))
    .returning();

  if (!record) {
    throw new IntakeApiError(404, "intake_source_record_not_found", "Intake source record not found.");
  }

  return record;
}

function conditionSourceText(payload: Extract<IntakeAnswerPayload, { kind: "condition" }>): string {
  return payload.notes ? `${payload.displayName} — ${payload.notes}` : payload.displayName;
}

function medicationSourceText(payload: Extract<IntakeAnswerPayload, { kind: "medication" }>): string {
  return [payload.displayName, payload.dosageText, payload.frequency].filter(Boolean).join(" — ");
}

function familyHistorySourceText(payload: Extract<IntakeAnswerPayload, { kind: "family_history" }>): string {
  return `${payload.relation}: ${payload.condition}${payload.notes ? ` — ${payload.notes}` : ""}`;
}

async function materializeCondition(
  db: OpenVitalsDbExecutor,
  context: MaterializeContext,
  answerKey: string,
  payload: Extract<IntakeAnswerPayload, { kind: "condition" }>,
  existingAnswer?: IntakeAnswer | null
): Promise<MaterializeResult> {
  if (existingAnswer?.canonicalResourceType === "condition" && existingAnswer.canonicalResourceId) {
    const [existingCondition] = await db
      .select()
      .from(conditions)
      .where(
        and(
          eq(conditions.ownerUserId, context.ownerUserId),
          eq(conditions.id, existingAnswer.canonicalResourceId)
        )
      )
      .limit(1);

    if (existingCondition) {
      const sourceRecord = await updateIntakeSourceRecord(
        db,
        context,
        existingCondition.sourceRecordId,
        payload as unknown as JsonObject,
        conditionSourceText(payload)
      );
      const previousValue = snapshot(existingCondition);
      const [condition] = await db
        .update(conditions)
        .set({
          sourceRecordId: sourceRecord.id,
          displayName: payload.displayName,
          clinicalStatus: payload.clinicalStatus ?? null,
          verificationStatus: payload.verificationStatus ?? "user_reported",
          onsetAt: payload.onsetAt ?? null,
          notes: payload.notes ?? null,
          reviewState: "confirmed",
          trustLevel: "user_entered",
          metadata: {
            ...((existingCondition.metadata as JsonObject | null) ?? {}),
            intakeWorkflowId: context.workflowId,
            stepKey: context.stepKey,
            answerKey,
            lastIntakeEditAt: new Date().toISOString()
          },
          updatedAt: new Date()
        })
        .where(and(eq(conditions.ownerUserId, context.ownerUserId), eq(conditions.id, existingCondition.id)))
        .returning();

      if (!condition) {
        throw new Error("Failed to update intake condition");
      }

      await db.insert(provenance).values({
        ownerUserId: context.ownerUserId,
        resourceType: "condition",
        resourceId: condition.id,
        sourceDocumentId: context.sourceDocumentId,
        sourceRecordId: sourceRecord.id,
        actorType: context.actor.type,
        actorId: context.actor.id ?? null,
        derivation: "intake_answer_update",
        parserName: INTAKE_PARSER_NAME,
        parserVersion: INTAKE_PARSER_VERSION,
        metadata: {
          intakeWorkflowId: context.workflowId,
          stepKey: context.stepKey,
          answerKey
        }
      });

      await writeRecordRevision(db, {
        ownerUserId: context.ownerUserId,
        resourceType: "condition",
        resourceId: condition.id,
        previousValue,
        newValue: snapshot(condition),
        reason: "intake_answer_updated",
        actor: context.actor
      });

      return {
        canonicalResourceType: "condition",
        canonicalResourceId: condition.id,
        reviewTaskId: null
      };
    }
  }

  await supersedeIntakeAnswerResource(db, context, existingAnswer, "replaced_by_intake_answer");

  const sourceRecord = await createIntakeSourceRecord(
    db,
    context,
    "condition",
    answerKey,
    payload as unknown as JsonObject,
    conditionSourceText(payload)
  );

  const [condition] = await db
    .insert(conditions)
    .values({
      ownerUserId: context.ownerUserId,
      sourceRecordId: sourceRecord.id,
      displayName: payload.displayName,
      clinicalStatus: payload.clinicalStatus ?? null,
      verificationStatus: payload.verificationStatus ?? "user_reported",
      onsetAt: payload.onsetAt ?? null,
      notes: payload.notes ?? null,
      reviewState: "confirmed",
      trustLevel: "user_entered",
      metadata: {
        intakeWorkflowId: context.workflowId,
        stepKey: context.stepKey,
        answerKey
      }
    })
    .returning();

  if (!condition) {
    throw new Error("Failed to create intake condition");
  }

  await db.insert(provenance).values({
    ownerUserId: context.ownerUserId,
    resourceType: "condition",
    resourceId: condition.id,
    sourceDocumentId: context.sourceDocumentId,
    sourceRecordId: sourceRecord.id,
    actorType: context.actor.type,
    actorId: context.actor.id ?? null,
    derivation: "intake_answer",
    parserName: INTAKE_PARSER_NAME,
    parserVersion: INTAKE_PARSER_VERSION,
    metadata: {
      intakeWorkflowId: context.workflowId,
      stepKey: context.stepKey,
      answerKey
    }
  });

  return {
    canonicalResourceType: "condition",
    canonicalResourceId: condition.id,
    reviewTaskId: null
  };
}

async function materializeMedication(
  db: OpenVitalsDbExecutor,
  context: MaterializeContext,
  answerKey: string,
  payload: Extract<IntakeAnswerPayload, { kind: "medication" }>,
  existingAnswer?: IntakeAnswer | null
): Promise<MaterializeResult> {
  if (existingAnswer?.canonicalResourceType === "medication" && existingAnswer.canonicalResourceId) {
    const [existingMedication] = await db
      .select()
      .from(medications)
      .where(
        and(
          eq(medications.ownerUserId, context.ownerUserId),
          eq(medications.id, existingAnswer.canonicalResourceId)
        )
      )
      .limit(1);

    if (existingMedication) {
      const sourceRecord = await updateIntakeSourceRecord(
        db,
        context,
        existingMedication.sourceRecordId,
        payload as unknown as JsonObject,
        medicationSourceText(payload)
      );
      const previousValue = snapshot(existingMedication);
      const [medication] = await db
        .update(medications)
        .set({
          sourceRecordId: sourceRecord.id,
          displayName: payload.displayName,
          dosageText: payload.dosageText ?? null,
          route: payload.route ?? null,
          frequency: payload.frequency ?? null,
          active: payload.active,
          startedAt: payload.startedAt ?? null,
          stoppedAt: payload.stoppedAt ?? null,
          reviewState: "confirmed",
          trustLevel: "user_entered",
          metadata: {
            ...((existingMedication.metadata as JsonObject | null) ?? {}),
            intakeWorkflowId: context.workflowId,
            stepKey: context.stepKey,
            answerKey,
            lastIntakeEditAt: new Date().toISOString()
          },
          updatedAt: new Date()
        })
        .where(and(eq(medications.ownerUserId, context.ownerUserId), eq(medications.id, existingMedication.id)))
        .returning();

      if (!medication) {
        throw new Error("Failed to update intake medication");
      }

      await db.insert(provenance).values({
        ownerUserId: context.ownerUserId,
        resourceType: "medication",
        resourceId: medication.id,
        sourceDocumentId: context.sourceDocumentId,
        sourceRecordId: sourceRecord.id,
        actorType: context.actor.type,
        actorId: context.actor.id ?? null,
        derivation: "intake_answer_update",
        parserName: INTAKE_PARSER_NAME,
        parserVersion: INTAKE_PARSER_VERSION,
        metadata: {
          intakeWorkflowId: context.workflowId,
          stepKey: context.stepKey,
          answerKey
        }
      });

      await writeRecordRevision(db, {
        ownerUserId: context.ownerUserId,
        resourceType: "medication",
        resourceId: medication.id,
        previousValue,
        newValue: snapshot(medication),
        reason: "intake_answer_updated",
        actor: context.actor
      });

      return {
        canonicalResourceType: "medication",
        canonicalResourceId: medication.id,
        reviewTaskId: null
      };
    }
  }

  await supersedeIntakeAnswerResource(db, context, existingAnswer, "replaced_by_intake_answer");

  const sourceRecord = await createIntakeSourceRecord(
    db,
    context,
    "medication",
    answerKey,
    payload as unknown as JsonObject,
    medicationSourceText(payload)
  );

  const [medication] = await db
    .insert(medications)
    .values({
      ownerUserId: context.ownerUserId,
      sourceRecordId: sourceRecord.id,
      displayName: payload.displayName,
      dosageText: payload.dosageText ?? null,
      route: payload.route ?? null,
      frequency: payload.frequency ?? null,
      active: payload.active,
      startedAt: payload.startedAt ?? null,
      stoppedAt: payload.stoppedAt ?? null,
      reviewState: "confirmed",
      trustLevel: "user_entered",
      metadata: {
        intakeWorkflowId: context.workflowId,
        stepKey: context.stepKey,
        answerKey
      }
    })
    .returning();

  if (!medication) {
    throw new Error("Failed to create intake medication");
  }

  await db.insert(provenance).values({
    ownerUserId: context.ownerUserId,
    resourceType: "medication",
    resourceId: medication.id,
    sourceDocumentId: context.sourceDocumentId,
    sourceRecordId: sourceRecord.id,
    actorType: context.actor.type,
    actorId: context.actor.id ?? null,
    derivation: "intake_answer",
    parserName: INTAKE_PARSER_NAME,
    parserVersion: INTAKE_PARSER_VERSION,
    metadata: {
      intakeWorkflowId: context.workflowId,
      stepKey: context.stepKey,
      answerKey
    }
  });

  return {
    canonicalResourceType: "medication",
    canonicalResourceId: medication.id,
    reviewTaskId: null
  };
}

async function materializeNote(
  db: OpenVitalsDbExecutor,
  context: MaterializeContext,
  answerKey: string,
  payload: Extract<IntakeAnswerPayload, { kind: "note" }>,
  existingAnswer?: IntakeAnswer | null
): Promise<MaterializeResult> {
  if (existingAnswer?.canonicalResourceType === "review_task" && existingAnswer.canonicalResourceId) {
    const [existingTask] = await db
      .select()
      .from(reviewTasks)
      .where(
        and(
          eq(reviewTasks.ownerUserId, context.ownerUserId),
          eq(reviewTasks.id, existingAnswer.canonicalResourceId)
        )
      )
      .limit(1);

    if (existingTask) {
      const sourceRecord = existingTask.sourceRecordId
        ? await updateIntakeSourceRecord(
            db,
            context,
            existingTask.sourceRecordId,
            payload as unknown as JsonObject,
            payload.text,
            "needs_review"
          )
        : await createIntakeSourceRecord(
            db,
            context,
            "note",
            answerKey,
            payload as unknown as JsonObject,
            payload.text,
            "needs_review"
          );
      const previousValue = snapshot(existingTask);
      const [task] = await db
        .update(reviewTasks)
        .set({
          sourceRecordId: sourceRecord.id,
          resourceType: "source_record",
          resourceId: sourceRecord.id,
          status: "open",
          reason: "intake_note_review",
          suggestedValue: {
            text: payload.text,
            topic: payload.topic ?? null,
            intakeWorkflowId: context.workflowId,
            stepKey: context.stepKey,
            answerKey
          } satisfies JsonObject,
          resolutionAction: null,
          resolutionNote: null,
          resolvedByUserId: null,
          resolvedAt: null,
          updatedAt: new Date()
        })
        .where(and(eq(reviewTasks.ownerUserId, context.ownerUserId), eq(reviewTasks.id, existingTask.id)))
        .returning();

      if (!task) {
        throw new Error("Failed to update intake review task");
      }

      await db.insert(provenance).values({
        ownerUserId: context.ownerUserId,
        resourceType: "review_task",
        resourceId: task.id,
        sourceDocumentId: context.sourceDocumentId,
        sourceRecordId: sourceRecord.id,
        actorType: context.actor.type,
        actorId: context.actor.id ?? null,
        derivation: "intake_note_update",
        parserName: INTAKE_PARSER_NAME,
        parserVersion: INTAKE_PARSER_VERSION,
        metadata: {
          intakeWorkflowId: context.workflowId,
          stepKey: context.stepKey,
          answerKey
        }
      });

      await writeRecordRevision(db, {
        ownerUserId: context.ownerUserId,
        resourceType: "review_task",
        resourceId: task.id,
        previousValue,
        newValue: snapshot(task),
        reason: "intake_answer_updated",
        actor: context.actor
      });

      return {
        canonicalResourceType: "review_task",
        canonicalResourceId: task.id,
        reviewTaskId: task.id
      };
    }
  }

  await supersedeIntakeAnswerResource(db, context, existingAnswer, "replaced_by_intake_answer");

  const sourceRecord = await createIntakeSourceRecord(
    db,
    context,
    "note",
    answerKey,
    payload as unknown as JsonObject,
    payload.text,
    "needs_review"
  );

  const [task] = await db
    .insert(reviewTasks)
    .values({
      ownerUserId: context.ownerUserId,
      sourceRecordId: sourceRecord.id,
      resourceType: "source_record",
      resourceId: sourceRecord.id,
      reason: "intake_note_review",
      suggestedValue: {
        text: payload.text,
        topic: payload.topic ?? null,
        intakeWorkflowId: context.workflowId,
        stepKey: context.stepKey,
        answerKey
      } satisfies JsonObject
    })
    .returning();

  if (!task) {
    throw new Error("Failed to create intake review task");
  }

  await db.insert(provenance).values({
    ownerUserId: context.ownerUserId,
    resourceType: "review_task",
    resourceId: task.id,
    sourceDocumentId: context.sourceDocumentId,
    sourceRecordId: sourceRecord.id,
    actorType: context.actor.type,
    actorId: context.actor.id ?? null,
    derivation: "intake_note",
    parserName: INTAKE_PARSER_NAME,
    parserVersion: INTAKE_PARSER_VERSION,
    metadata: {
      intakeWorkflowId: context.workflowId,
      stepKey: context.stepKey,
      answerKey
    }
  });

  await enqueueOutboxEvent(db, {
    eventType: "review_task.created",
    aggregateType: "review_task",
    aggregateId: task.id,
    ownerUserId: context.ownerUserId,
    actor: context.actor,
    payload: {
      reviewTaskId: task.id,
      reason: "intake_note_review",
      sourceRecordId: sourceRecord.id,
      intakeWorkflowId: context.workflowId
    }
  });

  await writeAuditEvent(db, {
    action: "review_task.created",
    resourceType: "review_task",
    resourceId: task.id,
    ownerUserId: context.ownerUserId,
    actor: context.actor,
    metadata: {
      intakeWorkflowId: context.workflowId,
      stepKey: context.stepKey,
      answerKey,
      sourceRecordId: sourceRecord.id
    }
  });

  return {
    canonicalResourceType: "review_task",
    canonicalResourceId: task.id,
    reviewTaskId: task.id
  };
}

async function materializeFamilyHistory(
  db: OpenVitalsDbExecutor,
  context: MaterializeContext,
  answerKey: string,
  payload: Extract<IntakeAnswerPayload, { kind: "family_history" }>,
  existingAnswer?: IntakeAnswer | null
): Promise<MaterializeResult> {
  if (existingAnswer?.canonicalResourceType === "source_record" && existingAnswer.canonicalResourceId) {
    const sourceRecord = await updateIntakeSourceRecord(
      db,
      context,
      existingAnswer.canonicalResourceId,
      payload as unknown as JsonObject,
      familyHistorySourceText(payload)
    );

    await db.insert(provenance).values({
      ownerUserId: context.ownerUserId,
      resourceType: "source_record",
      resourceId: sourceRecord.id,
      sourceDocumentId: context.sourceDocumentId,
      sourceRecordId: sourceRecord.id,
      actorType: context.actor.type,
      actorId: context.actor.id ?? null,
      derivation: "intake_family_history_update",
      parserName: INTAKE_PARSER_NAME,
      parserVersion: INTAKE_PARSER_VERSION,
      metadata: {
        intakeWorkflowId: context.workflowId,
        stepKey: context.stepKey,
        answerKey
      }
    });

    return {
      canonicalResourceType: "source_record",
      canonicalResourceId: sourceRecord.id,
      reviewTaskId: null
    };
  }

  await supersedeIntakeAnswerResource(db, context, existingAnswer, "replaced_by_intake_answer");

  const sourceRecord = await createIntakeSourceRecord(
    db,
    context,
    "family_history",
    answerKey,
    payload as unknown as JsonObject,
    familyHistorySourceText(payload)
  );

  await db.insert(provenance).values({
    ownerUserId: context.ownerUserId,
    resourceType: "source_record",
    resourceId: sourceRecord.id,
    sourceDocumentId: context.sourceDocumentId,
    sourceRecordId: sourceRecord.id,
    actorType: context.actor.type,
    actorId: context.actor.id ?? null,
    derivation: "intake_family_history",
    parserName: INTAKE_PARSER_NAME,
    parserVersion: INTAKE_PARSER_VERSION,
    metadata: {
      intakeWorkflowId: context.workflowId,
      stepKey: context.stepKey,
      answerKey
    }
  });

  return {
    canonicalResourceType: "source_record",
    canonicalResourceId: sourceRecord.id,
    reviewTaskId: null
  };
}

async function materializeLifestyle(
  db: OpenVitalsDbExecutor,
  context: MaterializeContext,
  answerKey: string,
  payload: Extract<IntakeAnswerPayload, { kind: "lifestyle" }>,
  existingAnswer?: IntakeAnswer | null
): Promise<MaterializeResult> {
  if (existingAnswer?.canonicalResourceType === "source_record" && existingAnswer.canonicalResourceId) {
    const sourceRecord = await updateIntakeSourceRecord(
      db,
      context,
      existingAnswer.canonicalResourceId,
      payload as unknown as JsonObject,
      `${payload.topic}: ${payload.detail}`
    );

    await db.insert(provenance).values({
      ownerUserId: context.ownerUserId,
      resourceType: "source_record",
      resourceId: sourceRecord.id,
      sourceDocumentId: context.sourceDocumentId,
      sourceRecordId: sourceRecord.id,
      actorType: context.actor.type,
      actorId: context.actor.id ?? null,
      derivation: "intake_lifestyle_update",
      parserName: INTAKE_PARSER_NAME,
      parserVersion: INTAKE_PARSER_VERSION,
      metadata: {
        intakeWorkflowId: context.workflowId,
        stepKey: context.stepKey,
        answerKey
      }
    });

    return {
      canonicalResourceType: "source_record",
      canonicalResourceId: sourceRecord.id,
      reviewTaskId: null
    };
  }

  await supersedeIntakeAnswerResource(db, context, existingAnswer, "replaced_by_intake_answer");

  const sourceRecord = await createIntakeSourceRecord(
    db,
    context,
    "lifestyle",
    answerKey,
    payload as unknown as JsonObject,
    `${payload.topic}: ${payload.detail}`
  );

  await db.insert(provenance).values({
    ownerUserId: context.ownerUserId,
    resourceType: "source_record",
    resourceId: sourceRecord.id,
    sourceDocumentId: context.sourceDocumentId,
    sourceRecordId: sourceRecord.id,
    actorType: context.actor.type,
    actorId: context.actor.id ?? null,
    derivation: "intake_lifestyle",
    parserName: INTAKE_PARSER_NAME,
    parserVersion: INTAKE_PARSER_VERSION,
    metadata: {
      intakeWorkflowId: context.workflowId,
      stepKey: context.stepKey,
      answerKey
    }
  });

  return {
    canonicalResourceType: "source_record",
    canonicalResourceId: sourceRecord.id,
    reviewTaskId: null
  };
}

async function supersedeIntakeAnswerResource(
  db: OpenVitalsDbExecutor,
  context: MaterializeContext,
  answer: IntakeAnswer | null | undefined,
  reason: string
): Promise<void> {
  if (!answer?.canonicalResourceType || !answer.canonicalResourceId) {
    return;
  }

  if (answer.canonicalResourceType === "condition") {
    const [existing] = await db
      .select()
      .from(conditions)
      .where(and(eq(conditions.ownerUserId, context.ownerUserId), eq(conditions.id, answer.canonicalResourceId)))
      .limit(1);
    if (!existing) return;

    const previousValue = snapshot(existing);
    const [updated] = await db
      .update(conditions)
      .set({
        reviewState: "ignored",
        metadata: {
          ...((existing.metadata as JsonObject | null) ?? {}),
          lastIntakeSupersededAt: new Date().toISOString(),
          lastIntakeSupersededReason: reason
        },
        updatedAt: new Date()
      })
      .where(and(eq(conditions.ownerUserId, context.ownerUserId), eq(conditions.id, existing.id)))
      .returning();

    if (updated) {
      await writeRecordRevision(db, {
        ownerUserId: context.ownerUserId,
        resourceType: "condition",
        resourceId: updated.id,
        previousValue,
        newValue: snapshot(updated),
        reason,
        actor: context.actor
      });
    }
    return;
  }

  if (answer.canonicalResourceType === "medication") {
    const [existing] = await db
      .select()
      .from(medications)
      .where(and(eq(medications.ownerUserId, context.ownerUserId), eq(medications.id, answer.canonicalResourceId)))
      .limit(1);
    if (!existing) return;

    const previousValue = snapshot(existing);
    const [updated] = await db
      .update(medications)
      .set({
        reviewState: "ignored",
        metadata: {
          ...((existing.metadata as JsonObject | null) ?? {}),
          lastIntakeSupersededAt: new Date().toISOString(),
          lastIntakeSupersededReason: reason
        },
        updatedAt: new Date()
      })
      .where(and(eq(medications.ownerUserId, context.ownerUserId), eq(medications.id, existing.id)))
      .returning();

    if (updated) {
      await writeRecordRevision(db, {
        ownerUserId: context.ownerUserId,
        resourceType: "medication",
        resourceId: updated.id,
        previousValue,
        newValue: snapshot(updated),
        reason,
        actor: context.actor
      });
    }
    return;
  }

  if (answer.canonicalResourceType === "review_task") {
    const [existing] = await db
      .select()
      .from(reviewTasks)
      .where(and(eq(reviewTasks.ownerUserId, context.ownerUserId), eq(reviewTasks.id, answer.canonicalResourceId)))
      .limit(1);
    if (!existing) return;

    const previousValue = snapshot(existing);
    const [updated] = await db
      .update(reviewTasks)
      .set({
        status: "dismissed",
        resolutionAction: "ignore",
        resolutionNote: reason,
        resolvedByUserId: context.actor.type === "user" || context.actor.type === "admin" ? context.actor.id : null,
        resolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(reviewTasks.ownerUserId, context.ownerUserId), eq(reviewTasks.id, existing.id)))
      .returning();

    if (updated) {
      await writeRecordRevision(db, {
        ownerUserId: context.ownerUserId,
        resourceType: "review_task",
        resourceId: updated.id,
        previousValue,
        newValue: snapshot(updated),
        reason,
        actor: context.actor
      });
    }
    return;
  }

  if (answer.canonicalResourceType === "source_record") {
    const [existing] = await db
      .select()
      .from(sourceRecords)
      .where(and(eq(sourceRecords.ownerUserId, context.ownerUserId), eq(sourceRecords.id, answer.canonicalResourceId)))
      .limit(1);
    if (!existing) return;

    const previousValue = snapshot(existing);
    const [updated] = await db
      .update(sourceRecords)
      .set({
        reviewState: "ignored",
        updatedAt: new Date()
      })
      .where(and(eq(sourceRecords.ownerUserId, context.ownerUserId), eq(sourceRecords.id, existing.id)))
      .returning();

    if (updated) {
      await writeRecordRevision(db, {
        ownerUserId: context.ownerUserId,
        resourceType: "source_record",
        resourceId: updated.id,
        previousValue,
        newValue: snapshot(updated),
        reason,
        actor: context.actor
      });
    }
  }
}

export async function saveIntakeStep(
  database: OpenVitalsDatabase,
  input: {
    owner: Pick<AuthenticatedOwnerContext, "ownerUserId" | "actor">;
    intakeId: string;
    body: SaveIntakeStepBody;
  }
): Promise<IntakeWorkflowDetail> {
  return database.transaction(async (tx) => {
    const { workflow } = await requireOpenWorkflow(
      tx,
      input.owner.ownerUserId,
      input.intakeId
    );

    const stepKey = input.body.stepKey;
    const sourceDocument = await ensureIntakeSourceDocument(
      tx,
      input.owner.ownerUserId,
      workflow.id
    );

    const context: MaterializeContext = {
      ownerUserId: input.owner.ownerUserId,
      workflowId: workflow.id,
      stepKey,
      actor: input.owner.actor,
      sourceDocumentId: sourceDocument.id
    };

    const existingAnswers = await listIntakeAnswers(tx, {
      ownerUserId: input.owner.ownerUserId,
      workflowId: workflow.id,
      stepKey
    });
    const existingByKey = new Map(existingAnswers.map((answer) => [answer.answerKey, answer]));

    const materializedAnswerIds: string[] = [];
    for (const answer of input.body.answers) {
      const materialized = await materializeAnswer(tx, context, answer, existingByKey.get(answer.answerKey));
      const persisted = await upsertIntakeAnswer(tx, {
        workflowId: workflow.id,
        ownerUserId: input.owner.ownerUserId,
        stepKey,
        answerKey: answer.answerKey,
        answerValue: answer.payload as unknown as JsonObject,
        skipped: false,
        canonicalResourceType: materialized.canonicalResourceType,
        canonicalResourceId: materialized.canonicalResourceId
      });
      materializedAnswerIds.push(persisted.id);
    }

    const advanceTo = resolveAdvance(stepKey, input.body.advanceTo);

    const updated = await updateIntakeWorkflow(tx, {
      ownerUserId: input.owner.ownerUserId,
      workflowId: workflow.id,
      currentStep: advanceTo
    });

    if (!updated) {
      throw new IntakeApiError(409, "intake_update_failed", "Failed to update intake workflow.");
    }

    await enqueueOutboxEvent(tx, {
      eventType: "intake.step_saved",
      aggregateType: "intake_workflow",
      aggregateId: workflow.id,
      ownerUserId: input.owner.ownerUserId,
      actor: input.owner.actor,
      payload: {
        stepKey,
        answerCount: input.body.answers.length,
        intakeAnswerIds: materializedAnswerIds,
        nextStep: advanceTo
      }
    });

    await writeAuditEvent(tx, {
      action: "intake.step_saved",
      resourceType: "intake_workflow",
      resourceId: workflow.id,
      ownerUserId: input.owner.ownerUserId,
      actor: input.owner.actor,
      metadata: {
        stepKey,
        answerCount: input.body.answers.length,
        nextStep: advanceTo
      }
    });

    return loadDetail(tx, input.owner.ownerUserId, updated);
  });
}

export async function skipIntakeStep(
  database: OpenVitalsDatabase,
  input: {
    owner: Pick<AuthenticatedOwnerContext, "ownerUserId" | "actor">;
    intakeId: string;
    body: SkipIntakeStepBody;
  }
): Promise<IntakeWorkflowDetail> {
  return database.transaction(async (tx) => {
    const { workflow } = await requireOpenWorkflow(
      tx,
      input.owner.ownerUserId,
      input.intakeId
    );

    const stepKey = input.body.stepKey;
    const existingAnswers = await listIntakeAnswers(tx, {
      ownerUserId: input.owner.ownerUserId,
      workflowId: workflow.id,
      stepKey
    });

    if (existingAnswers.some((answer) => answer.canonicalResourceId !== null)) {
      const sourceDocument = await ensureIntakeSourceDocument(
        tx,
        input.owner.ownerUserId,
        workflow.id
      );
      const context: MaterializeContext = {
        ownerUserId: input.owner.ownerUserId,
        workflowId: workflow.id,
        stepKey,
        actor: input.owner.actor,
        sourceDocumentId: sourceDocument.id
      };

      for (const answer of existingAnswers) {
        await supersedeIntakeAnswerResource(tx, context, answer, "skipped_intake_step");
      }
    }

    await deleteIntakeAnswersForStep(tx, {
      ownerUserId: input.owner.ownerUserId,
      workflowId: workflow.id,
      stepKey
    });

    await upsertIntakeAnswer(tx, {
      workflowId: workflow.id,
      ownerUserId: input.owner.ownerUserId,
      stepKey,
      answerKey: "__skip__",
      answerValue: input.body.reason ? { reason: input.body.reason } : null,
      skipped: true
    });

    const advanceTo = resolveAdvance(stepKey, input.body.advanceTo);

    const updated = await updateIntakeWorkflow(tx, {
      ownerUserId: input.owner.ownerUserId,
      workflowId: workflow.id,
      currentStep: advanceTo,
      appendSkippedStep: stepKey
    });

    if (!updated) {
      throw new IntakeApiError(409, "intake_update_failed", "Failed to update intake workflow.");
    }

    await enqueueOutboxEvent(tx, {
      eventType: "intake.step_skipped",
      aggregateType: "intake_workflow",
      aggregateId: workflow.id,
      ownerUserId: input.owner.ownerUserId,
      actor: input.owner.actor,
      payload: { stepKey, nextStep: advanceTo, reason: input.body.reason ?? null }
    });

    await writeAuditEvent(tx, {
      action: "intake.step_skipped",
      resourceType: "intake_workflow",
      resourceId: workflow.id,
      ownerUserId: input.owner.ownerUserId,
      actor: input.owner.actor,
      metadata: { stepKey, nextStep: advanceTo, reason: input.body.reason ?? null }
    });

    return loadDetail(tx, input.owner.ownerUserId, updated);
  });
}

export async function completeIntake(
  database: OpenVitalsDatabase,
  input: {
    owner: Pick<AuthenticatedOwnerContext, "ownerUserId" | "actor">;
    intakeId: string;
    body?: CompleteIntakeBody | undefined;
  }
): Promise<IntakeWorkflowDetail> {
  return database.transaction(async (tx) => {
    const workflow = await getIntakeWorkflowById(tx, {
      ownerUserId: input.owner.ownerUserId,
      workflowId: input.intakeId
    });

    if (!workflow) {
      throw new IntakeApiError(404, "intake_not_found", "Intake workflow not found.");
    }

    if (workflow.status === "completed") {
      return loadDetail(tx, input.owner.ownerUserId, workflow);
    }

    if (workflow.status === "abandoned") {
      throw new IntakeApiError(
        409,
        "intake_abandoned",
        "Abandoned intake workflows cannot be completed."
      );
    }

    const completedAt = new Date();

    const [updated] = await tx
      .update(intakeWorkflows)
      .set({
        status: "completed",
        completedAt,
        currentStep: null,
        updatedAt: completedAt
      })
      .where(
        and(
          eq(intakeWorkflows.ownerUserId, input.owner.ownerUserId),
          eq(intakeWorkflows.id, workflow.id),
          eq(intakeWorkflows.status, "in_progress")
        )
      )
      .returning();

    if (!updated) {
      throw new IntakeApiError(
        409,
        "intake_completion_conflict",
        "Intake workflow could not be completed."
      );
    }

    await enqueueOutboxEvent(tx, {
      eventType: "intake.completed",
      aggregateType: "intake_workflow",
      aggregateId: updated.id,
      ownerUserId: input.owner.ownerUserId,
      actor: input.owner.actor,
      payload: {
        skippedSteps: updated.skippedSteps,
        note: input.body?.note ?? null
      }
    });

    await writeAuditEvent(tx, {
      action: "intake.completed",
      resourceType: "intake_workflow",
      resourceId: updated.id,
      ownerUserId: input.owner.ownerUserId,
      actor: input.owner.actor,
      metadata: {
        skippedSteps: updated.skippedSteps,
        note: input.body?.note ?? null
      }
    });

    return loadDetail(tx, input.owner.ownerUserId, updated);
  });
}

function resolveAdvance(
  current: IntakeStepKey,
  requested: IntakeStepKey | null | undefined
): string | null {
  if (requested === null) {
    return null;
  }
  if (requested) {
    return requested;
  }
  return nextIntakeStep(current);
}
