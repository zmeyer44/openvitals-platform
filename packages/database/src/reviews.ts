import { and, asc, eq, inArray, ne, type SQL } from "drizzle-orm";
import type { Actor } from "@openvitals/domain";
import type { OpenVitalsDbExecutor } from "./client";
import { recordRevisions, reviewTasks, type JsonObject } from "./schema";

export type ReviewTask = typeof reviewTasks.$inferSelect;
export type ReviewTaskStatus = ReviewTask["status"];
export type ReviewTaskResolutionAction = NonNullable<ReviewTask["resolutionAction"]>;

export type ListReviewTasksInput = {
  ownerUserId: string;
  status?: ReviewTaskStatus | undefined;
  resourceType?: string | undefined;
  resourceId?: string | undefined;
  sourceRecordId?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export async function listReviewTasks(
  db: OpenVitalsDbExecutor,
  input: ListReviewTasksInput
): Promise<ReviewTask[]> {
  const conditions: SQL[] = [eq(reviewTasks.ownerUserId, input.ownerUserId)];

  if (input.status) {
    conditions.push(eq(reviewTasks.status, input.status));
  }
  if (input.resourceType) {
    conditions.push(eq(reviewTasks.resourceType, input.resourceType));
  }
  if (input.resourceId) {
    conditions.push(eq(reviewTasks.resourceId, input.resourceId));
  }
  if (input.sourceRecordId) {
    conditions.push(eq(reviewTasks.sourceRecordId, input.sourceRecordId));
  }

  return db
    .select()
    .from(reviewTasks)
    .where(and(...conditions))
    .orderBy(asc(reviewTasks.createdAt))
    .limit(input.limit ?? 100)
    .offset(input.offset ?? 0);
}

export async function getReviewTaskById(
  db: OpenVitalsDbExecutor,
  input: { ownerUserId: string; reviewTaskId: string }
): Promise<ReviewTask | null> {
  const [task] = await db
    .select()
    .from(reviewTasks)
    .where(and(eq(reviewTasks.ownerUserId, input.ownerUserId), eq(reviewTasks.id, input.reviewTaskId)))
    .limit(1);

  return task ?? null;
}

export async function listOpenReviewTasksForResource(
  db: OpenVitalsDbExecutor,
  input: {
    ownerUserId: string;
    resourceType: string;
    resourceId: string;
    excludeReviewTaskId?: string | undefined;
  }
): Promise<ReviewTask[]> {
  const conditions: SQL[] = [
    eq(reviewTasks.ownerUserId, input.ownerUserId),
    eq(reviewTasks.resourceType, input.resourceType),
    eq(reviewTasks.resourceId, input.resourceId),
    eq(reviewTasks.status, "open")
  ];

  if (input.excludeReviewTaskId) {
    conditions.push(ne(reviewTasks.id, input.excludeReviewTaskId));
  }

  return db
    .select()
    .from(reviewTasks)
    .where(and(...conditions));
}

export type ResolveReviewTaskInput = {
  ownerUserId: string;
  reviewTaskId: string;
  resolutionAction: ReviewTaskResolutionAction;
  resolutionNote?: string | undefined;
  resolvedByUserId?: string | undefined;
  status?: Extract<ReviewTaskStatus, "resolved" | "dismissed"> | undefined;
};

export async function resolveReviewTask(
  db: OpenVitalsDbExecutor,
  input: ResolveReviewTaskInput
): Promise<ReviewTask | null> {
  const [updated] = await db
    .update(reviewTasks)
    .set({
      status: input.status ?? "resolved",
      resolutionAction: input.resolutionAction,
      resolutionNote: input.resolutionNote ?? null,
      resolvedByUserId: input.resolvedByUserId ?? null,
      resolvedAt: new Date(),
      updatedAt: new Date()
    })
    .where(
      and(
        eq(reviewTasks.ownerUserId, input.ownerUserId),
        eq(reviewTasks.id, input.reviewTaskId),
        eq(reviewTasks.status, "open")
      )
    )
    .returning();

  return updated ?? null;
}

export async function bulkResolveReviewTasks(
  db: OpenVitalsDbExecutor,
  input: {
    ownerUserId: string;
    reviewTaskIds: string[];
    resolutionAction: ReviewTaskResolutionAction;
    resolutionNote?: string | undefined;
    resolvedByUserId?: string | undefined;
    status?: Extract<ReviewTaskStatus, "resolved" | "dismissed"> | undefined;
  }
): Promise<string[]> {
  if (input.reviewTaskIds.length === 0) {
    return [];
  }

  const updated = await db
    .update(reviewTasks)
    .set({
      status: input.status ?? "resolved",
      resolutionAction: input.resolutionAction,
      resolutionNote: input.resolutionNote ?? null,
      resolvedByUserId: input.resolvedByUserId ?? null,
      resolvedAt: new Date(),
      updatedAt: new Date()
    })
    .where(
      and(
        eq(reviewTasks.ownerUserId, input.ownerUserId),
        inArray(reviewTasks.id, input.reviewTaskIds),
        eq(reviewTasks.status, "open")
      )
    )
    .returning({ id: reviewTasks.id });

  return updated.map((row) => row.id);
}

export type RecordRevision = typeof recordRevisions.$inferSelect;

export type WriteRecordRevisionInput = {
  ownerUserId: string;
  resourceType: string;
  resourceId: string;
  previousValue: JsonObject;
  newValue: JsonObject;
  reason?: string | undefined;
  actor: Actor;
};

export async function writeRecordRevision(
  db: OpenVitalsDbExecutor,
  input: WriteRecordRevisionInput
): Promise<RecordRevision> {
  const [revision] = await db
    .insert(recordRevisions)
    .values({
      ownerUserId: input.ownerUserId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      previousValue: input.previousValue,
      newValue: input.newValue,
      reason: input.reason ?? null,
      actorType: input.actor.type,
      actorId: input.actor.id ?? null
    })
    .returning();

  if (!revision) {
    throw new Error("Failed to write record revision");
  }

  return revision;
}

export async function listRecordRevisions(
  db: OpenVitalsDbExecutor,
  input: { ownerUserId: string; resourceType: string; resourceId: string; limit?: number }
): Promise<RecordRevision[]> {
  return db
    .select()
    .from(recordRevisions)
    .where(
      and(
        eq(recordRevisions.ownerUserId, input.ownerUserId),
        eq(recordRevisions.resourceType, input.resourceType),
        eq(recordRevisions.resourceId, input.resourceId)
      )
    )
    .orderBy(asc(recordRevisions.createdAt))
    .limit(input.limit ?? 100);
}
