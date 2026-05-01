import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  listSharedObservations,
  sharePolicies,
  sharePolicyScopes,
  type OpenVitalsDatabase
} from "@openvitals/database";
import { recipientActor, recordCategories } from "@openvitals/domain";
import { enqueueOutboxEvent, writeAuditEvent } from "@openvitals/events";
import type { AuthenticatedOwnerContext } from "./ownership";

export class ShareApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ShareApiError";
  }
}

export const createSharePolicyBodySchema = z
  .object({
    recipientUserId: z.uuid().optional(),
    recipientEmail: z.email().optional(),
    recipientName: z.string().trim().min(1).max(200).optional(),
    categories: z.array(z.enum(recordCategories)).min(1),
    includeSourceDocuments: z.boolean().default(false),
    startsAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    fromObservedAt: z.coerce.date().nullable().optional(),
    toObservedAt: z.coerce.date().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .superRefine((value, ctx) => {
    if (!value.recipientUserId && !value.recipientEmail) {
      ctx.addIssue({
        code: "custom",
        path: ["recipientEmail"],
        message: "A share policy requires either an authenticated recipient or recipient email."
      });
    }

    if (value.expiresAt && value.startsAt && value.expiresAt <= value.startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Share policy expiry must be after the start time."
      });
    }

    if (value.fromObservedAt && value.toObservedAt && value.toObservedAt < value.fromObservedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["toObservedAt"],
        message: "Share policy record window end must be after the start."
      });
    }
  });

export type CreateSharePolicyBody = z.infer<typeof createSharePolicyBodySchema>;

function actorUserId(actor: AuthenticatedOwnerContext["actor"]): string | null {
  return actor.type === "user" || actor.type === "admin" ? actor.id : null;
}

export async function listSharePoliciesForOwner(
  db: OpenVitalsDatabase,
  input: { owner: Pick<AuthenticatedOwnerContext, "ownerUserId">; limit?: number }
) {
  const rows = await db
    .select({ policy: sharePolicies, scope: sharePolicyScopes })
    .from(sharePolicies)
    .leftJoin(sharePolicyScopes, eq(sharePolicyScopes.policyId, sharePolicies.id))
    .where(eq(sharePolicies.ownerUserId, input.owner.ownerUserId))
    .orderBy(desc(sharePolicies.createdAt), asc(sharePolicyScopes.category))
    .limit(input.limit ?? 100);

  const byPolicy = new Map<string, { policy: typeof sharePolicies.$inferSelect; scopes: (typeof sharePolicyScopes.$inferSelect)[] }>();
  for (const row of rows) {
    const existing = byPolicy.get(row.policy.id);
    if (existing) {
      if (row.scope) existing.scopes.push(row.scope);
      continue;
    }
    byPolicy.set(row.policy.id, {
      policy: row.policy,
      scopes: row.scope ? [row.scope] : []
    });
  }

  return [...byPolicy.values()];
}

export async function createSharePolicy(
  db: OpenVitalsDatabase,
  input: {
    owner: Pick<AuthenticatedOwnerContext, "ownerUserId" | "actor">;
    body: CreateSharePolicyBody;
  }
) {
  return db.transaction(async (tx) => {
    const now = new Date();
    const categories = [...new Set(input.body.categories)];
    const [policy] = await tx
      .insert(sharePolicies)
      .values({
        ownerUserId: input.owner.ownerUserId,
        recipientUserId: input.body.recipientUserId ?? null,
        recipientEmail: input.body.recipientEmail ?? null,
        recipientName: input.body.recipientName ?? null,
        startsAt: input.body.startsAt ?? now,
        expiresAt: input.body.expiresAt ?? null,
        fromObservedAt: input.body.fromObservedAt ?? null,
        toObservedAt: input.body.toObservedAt ?? null,
        createdByUserId: actorUserId(input.owner.actor),
        metadata: input.body.metadata ?? {}
      })
      .returning();

    if (!policy) {
      throw new Error("Failed to create share policy");
    }

    await tx.insert(sharePolicyScopes).values(
      categories.map((category) => ({
        policyId: policy.id,
        category,
        includeSourceDocuments: input.body.includeSourceDocuments
      }))
    );

    await enqueueOutboxEvent(tx, {
      eventType: "share.created",
      aggregateType: "share_policy",
      aggregateId: policy.id,
      ownerUserId: input.owner.ownerUserId,
      actor: input.owner.actor,
      payload: {
        categories,
        recipientUserId: input.body.recipientUserId ?? null,
        recipientEmail: input.body.recipientEmail ?? null,
        expiresAt: policy.expiresAt?.toISOString() ?? null
      }
    });

    await writeAuditEvent(tx, {
      action: "share.created",
      resourceType: "share_policy",
      resourceId: policy.id,
      ownerUserId: input.owner.ownerUserId,
      actor: input.owner.actor,
      metadata: {
        categories,
        recipientUserId: input.body.recipientUserId ?? null,
        recipientEmail: input.body.recipientEmail ?? null
      }
    });

    const scopes = await tx
      .select()
      .from(sharePolicyScopes)
      .where(eq(sharePolicyScopes.policyId, policy.id))
      .orderBy(asc(sharePolicyScopes.category));

    return { policy, scopes };
  });
}

export async function revokeSharePolicy(
  db: OpenVitalsDatabase,
  input: {
    owner: Pick<AuthenticatedOwnerContext, "ownerUserId" | "actor">;
    sharePolicyId: string;
  }
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(sharePolicies)
      .where(
        and(
          eq(sharePolicies.ownerUserId, input.owner.ownerUserId),
          eq(sharePolicies.id, input.sharePolicyId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new ShareApiError(404, "share_policy_not_found", "Share policy not found.");
    }

    if (existing.status === "revoked") {
      return existing;
    }

    const revokedAt = new Date();
    const [revoked] = await tx
      .update(sharePolicies)
      .set({
        status: "revoked",
        revokedAt,
        revokedByUserId: actorUserId(input.owner.actor),
        updatedAt: revokedAt
      })
      .where(
        and(
          eq(sharePolicies.ownerUserId, input.owner.ownerUserId),
          eq(sharePolicies.id, input.sharePolicyId)
        )
      )
      .returning();

    if (!revoked) {
      throw new ShareApiError(409, "share_policy_revoke_failed", "Share policy could not be revoked.");
    }

    await enqueueOutboxEvent(tx, {
      eventType: "share.revoked",
      aggregateType: "share_policy",
      aggregateId: revoked.id,
      ownerUserId: input.owner.ownerUserId,
      actor: input.owner.actor,
      payload: { revokedAt: revokedAt.toISOString() }
    });

    await writeAuditEvent(tx, {
      action: "share.revoked",
      resourceType: "share_policy",
      resourceId: revoked.id,
      ownerUserId: input.owner.ownerUserId,
      actor: input.owner.actor,
      metadata: { revokedAt: revokedAt.toISOString() }
    });

    return revoked;
  });
}

export async function listSharedObservationsForAuthenticatedRecipient(
  db: OpenVitalsDatabase,
  input: {
    recipient: Pick<AuthenticatedOwnerContext, "ownerUserId">;
    sharePolicyId: string;
  }
) {
  return listSharedObservations(db, {
    policyId: input.sharePolicyId,
    recipientUserId: input.recipient.ownerUserId,
    actor: recipientActor(input.recipient.ownerUserId),
    metadata: { channel: "authenticated_recipient" }
  });
}
