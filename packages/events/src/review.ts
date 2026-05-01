import { eq } from "drizzle-orm";
import {
  bulkResolveReviewTasks,
  canonicalTableFor,
  conditions,
  encounters,
  getReviewTaskById,
  listOpenReviewTasksForResource,
  medications,
  observations,
  resolveReviewTask,
  reviewTasks,
  sourceRecords,
  writeRecordRevision,
  type CanonicalRecord,
  type JsonObject,
  type OpenVitalsDatabase,
  type OpenVitalsDbExecutor,
  type RecordRevision,
  type ReviewTask,
  type ReviewTaskStatus
} from "@openvitals/database";
import {
  canonicalResourceTypes,
  conditionCorrectionSchema,
  encounterCorrectionSchema,
  medicationCorrectionSchema,
  observationCorrectionSchema,
  parseNullableDecimal,
  type Actor,
  type CanonicalResourceType,
  type ReviewAction
} from "@openvitals/domain";
import { enqueueOutboxEvent, writeAuditEvent } from "./outbox";
import type { AuditAction, DomainEventType } from "./schemas";

const canonicalTables = {
  observation: observations,
  condition: conditions,
  medication: medications,
  encounter: encounters
} as const;

const trustLevelByAction = {
  confirm: "user_confirmed",
  correct: "user_corrected"
} as const;

type ResolutionStatus = Extract<ReviewTaskStatus, "resolved" | "dismissed">;

type CanonicalReviewState = "confirmed" | "corrected" | "ignored" | "merged" | "unknown";

type ActionEffect = {
  reviewState: CanonicalReviewState;
  trustLevel?: "user_confirmed" | "user_corrected";
  taskStatus: ResolutionStatus;
  domainEventType: DomainEventType;
  auditAction: AuditAction;
};

const actionEffects: Record<Exclude<ReviewAction, "attach_note">, ActionEffect> = {
  confirm: {
    reviewState: "confirmed",
    trustLevel: trustLevelByAction.confirm,
    taskStatus: "resolved",
    domainEventType: "record.confirmed",
    auditAction: "record.confirmed"
  },
  correct: {
    reviewState: "corrected",
    trustLevel: trustLevelByAction.correct,
    taskStatus: "resolved",
    domainEventType: "record.corrected",
    auditAction: "record.corrected"
  },
  ignore: {
    reviewState: "ignored",
    taskStatus: "dismissed",
    domainEventType: "record.ignored",
    auditAction: "record.ignored"
  },
  merge_duplicate: {
    reviewState: "merged",
    taskStatus: "resolved",
    domainEventType: "record.merged",
    auditAction: "record.merged"
  },
  mark_unknown: {
    reviewState: "unknown",
    taskStatus: "resolved",
    domainEventType: "record.marked_unknown",
    auditAction: "record.marked_unknown"
  }
};

export class ReviewActionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ReviewActionError";
  }
}

export type ApplyReviewActionInput = {
  ownerUserId: string;
  actor: Actor;
  reviewTaskId?: string | undefined;
  resourceType?: string | undefined;
  resourceId?: string | undefined;
  action: ReviewAction;
  note?: string | undefined;
  corrections?: Record<string, unknown> | undefined;
  mergeIntoResourceId?: string | undefined;
};

export type ApplyReviewActionResult = {
  reviewTask: ReviewTask | null;
  cascadedReviewTaskIds: string[];
  resourceType: string | null;
  resourceId: string | null;
  recordRevision: RecordRevision | null;
  updatedRecord: CanonicalRecord | null;
};

function isCanonicalResourceType(value: string | null | undefined): value is CanonicalResourceType {
  return typeof value === "string" && (canonicalResourceTypes as readonly string[]).includes(value);
}

function snapshot(record: CanonicalRecord): JsonObject {
  return JSON.parse(JSON.stringify(record)) as JsonObject;
}

function buildResolverUserId(actor: Actor): string | undefined {
  if (actor.type === "user" || actor.type === "admin") {
    return actor.id;
  }
  return undefined;
}

function applyObservationCorrections(input: Record<string, unknown>): Partial<typeof observations.$inferInsert> {
  const parsed = observationCorrectionSchema.parse(input);
  const update: Partial<typeof observations.$inferInsert> = {};

  if (parsed.displayName !== undefined) update.displayName = parsed.displayName;
  if (parsed.category !== undefined) update.category = parsed.category;
  if (parsed.observedAt !== undefined) update.observedAt = parsed.observedAt;
  if (parsed.observedAtUnknown !== undefined) update.observedAtUnknown = parsed.observedAtUnknown;
  if (parsed.originalValue !== undefined) update.originalValue = parsed.originalValue;
  if (parsed.valueNumeric !== undefined) update.valueNumeric = parseNullableDecimal(parsed.valueNumeric);
  if (parsed.valueText !== undefined) update.valueText = parsed.valueText;
  if (parsed.normalizedValueNumeric !== undefined) {
    update.normalizedValueNumeric = parseNullableDecimal(parsed.normalizedValueNumeric);
  }
  if (parsed.unitOriginal !== undefined) update.unitOriginal = parsed.unitOriginal;
  if (parsed.unitNormalized !== undefined) update.unitNormalized = parsed.unitNormalized;
  if (parsed.referenceRangeLow !== undefined) {
    update.referenceRangeLow = parseNullableDecimal(parsed.referenceRangeLow);
  }
  if (parsed.referenceRangeHigh !== undefined) {
    update.referenceRangeHigh = parseNullableDecimal(parsed.referenceRangeHigh);
  }
  if (parsed.interpretation !== undefined) update.interpretation = parsed.interpretation;
  if (parsed.loincCode !== undefined) update.loincCode = parsed.loincCode;

  return update;
}

function applyConditionCorrections(input: Record<string, unknown>): Partial<typeof conditions.$inferInsert> {
  const parsed = conditionCorrectionSchema.parse(input);
  const update: Partial<typeof conditions.$inferInsert> = {};

  if (parsed.displayName !== undefined) update.displayName = parsed.displayName;
  if (parsed.snomedCode !== undefined) update.snomedCode = parsed.snomedCode;
  if (parsed.icd10Code !== undefined) update.icd10Code = parsed.icd10Code;
  if (parsed.clinicalStatus !== undefined) update.clinicalStatus = parsed.clinicalStatus;
  if (parsed.verificationStatus !== undefined) update.verificationStatus = parsed.verificationStatus;
  if (parsed.onsetAt !== undefined) update.onsetAt = parsed.onsetAt;
  if (parsed.abatementAt !== undefined) update.abatementAt = parsed.abatementAt;
  if (parsed.notes !== undefined) update.notes = parsed.notes;

  return update;
}

function applyMedicationCorrections(input: Record<string, unknown>): Partial<typeof medications.$inferInsert> {
  const parsed = medicationCorrectionSchema.parse(input);
  const update: Partial<typeof medications.$inferInsert> = {};

  if (parsed.displayName !== undefined) update.displayName = parsed.displayName;
  if (parsed.rxnormCode !== undefined) update.rxnormCode = parsed.rxnormCode;
  if (parsed.dosageText !== undefined) update.dosageText = parsed.dosageText;
  if (parsed.route !== undefined) update.route = parsed.route;
  if (parsed.frequency !== undefined) update.frequency = parsed.frequency;
  if (parsed.startedAt !== undefined) update.startedAt = parsed.startedAt;
  if (parsed.stoppedAt !== undefined) update.stoppedAt = parsed.stoppedAt;
  if (parsed.active !== undefined) update.active = parsed.active;

  return update;
}

function applyEncounterCorrections(input: Record<string, unknown>): Partial<typeof encounters.$inferInsert> {
  const parsed = encounterCorrectionSchema.parse(input);
  const update: Partial<typeof encounters.$inferInsert> = {};

  if (parsed.encounterType !== undefined) update.encounterType = parsed.encounterType;
  if (parsed.providerName !== undefined) update.providerName = parsed.providerName;
  if (parsed.facilityName !== undefined) update.facilityName = parsed.facilityName;
  if (parsed.startedAt !== undefined) update.startedAt = parsed.startedAt;
  if (parsed.endedAt !== undefined) update.endedAt = parsed.endedAt;
  if (parsed.reason !== undefined) update.reason = parsed.reason;

  return update;
}

function correctionsForResource(
  resourceType: CanonicalResourceType,
  corrections: Record<string, unknown>
): Record<string, unknown> {
  switch (resourceType) {
    case "observation":
      return applyObservationCorrections(corrections);
    case "condition":
      return applyConditionCorrections(corrections);
    case "medication":
      return applyMedicationCorrections(corrections);
    case "encounter":
      return applyEncounterCorrections(corrections);
  }
}

async function loadCanonicalRecord(
  db: OpenVitalsDbExecutor,
  ownerUserId: string,
  resourceType: CanonicalResourceType,
  resourceId: string
): Promise<CanonicalRecord | null> {
  const table = canonicalTableFor(resourceType);
  const [record] = await db
    .select()
    .from(table)
    .where(eq(table.id, resourceId))
    .limit(1);

  if (!record || record.ownerUserId !== ownerUserId) {
    return null;
  }

  return record as CanonicalRecord;
}

async function persistAttachNote(
  db: OpenVitalsDbExecutor,
  input: {
    ownerUserId: string;
    actor: Actor;
    reviewTask: ReviewTask;
    note: string;
    resolveTask: boolean;
  }
): Promise<{ reviewTask: ReviewTask; recordRevision: RecordRevision | null }> {
  const update: Partial<typeof reviewTasks.$inferInsert> = {
    resolutionNote: input.note,
    updatedAt: new Date()
  };

  if (input.resolveTask) {
    update.status = "resolved";
    update.resolutionAction = "attach_note";
    update.resolvedByUserId = buildResolverUserId(input.actor) ?? null;
    update.resolvedAt = new Date();
  }

  const [updated] = await db
    .update(reviewTasks)
    .set(update)
    .where(eq(reviewTasks.id, input.reviewTask.id))
    .returning();

  if (!updated) {
    throw new ReviewActionError(409, "review_task_update_failed", "Could not attach note to review task.");
  }

  await enqueueOutboxEvent(db, {
    eventType: "record.note_attached",
    aggregateType: input.reviewTask.resourceType ?? "review_task",
    aggregateId: input.reviewTask.resourceId ?? input.reviewTask.id,
    ownerUserId: input.ownerUserId,
    actor: input.actor,
    payload: {
      reviewTaskId: input.reviewTask.id,
      resourceType: input.reviewTask.resourceType,
      resourceId: input.reviewTask.resourceId,
      sourceRecordId: input.reviewTask.sourceRecordId,
      note: input.note
    }
  });

  await writeAuditEvent(db, {
    action: "record.note_attached",
    resourceType: "review_task",
    resourceId: input.reviewTask.id,
    ownerUserId: input.ownerUserId,
    actor: input.actor,
    metadata: {
      reviewTaskId: input.reviewTask.id,
      reviewResourceType: input.reviewTask.resourceType,
      reviewResourceId: input.reviewTask.resourceId,
      sourceRecordId: input.reviewTask.sourceRecordId,
      resolved: input.resolveTask
    }
  });

  return { reviewTask: updated, recordRevision: null };
}

export async function applyReviewAction(
  database: OpenVitalsDatabase,
  input: ApplyReviewActionInput
): Promise<ApplyReviewActionResult> {
  if (!input.reviewTaskId && !(input.resourceType && input.resourceId)) {
    throw new ReviewActionError(
      400,
      "review_target_required",
      "A review task id or resource id must be provided."
    );
  }

  return database.transaction(async (tx) => {
    let reviewTask: ReviewTask | null = null;
    let resourceType: string | null = input.resourceType ?? null;
    let resourceId: string | null = input.resourceId ?? null;
    let sourceRecordId: string | null = null;

    if (input.reviewTaskId) {
      reviewTask = await getReviewTaskById(tx, {
        ownerUserId: input.ownerUserId,
        reviewTaskId: input.reviewTaskId
      });

      if (!reviewTask) {
        throw new ReviewActionError(404, "review_task_not_found", "Review task not found.");
      }

      if (reviewTask.status !== "open") {
        throw new ReviewActionError(409, "review_task_already_closed", "Review task is not open.");
      }

      resourceType = reviewTask.resourceType ?? resourceType;
      resourceId = reviewTask.resourceId ?? resourceId;
      sourceRecordId = reviewTask.sourceRecordId;
    }

    if (input.action === "attach_note") {
      if (!reviewTask) {
        throw new ReviewActionError(
          400,
          "attach_note_requires_review_task",
          "Notes can only be attached to a review task."
        );
      }
      if (!input.note || input.note.trim().length === 0) {
        throw new ReviewActionError(400, "note_required", "A note is required for attach_note.");
      }

      const { reviewTask: updatedTask, recordRevision } = await persistAttachNote(tx, {
        ownerUserId: input.ownerUserId,
        actor: input.actor,
        reviewTask,
        note: input.note,
        resolveTask: false
      });

      return {
        reviewTask: updatedTask,
        cascadedReviewTaskIds: [],
        resourceType: updatedTask.resourceType ?? null,
        resourceId: updatedTask.resourceId ?? null,
        recordRevision,
        updatedRecord: null
      };
    }

    const effect = actionEffects[input.action];

    const isCanonicalAction = isCanonicalResourceType(resourceType);

    if (!isCanonicalAction) {
      if (!reviewTask) {
        throw new ReviewActionError(
          400,
          "unsupported_resource_for_action",
          "Action requires a canonical record context."
        );
      }

      const updatedTask = await resolveReviewTask(tx, {
        ownerUserId: input.ownerUserId,
        reviewTaskId: reviewTask.id,
        resolutionAction: input.action,
        resolutionNote: input.note,
        resolvedByUserId: buildResolverUserId(input.actor),
        status: effect.taskStatus
      });

      if (!updatedTask) {
        throw new ReviewActionError(409, "review_task_already_closed", "Review task is not open.");
      }

      await enqueueOutboxEvent(tx, {
        eventType: effect.domainEventType,
        aggregateType: reviewTask.resourceType ?? "review_task",
        aggregateId: reviewTask.resourceId ?? reviewTask.id,
        ownerUserId: input.ownerUserId,
        actor: input.actor,
        payload: {
          reviewTaskId: reviewTask.id,
          resourceType: reviewTask.resourceType,
          resourceId: reviewTask.resourceId,
          sourceRecordId: reviewTask.sourceRecordId
        }
      });

      await writeAuditEvent(tx, {
        action: effect.auditAction,
        resourceType: "review_task",
        resourceId: reviewTask.id,
        ownerUserId: input.ownerUserId,
        actor: input.actor,
        metadata: {
          reviewTaskId: reviewTask.id,
          reviewResourceType: reviewTask.resourceType,
          reviewResourceId: reviewTask.resourceId,
          sourceRecordId: reviewTask.sourceRecordId,
          action: input.action
        }
      });

      return {
        reviewTask: updatedTask,
        cascadedReviewTaskIds: [],
        resourceType: reviewTask.resourceType ?? null,
        resourceId: reviewTask.resourceId ?? null,
        recordRevision: null,
        updatedRecord: null
      };
    }

    if (!resourceId) {
      throw new ReviewActionError(400, "resource_id_required", "Action requires a canonical record id.");
    }

    const canonicalType = resourceType as CanonicalResourceType;
    const canonicalRecord = await loadCanonicalRecord(tx, input.ownerUserId, canonicalType, resourceId);
    if (!canonicalRecord) {
      throw new ReviewActionError(404, "resource_not_found", "Canonical record not found.");
    }

    const previousValue = snapshot(canonicalRecord);
    const table = canonicalTableFor(canonicalType);

    let mergeIntoResourceId: string | null = null;
    if (input.action === "merge_duplicate") {
      const mergeId = input.mergeIntoResourceId;
      if (!mergeId) {
        throw new ReviewActionError(
          400,
          "merge_target_required",
          "merge_duplicate requires a target resource id."
        );
      }
      if (mergeId === resourceId) {
        throw new ReviewActionError(
          400,
          "merge_target_invalid",
          "merge_duplicate target cannot be the same record."
        );
      }
      const mergeTarget = await loadCanonicalRecord(tx, input.ownerUserId, canonicalType, mergeId);
      if (!mergeTarget) {
        throw new ReviewActionError(404, "merge_target_not_found", "merge_duplicate target not found.");
      }
      mergeIntoResourceId = mergeId;
    }

    const fieldUpdate =
      input.action === "correct" && input.corrections
        ? correctionsForResource(canonicalType, input.corrections)
        : {};

    const existingMetadata = (canonicalRecord.metadata as JsonObject | null) ?? {};
    const reviewMetadata: JsonObject = {
      ...existingMetadata,
      lastReviewAction: input.action,
      lastReviewActorType: input.actor.type,
      lastReviewActorId: "id" in input.actor && input.actor.id ? input.actor.id : null,
      lastReviewAt: new Date().toISOString()
    };

    if (input.action === "merge_duplicate" && mergeIntoResourceId) {
      reviewMetadata.mergedIntoResourceId = mergeIntoResourceId;
    }
    if (input.note) {
      reviewMetadata.lastReviewNote = input.note;
    }

    const updatePayload: Record<string, unknown> = {
      ...fieldUpdate,
      reviewState: effect.reviewState,
      metadata: reviewMetadata,
      updatedAt: new Date()
    };

    if (effect.trustLevel) {
      updatePayload.trustLevel = effect.trustLevel;
    }

    const [updatedRecord] = await tx
      .update(table)
      .set(updatePayload)
      .where(eq(table.id, resourceId))
      .returning();

    if (!updatedRecord) {
      throw new ReviewActionError(409, "record_update_failed", "Failed to update canonical record.");
    }

    if (sourceRecordId) {
      await tx
        .update(sourceRecords)
        .set({
          reviewState: effect.reviewState,
          updatedAt: new Date()
        })
        .where(eq(sourceRecords.id, sourceRecordId));
    }

    const newValue = snapshot(updatedRecord as CanonicalRecord);

    const recordRevision = await writeRecordRevision(tx, {
      ownerUserId: input.ownerUserId,
      resourceType: canonicalType,
      resourceId,
      previousValue,
      newValue,
      reason: input.action,
      actor: input.actor
    });

    let resolvedReviewTask: ReviewTask | null = null;
    let cascadedIds: string[] = [];
    if (reviewTask) {
      resolvedReviewTask = await resolveReviewTask(tx, {
        ownerUserId: input.ownerUserId,
        reviewTaskId: reviewTask.id,
        resolutionAction: input.action,
        resolutionNote: input.note,
        resolvedByUserId: buildResolverUserId(input.actor),
        status: effect.taskStatus
      });

      if (!resolvedReviewTask) {
        throw new ReviewActionError(409, "review_task_already_closed", "Review task is not open.");
      }
    }

    const cascadeCandidates = await listOpenReviewTasksForResource(tx, {
      ownerUserId: input.ownerUserId,
      resourceType: canonicalType,
      resourceId,
      excludeReviewTaskId: reviewTask?.id
    });

    if (cascadeCandidates.length > 0) {
      cascadedIds = await bulkResolveReviewTasks(tx, {
        ownerUserId: input.ownerUserId,
        reviewTaskIds: cascadeCandidates.map((task) => task.id),
        resolutionAction: input.action,
        resolutionNote: input.note,
        resolvedByUserId: buildResolverUserId(input.actor),
        status: effect.taskStatus
      });
    }

    await enqueueOutboxEvent(tx, {
      eventType: effect.domainEventType,
      aggregateType: canonicalType,
      aggregateId: resourceId,
      ownerUserId: input.ownerUserId,
      actor: input.actor,
      payload: {
        reviewTaskId: reviewTask?.id ?? null,
        cascadedReviewTaskIds: cascadedIds,
        resourceType: canonicalType,
        resourceId,
        recordRevisionId: recordRevision.id,
        sourceRecordId,
        mergeIntoResourceId
      }
    });

    await writeAuditEvent(tx, {
      action: effect.auditAction,
      resourceType: canonicalType,
      resourceId,
      ownerUserId: input.ownerUserId,
      actor: input.actor,
      metadata: {
        reviewTaskId: reviewTask?.id ?? null,
        cascadedReviewTaskIds: cascadedIds,
        recordRevisionId: recordRevision.id,
        sourceRecordId,
        mergeIntoResourceId,
        action: input.action
      }
    });

    if (resolvedReviewTask) {
      await enqueueOutboxEvent(tx, {
        eventType: "review_task.resolved",
        aggregateType: "review_task",
        aggregateId: resolvedReviewTask.id,
        ownerUserId: input.ownerUserId,
        actor: input.actor,
        payload: {
          reviewTaskId: resolvedReviewTask.id,
          resolutionAction: input.action,
          status: resolvedReviewTask.status,
          resourceType: canonicalType,
          resourceId,
          cascadedReviewTaskIds: cascadedIds
        }
      });

      await writeAuditEvent(tx, {
        action: "review_task.resolved",
        resourceType: "review_task",
        resourceId: resolvedReviewTask.id,
        ownerUserId: input.ownerUserId,
        actor: input.actor,
        metadata: {
          resolutionAction: input.action,
          status: resolvedReviewTask.status,
          resourceType: canonicalType,
          resourceId,
          cascadedReviewTaskIds: cascadedIds
        }
      });
    }

    return {
      reviewTask: resolvedReviewTask,
      cascadedReviewTaskIds: cascadedIds,
      resourceType: canonicalType,
      resourceId,
      recordRevision,
      updatedRecord: updatedRecord as CanonicalRecord
    };
  });
}
