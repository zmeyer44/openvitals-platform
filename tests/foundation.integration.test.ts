import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { Pool } from "pg";
import { recipientActor } from "../packages/domain/src/types";
import { createDb, type OpenVitalsDatabase } from "../packages/database/src/client";
import { completeJob, enqueueJob, failJob, leaseNextJob } from "../packages/database/src/jobs";
import { listSharedObservations } from "../packages/database/src/sharing";
import {
  appUsers,
  auditEvents,
  authUsers,
  importJobs,
  jobQueue,
  observations,
  outboxEvents,
  provenance,
  sharePolicies,
  sharePolicyScopes,
  sourceDocuments,
  sourceRecords
} from "../packages/database/src/schema";
import {
  claimNextOutboxEvent,
  emitAuditedEvent,
  markOutboxEventFailed,
  markOutboxEventSent
} from "../packages/events/src/outbox";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl && process.env.CI) {
  throw new Error("TEST_DATABASE_URL or DATABASE_URL is required for foundation integration tests in CI.");
}

const describeWithDatabase = databaseUrl ? describe.sequential : describe.skip;

let pool: Pool;
let db: OpenVitalsDatabase;

const tableNames = [
  "audit_events",
  "outbox_events",
  "review_tasks",
  "record_revisions",
  "provenance",
  "observations",
  "conditions",
  "medications",
  "encounters",
  "source_records",
  "file_classifications",
  "import_status_history",
  "import_jobs",
  "source_documents",
  "blob_objects",
  "share_policy_scopes",
  "share_policies",
  "intake_answers",
  "intake_workflows",
  "integrations",
  "integration_webhook_events",
  "user_profiles",
  "job_queue",
  "app_users",
  "auth_accounts",
  "auth_sessions",
  "auth_verifications",
  "auth_users"
];

async function truncateAllTables(): Promise<void> {
  await pool.query(`truncate table ${tableNames.join(", ")} restart identity cascade`);
}

async function createUser(input: { email: string; displayName: string }) {
  const externalAuthId = `test:${input.email}`;

  await db.insert(authUsers).values({
    id: externalAuthId,
    name: input.displayName,
    email: input.email,
    emailVerified: true
  });

  const [user] = await db
    .insert(appUsers)
    .values({
      email: input.email,
      displayName: input.displayName,
      externalAuthId
    })
    .returning();

  if (!user) {
    throw new Error("Failed to create test user");
  }

  return user;
}

async function createSource(input: {
  ownerUserId: string;
  sourceKind?: "file" | "integration" | "manual_intake" | "manual_entry";
  recordType?: "observation" | "condition" | "medication" | "encounter" | "note";
}) {
  const [document] = await db
    .insert(sourceDocuments)
    .values({
      ownerUserId: input.ownerUserId,
      sourceKind: input.sourceKind ?? "file",
      fileName: "foundation-labs.csv",
      mimeType: "text/csv",
      status: "normalized",
      classification: "lab_csv",
      parserName: "foundation.test",
      parserVersion: "0.0.0"
    })
    .returning();

  if (!document) {
    throw new Error("Failed to create test source document");
  }

  const [job] = await db
    .insert(importJobs)
    .values({
      ownerUserId: input.ownerUserId,
      sourceDocumentId: document.id,
      status: "normalized"
    })
    .returning();

  if (!job) {
    throw new Error("Failed to create test import job");
  }

  const [record] = await db
    .insert(sourceRecords)
    .values({
      ownerUserId: input.ownerUserId,
      sourceDocumentId: document.id,
      importJobId: job.id,
      recordType: input.recordType ?? "observation",
      parserName: "foundation.test",
      parserVersion: "0.0.0",
      sourceText: "name: Hemoglobin A1c; value: 5.4; unit: %",
      extractionConfidence: "0.9900",
      originalPayload: { name: "Hemoglobin A1c", value: "5.4", unit: "%" },
      reviewState: "not_required"
    })
    .returning();

  if (!record) {
    throw new Error("Failed to create test source record");
  }

  return { document, job, record };
}

describeWithDatabase("OpenVitals foundation database integration", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 1 });
    db = createDb(pool);
    await pool.query("select 1");
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("has migrated the required foundation tables and provenance constraints", async () => {
    const requiredTables = [
      "app_users",
      "source_documents",
      "file_classifications",
      "import_status_history",
      "source_records",
      "observations",
      "conditions",
      "medications",
      "encounters",
      "provenance",
      "job_queue",
      "outbox_events",
      "audit_events",
      "share_policies",
      "share_policy_scopes",
      "auth_users",
      "auth_sessions",
      "auth_accounts",
      "auth_verifications"
    ];

    const tableResult = await pool.query<{ table_name: string }>(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = any($1)
      `,
      [requiredTables]
    );

    expect(tableResult.rows.map((row) => row.table_name).sort()).toEqual(requiredTables.sort());

    const canonicalSourceColumns = await pool.query<{ table_name: string; is_nullable: string }>(
      `
        select table_name, is_nullable
        from information_schema.columns
        where table_schema = 'public'
          and table_name = any($1)
          and column_name = 'source_record_id'
      `,
      [["observations", "conditions", "medications", "encounters"]]
    );

    expect(canonicalSourceColumns.rows).toHaveLength(4);
    expect(canonicalSourceColumns.rows.every((row) => row.is_nullable === "NO")).toBe(true);

    const provenanceConstraint = await pool.query<{ conname: string }>(
      `
        select conname
        from pg_constraint
        where conname = 'provenance_origin_required'
          and contype = 'c'
      `
    );

    expect(provenanceConstraint.rows).toHaveLength(1);
  });

  it("runs durable jobs through idempotent enqueue, lease, complete, retry, and dead-letter states", async () => {
    const first = await enqueueJob(db, {
      kind: "foundation.import",
      idempotencyKey: "foundation.import:1",
      payload: { version: 1 },
      runAfter: new Date(Date.now() - 1000),
      maxAttempts: 1
    });

    const upserted = await enqueueJob(db, {
      kind: "foundation.import",
      idempotencyKey: "foundation.import:1",
      payload: { version: 2 },
      runAfter: new Date(Date.now() - 1000),
      maxAttempts: 1
    });

    expect(upserted.id).toBe(first.id);

    const leased = await leaseNextJob(db, "worker-foundation", ["foundation.import"]);
    expect(leased?.id).toBe(first.id);
    expect(leased?.attempts).toBe(1);
    expect(leased?.lockedBy).toBe("worker-foundation");
    expect(leased?.payload).toEqual({ version: 2 });

    if (!leased) {
      throw new Error("Expected to lease the idempotent job");
    }

    await failJob(db, leased, new Error("parser crashed"), { retryDelaySeconds: 0 });

    const [deadLettered] = await db.select().from(jobQueue).where(eq(jobQueue.id, leased.id)).limit(1);
    expect(deadLettered?.status).toBe("dead_letter");
    expect(deadLettered?.deadLetterReason).toBe("parser crashed");

    const completeCandidate = await enqueueJob(db, {
      kind: "foundation.outbox",
      payload: { version: 1 },
      runAfter: new Date(Date.now() - 1000)
    });
    const leasedForCompletion = await leaseNextJob(db, "worker-foundation", ["foundation.outbox"]);

    if (!leasedForCompletion) {
      throw new Error("Expected to lease a completion job");
    }

    expect(leasedForCompletion.id).toBe(completeCandidate.id);
    await completeJob(db, leasedForCompletion.id);

    const [completed] = await db.select().from(jobQueue).where(eq(jobQueue.id, completeCandidate.id)).limit(1);
    expect(completed?.status).toBe("completed");
    expect(completed?.lockedBy).toBeNull();
    expect(completed?.lastError).toBeNull();
  });

  it("persists audited outbox events and supports claiming, sent, and failed transitions", async () => {
    const owner = await createUser({ email: "owner@example.test", displayName: "Owner" });
    const aggregateId = randomUUID();

    const event = await emitAuditedEvent(db, {
      eventType: "share.created",
      aggregateType: "share_policy",
      aggregateId,
      ownerUserId: owner.id,
      actor: { type: "user", id: owner.id },
      payload: { categories: ["labs"] }
    });

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.action, "share.created"), eq(auditEvents.resourceId, aggregateId)))
      .limit(1);

    expect(audit?.actorId).toBe(owner.id);
    expect(audit?.resourceType).toBe("share_policy");

    const claimed = await claimNextOutboxEvent(db, "outbox-worker");
    expect(claimed?.id).toBe(event.id);
    expect(claimed?.attempts).toBe(1);

    if (!claimed) {
      throw new Error("Expected to claim outbox event");
    }

    await markOutboxEventSent(db, claimed.id);

    const [sent] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id)).limit(1);
    expect(sent?.status).toBe("sent");
    expect(sent?.processedAt).toBeInstanceOf(Date);

    const failedEvent = await emitAuditedEvent(db, {
      eventType: "integration.sync_failed",
      aggregateType: "integration",
      aggregateId: randomUUID(),
      ownerUserId: owner.id,
      actor: { type: "integration", id: "test-provider" },
      payload: { provider: "test-provider" }
    });

    const claimedFailure = await claimNextOutboxEvent(db, "outbox-worker");
    if (!claimedFailure) {
      throw new Error("Expected to claim failing outbox event");
    }

    expect(claimedFailure.id).toBe(failedEvent.id);
    await markOutboxEventFailed(db, claimedFailure, new Error("temporary downstream outage"));

    const [failed] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, failedEvent.id)).limit(1);
    expect(failed?.status).toBe("failed");
    expect(failed?.lastError).toBe("temporary downstream outage");
  });

  it("rejects canonical records and provenance rows that are not source-backed", async () => {
    const owner = await createUser({ email: "provenance@example.test", displayName: "Provenance" });
    const source = await createSource({ ownerUserId: owner.id });

    const [observation] = await db
      .insert(observations)
      .values({
        ownerUserId: owner.id,
        sourceRecordId: source.record.id,
        category: "labs",
        displayName: "Hemoglobin A1c",
        observedAt: new Date("2025-01-15T10:00:00Z"),
        originalValue: "5.4",
        valueNumeric: "5.400000",
        unitOriginal: "%",
        unitNormalized: "%",
        reviewState: "not_required",
        trustLevel: "parser_extracted"
      })
      .returning();

    if (!observation) {
      throw new Error("Expected observation to be inserted");
    }

    await db.insert(provenance).values({
      ownerUserId: owner.id,
      resourceType: "observation",
      resourceId: observation.id,
      sourceDocumentId: source.document.id,
      sourceRecordId: source.record.id,
      importJobId: source.job.id,
      actorType: "worker",
      actorId: "foundation-worker",
      derivation: "normalized_from_source_record",
      parserName: "foundation.test",
      parserVersion: "0.0.0"
    });

    const [trace] = await db
      .select()
      .from(provenance)
      .where(and(eq(provenance.resourceType, "observation"), eq(provenance.resourceId, observation.id)))
      .limit(1);

    expect(trace?.sourceRecordId).toBe(source.record.id);

    await expect(
      pool.query(
        `
          insert into observations (owner_user_id, category, display_name)
          values ($1, 'labs', 'Unbacked glucose')
        `,
        [owner.id]
      )
    ).rejects.toMatchObject({ code: "23502" });

    await expect(
      pool.query(
        `
          insert into provenance (owner_user_id, resource_type, resource_id, actor_type, derivation)
          values ($1, 'observation', gen_random_uuid(), 'system', 'unbacked')
        `,
        [owner.id]
      )
    ).rejects.toMatchObject({ code: "23514" });

    await expect(db.delete(sourceRecords).where(eq(sourceRecords.id, source.record.id))).rejects.toMatchObject({
      cause: { code: "23503" }
    });
  });

  it("enforces share predicates in SQL and records share access audit events", async () => {
    const owner = await createUser({ email: "share-owner@example.test", displayName: "Share Owner" });
    const recipient = await createUser({ email: "clinician@example.test", displayName: "Clinician" });
    const outsider = await createUser({ email: "outsider@example.test", displayName: "Outsider" });
    const otherOwner = await createUser({ email: "other-owner@example.test", displayName: "Other Owner" });
    const ownerSource = await createSource({ ownerUserId: owner.id });
    const otherSource = await createSource({ ownerUserId: otherOwner.id });

    const [allowedLab] = await db
      .insert(observations)
      .values({
        ownerUserId: owner.id,
        sourceRecordId: ownerSource.record.id,
        category: "labs",
        displayName: "LDL Cholesterol",
        observedAt: new Date("2025-02-10T12:00:00Z"),
        originalValue: "91",
        valueNumeric: "91.000000",
        unitOriginal: "mg/dL",
        unitNormalized: "mg/dL",
        reviewState: "not_required"
      })
      .returning();

    await db.insert(observations).values([
      {
        ownerUserId: owner.id,
        sourceRecordId: ownerSource.record.id,
        category: "labs",
        displayName: "Outside Window LDL",
        observedAt: new Date("2024-12-31T12:00:00Z"),
        originalValue: "102",
        valueNumeric: "102.000000",
        unitOriginal: "mg/dL",
        unitNormalized: "mg/dL",
        reviewState: "not_required"
      },
      {
        ownerUserId: owner.id,
        sourceRecordId: ownerSource.record.id,
        category: "vitals",
        displayName: "Heart Rate",
        observedAt: new Date("2025-02-10T12:00:00Z"),
        originalValue: "72",
        valueNumeric: "72.000000",
        unitOriginal: "bpm",
        unitNormalized: "bpm",
        reviewState: "not_required"
      },
      {
        ownerUserId: otherOwner.id,
        sourceRecordId: otherSource.record.id,
        category: "labs",
        displayName: "Other Owner LDL",
        observedAt: new Date("2025-02-10T12:00:00Z"),
        originalValue: "80",
        valueNumeric: "80.000000",
        unitOriginal: "mg/dL",
        unitNormalized: "mg/dL",
        reviewState: "not_required"
      }
    ]);

    if (!allowedLab) {
      throw new Error("Expected allowed lab to be inserted");
    }

    const [policy] = await db
      .insert(sharePolicies)
      .values({
        ownerUserId: owner.id,
        recipientUserId: recipient.id,
        recipientEmail: recipient.email,
        recipientName: recipient.displayName,
        status: "active",
        startsAt: new Date("2025-01-01T00:00:00Z"),
        expiresAt: new Date("2025-12-31T23:59:59Z"),
        fromObservedAt: new Date("2025-01-01T00:00:00Z"),
        toObservedAt: new Date("2025-03-01T00:00:00Z"),
        createdByUserId: owner.id
      })
      .returning();

    if (!policy) {
      throw new Error("Expected share policy to be inserted");
    }

    await db.insert(sharePolicyScopes).values({
      policyId: policy.id,
      category: "labs"
    });

    const sharedRows = await listSharedObservations(db, {
      policyId: policy.id,
      recipientUserId: recipient.id,
      actor: recipientActor(recipient.id),
      metadata: { channel: "integration-test" },
      now: new Date("2025-02-15T00:00:00Z")
    });

    expect(sharedRows.map((row) => row.id)).toEqual([allowedLab.id]);

    const outsiderRows = await listSharedObservations(db, {
      policyId: policy.id,
      recipientUserId: outsider.id,
      actor: recipientActor(outsider.id),
      now: new Date("2025-02-15T00:00:00Z")
    });

    expect(outsiderRows).toHaveLength(0);

    const [shareAudit] = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.action, "share.accessed"), eq(auditEvents.resourceId, policy.id)))
      .limit(1);

    expect(shareAudit?.actorId).toBe(recipient.id);
    expect(shareAudit?.metadata).toEqual({ resultCount: 1, channel: "integration-test" });

    const [shareOutbox] = await db
      .select()
      .from(outboxEvents)
      .where(and(eq(outboxEvents.eventType, "share.accessed"), eq(outboxEvents.aggregateId, policy.id)))
      .limit(1);
    expect(shareOutbox?.actorId).toBe(recipient.id);

    const outsiderDeniedAudits = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, "share.access_denied"),
          eq(auditEvents.resourceId, policy.id),
          eq(auditEvents.actorId, outsider.id)
        )
      );
    expect(outsiderDeniedAudits).toHaveLength(1);
    expect(outsiderDeniedAudits[0]?.ownerUserId).toBe(owner.id);

    await db.update(sharePolicies).set({ status: "revoked" }).where(eq(sharePolicies.id, policy.id));

    const revokedRows = await listSharedObservations(db, {
      policyId: policy.id,
      recipientUserId: recipient.id,
      actor: recipientActor(recipient.id),
      now: new Date("2025-02-15T00:00:00Z")
    });

    expect(revokedRows).toHaveLength(0);

    const revokedDeniedAudits = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, "share.access_denied"),
          eq(auditEvents.resourceId, policy.id),
          eq(auditEvents.actorId, recipient.id)
        )
      );
    expect(revokedDeniedAudits).toHaveLength(1);
  });

  it("creates, reads, and revokes authenticated-recipient share policies through the server API layer", async () => {
    const owner = await createUser({ email: "share-api-owner@example.test", displayName: "Share API Owner" });
    const recipient = await createUser({ email: "share-api-recipient@example.test", displayName: "Share API Recipient" });
    const source = await createSource({ ownerUserId: owner.id });
    const { createSharePolicy, listSharedObservationsForAuthenticatedRecipient, revokeSharePolicy } = await import(
      "../apps/web/src/server/shares"
    );

    const [lab] = await db
      .insert(observations)
      .values({
        ownerUserId: owner.id,
        sourceRecordId: source.record.id,
        category: "labs",
        displayName: "A1c",
        observedAt: new Date("2025-02-10T12:00:00Z"),
        originalValue: "5.4",
        valueNumeric: "5.400000",
        unitOriginal: "%",
        unitNormalized: "%",
        reviewState: "not_required"
      })
      .returning();

    await db.insert(observations).values({
      ownerUserId: owner.id,
      sourceRecordId: source.record.id,
      category: "vitals",
      displayName: "Blood Pressure",
      observedAt: new Date("2025-02-10T12:00:00Z"),
      originalValue: "118/76",
      valueText: "118/76",
      reviewState: "not_required"
    });

    const ownerContext = { ownerUserId: owner.id, actor: { type: "user" as const, id: owner.id } };
    const recipientContext = { ownerUserId: recipient.id, actor: { type: "user" as const, id: recipient.id } };

    const created = await createSharePolicy(db, {
      owner: ownerContext,
      body: {
        recipientUserId: recipient.id,
        recipientEmail: recipient.email,
        recipientName: recipient.displayName,
        categories: ["labs"],
        startsAt: new Date("2025-01-01T00:00:00Z"),
        expiresAt: new Date("2027-12-31T00:00:00Z")
      }
    });

    expect(created.policy.status).toBe("active");
    expect(created.scopes.map((scope) => scope.category)).toEqual(["labs"]);

    const shared = await listSharedObservationsForAuthenticatedRecipient(db, {
      recipient: recipientContext,
      sharePolicyId: created.policy.id
    });
    expect(shared.map((row) => row.id)).toEqual([lab!.id]);

    const accessAudit = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.action, "share.accessed"), eq(auditEvents.resourceId, created.policy.id)));
    expect(accessAudit).toHaveLength(1);
    expect(accessAudit[0]?.actorType).toBe("recipient");

    const revoked = await revokeSharePolicy(db, {
      owner: ownerContext,
      sharePolicyId: created.policy.id
    });
    expect(revoked.status).toBe("revoked");

    const afterRevoke = await listSharedObservationsForAuthenticatedRecipient(db, {
      recipient: recipientContext,
      sharePolicyId: created.policy.id
    });
    expect(afterRevoke).toHaveLength(0);

    const shareEvents = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.aggregateId, created.policy.id));
    expect(shareEvents.map((event) => event.eventType).sort()).toEqual([
      "share.access_denied",
      "share.accessed",
      "share.created",
      "share.revoked"
    ]);
  });
});
