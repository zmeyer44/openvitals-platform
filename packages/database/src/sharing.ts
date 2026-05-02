import { and, eq, gt, gte, isNull, lte, or, type SQL } from "drizzle-orm";
import type { Actor } from "@openvitals/domain";
import type { OpenVitalsDbExecutor } from "./client";
import { auditEvents, observations, outboxEvents, sharePolicies, sharePolicyScopes } from "./schema";

export type SharedObservationRow = {
  id: string;
  displayName: string;
  observedAt: Date | null;
  originalValue: string | null;
  valueNumeric: string | null;
  valueText: string | null;
  unitOriginal: string | null;
  unitNormalized: string | null;
  confidence: string | null;
  reviewState: string;
  trustLevel: string;
};

export type ListSharedObservationsInput = {
  policyId: string;
  recipientUserId?: string;
  recipientEmail?: string;
  actor: Extract<Actor, { type: "recipient" | "user" | "admin" | "system" }>;
  metadata?: Record<string, unknown>;
  now?: Date;
};

export async function listSharedObservations(
  db: OpenVitalsDbExecutor,
  input: ListSharedObservationsInput
): Promise<SharedObservationRow[]> {
  return db.transaction(async (tx) => {
    const policy = await findAccessibleSharePolicy(tx, input);
    if (!policy) {
      return [];
    }

    const rows = await listSharedObservationsUnchecked(tx, input);
    await recordShareAccess(tx, {
      ownerUserId: policy.ownerUserId,
      policyId: input.policyId,
      actor: input.actor,
      resultCount: rows.length,
      ...(input.metadata ? { metadata: input.metadata } : {})
    });
    return rows;
  });
}

async function findAccessibleSharePolicy(
  db: OpenVitalsDbExecutor,
  input: ListSharedObservationsInput
): Promise<{ ownerUserId: string } | null> {
  const now = input.now ?? new Date();
  const conditions: SQL[] = [
    eq(sharePolicies.id, input.policyId),
    eq(sharePolicies.status, "active"),
    lte(sharePolicies.startsAt, now),
    or(isNull(sharePolicies.expiresAt), gt(sharePolicies.expiresAt, now))!
  ];

  if (input.recipientUserId) {
    conditions.push(eq(sharePolicies.recipientUserId, input.recipientUserId));
  }

  if (input.recipientEmail) {
    conditions.push(eq(sharePolicies.recipientEmail, input.recipientEmail));
  }

  const [policy] = await db
    .select({ ownerUserId: sharePolicies.ownerUserId })
    .from(sharePolicies)
    .where(and(...conditions))
    .limit(1);

  return policy ?? null;
}

async function listSharedObservationsUnchecked(
  db: OpenVitalsDbExecutor,
  input: Omit<ListSharedObservationsInput, "actor" | "metadata">
): Promise<SharedObservationRow[]> {
  const now = input.now ?? new Date();
  const conditions: SQL[] = [
    eq(sharePolicies.id, input.policyId),
    eq(sharePolicies.status, "active"),
    lte(sharePolicies.startsAt, now),
    or(isNull(sharePolicies.expiresAt), gt(sharePolicies.expiresAt, now))!,
    eq(sharePolicies.ownerUserId, observations.ownerUserId),
    eq(sharePolicyScopes.policyId, sharePolicies.id),
    eq(sharePolicyScopes.category, observations.category)
  ];

  if (input.recipientUserId) {
    conditions.push(eq(sharePolicies.recipientUserId, input.recipientUserId));
  }

  if (input.recipientEmail) {
    conditions.push(eq(sharePolicies.recipientEmail, input.recipientEmail));
  }

  conditions.push(
    or(isNull(sharePolicies.fromObservedAt), and(gte(observations.observedAt, sharePolicies.fromObservedAt)))!
  );
  conditions.push(
    or(isNull(sharePolicies.toObservedAt), and(lte(observations.observedAt, sharePolicies.toObservedAt)))!
  );

  return db
    .select({
      id: observations.id,
      displayName: observations.displayName,
      observedAt: observations.observedAt,
      originalValue: observations.originalValue,
      valueNumeric: observations.valueNumeric,
      valueText: observations.valueText,
      unitOriginal: observations.unitOriginal,
      unitNormalized: observations.unitNormalized,
      confidence: observations.confidence,
      reviewState: observations.reviewState,
      trustLevel: observations.trustLevel
    })
    .from(observations)
    .innerJoin(sharePolicies, eq(sharePolicies.ownerUserId, observations.ownerUserId))
    .innerJoin(sharePolicyScopes, eq(sharePolicyScopes.policyId, sharePolicies.id))
    .where(and(...conditions));
}

export async function recordShareAccess(
  db: OpenVitalsDbExecutor,
  input: {
    ownerUserId: string;
    policyId: string;
    actor: Extract<Actor, { type: "recipient" | "user" | "admin" | "system" }>;
    resultCount: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const metadata = {
    resultCount: input.resultCount,
    ...(input.metadata ?? {})
  };

  await db.insert(auditEvents).values({
    ownerUserId: input.ownerUserId,
    actorType: input.actor.type,
    actorId: input.actor.id ?? null,
    action: "share.accessed",
    resourceType: "share_policy",
    resourceId: input.policyId,
    metadata
  });

  await db.insert(outboxEvents).values({
    eventType: "share.accessed",
    aggregateType: "share_policy",
    aggregateId: input.policyId,
    ownerUserId: input.ownerUserId,
    actorType: input.actor.type,
    actorId: input.actor.id ?? null,
    payload: metadata
  });
}
