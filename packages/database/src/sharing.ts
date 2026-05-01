import { and, eq, gt, gte, isNull, lte, or, type SQL } from "drizzle-orm";
import type { Actor } from "@openvitals/domain";
import type { OpenVitalsDatabase } from "./client";
import { auditEvents, observations, sharePolicies, sharePolicyScopes } from "./schema";

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
  now?: Date;
};

export async function listSharedObservations(
  db: OpenVitalsDatabase,
  input: ListSharedObservationsInput
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
  db: OpenVitalsDatabase,
  input: {
    ownerUserId: string;
    policyId: string;
    actor: Extract<Actor, { type: "recipient" | "user" | "admin" | "system" }>;
    resultCount: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await db.insert(auditEvents).values({
    ownerUserId: input.ownerUserId,
    actorType: input.actor.type,
    actorId: input.actor.id ?? null,
    action: "share.accessed",
    resourceType: "share_policy",
    resourceId: input.policyId,
    metadata: {
      resultCount: input.resultCount,
      ...(input.metadata ?? {})
    }
  });
}
