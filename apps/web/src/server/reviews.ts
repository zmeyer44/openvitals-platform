import { z } from "zod";
import {
  getReviewTaskById,
  listReviewTasks,
  type OpenVitalsDatabase,
  type ReviewTask
} from "@openvitals/database";
import { reviewActions, reviewResolutionSchema } from "@openvitals/domain";
import {
  applyReviewAction,
  ReviewActionError,
  type ApplyReviewActionResult
} from "@openvitals/events";
import type { AuthenticatedOwnerContext } from "./ownership";

export class ReviewApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ReviewApiError";
  }
}

export const reviewTaskStatusSchema = z.enum(["open", "resolved", "dismissed"]);

export const listReviewTasksQuerySchema = z.object({
  status: reviewTaskStatusSchema.optional(),
  resourceType: z.string().trim().min(1).optional(),
  resourceId: z.uuid().optional(),
  sourceRecordId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export type ListReviewTasksQuery = z.infer<typeof listReviewTasksQuerySchema>;

export async function listReviewTasksForOwner(
  db: OpenVitalsDatabase,
  input: { owner: Pick<AuthenticatedOwnerContext, "ownerUserId">; query: ListReviewTasksQuery }
): Promise<ReviewTask[]> {
  return listReviewTasks(db, {
    ownerUserId: input.owner.ownerUserId,
    status: input.query.status,
    resourceType: input.query.resourceType,
    resourceId: input.query.resourceId,
    sourceRecordId: input.query.sourceRecordId,
    limit: input.query.limit,
    offset: input.query.offset
  });
}

export async function getReviewTaskForOwner(
  db: OpenVitalsDatabase,
  input: { owner: Pick<AuthenticatedOwnerContext, "ownerUserId">; reviewTaskId: string }
): Promise<ReviewTask | null> {
  return getReviewTaskById(db, {
    ownerUserId: input.owner.ownerUserId,
    reviewTaskId: input.reviewTaskId
  });
}

export const resolveReviewTaskBodySchema = reviewResolutionSchema;

export type ResolveReviewTaskInput = z.infer<typeof resolveReviewTaskBodySchema>;

export async function resolveReviewTaskForOwner(
  db: OpenVitalsDatabase,
  input: {
    owner: Pick<AuthenticatedOwnerContext, "ownerUserId" | "actor">;
    reviewTaskId: string;
    body: ResolveReviewTaskInput;
  }
): Promise<ApplyReviewActionResult> {
  try {
    return await applyReviewAction(db, {
      ownerUserId: input.owner.ownerUserId,
      actor: input.owner.actor,
      reviewTaskId: input.reviewTaskId,
      action: input.body.action,
      note: input.body.note,
      corrections: input.body.corrections,
      mergeIntoResourceId: input.body.mergeIntoResourceId
    });
  } catch (error) {
    if (error instanceof ReviewActionError) {
      throw new ReviewApiError(error.status, error.code, error.message);
    }
    throw error;
  }
}

export const recordActionBodySchema = reviewResolutionSchema;

export type RecordActionInput = z.infer<typeof recordActionBodySchema>;

export const canonicalResourceTypeSchema = z.enum(["observation", "condition", "medication", "encounter"]);

export async function applyActionToCanonicalRecord(
  db: OpenVitalsDatabase,
  input: {
    owner: Pick<AuthenticatedOwnerContext, "ownerUserId" | "actor">;
    resourceType: z.infer<typeof canonicalResourceTypeSchema>;
    resourceId: string;
    body: RecordActionInput;
  }
): Promise<ApplyReviewActionResult> {
  try {
    return await applyReviewAction(db, {
      ownerUserId: input.owner.ownerUserId,
      actor: input.owner.actor,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      action: input.body.action,
      note: input.body.note,
      corrections: input.body.corrections,
      mergeIntoResourceId: input.body.mergeIntoResourceId
    });
  } catch (error) {
    if (error instanceof ReviewActionError) {
      throw new ReviewApiError(error.status, error.code, error.message);
    }
    throw error;
  }
}

export { reviewActions };
