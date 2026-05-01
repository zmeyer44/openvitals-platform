import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { Pool } from "pg";
import { createDb, type OpenVitalsDatabase } from "../packages/database/src/client";
import {
  appUsers,
  auditEvents,
  authUsers,
  conditions,
  encounters,
  importJobs,
  medications,
  observations,
  outboxEvents,
  recordRevisions,
  reviewTasks,
  sourceDocuments,
  sourceRecords
} from "../packages/database/src/schema";
import { applyReviewAction, ReviewActionError } from "../packages/events/src/review";
import {
  countCanonicalRecordsByBucket,
  listCanonicalRecords,
  listObservations
} from "../packages/database/src/canonical";
import { listRecordRevisions } from "../packages/database/src/reviews";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl && process.env.CI) {
  throw new Error("TEST_DATABASE_URL or DATABASE_URL is required for review workflow integration tests in CI.");
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

async function createOwner(input: { handle?: string } = {}) {
  const handle = input.handle ?? "review-owner";
  const externalAuthId = `test:${handle}`;
  await db.insert(authUsers).values({
    id: externalAuthId,
    name: handle,
    email: `${handle}@example.test`,
    emailVerified: true
  });

  const [owner] = await db
    .insert(appUsers)
    .values({
      email: `${handle}@example.test`,
      displayName: handle,
      externalAuthId
    })
    .returning();

  if (!owner) {
    throw new Error(`Failed to create review owner ${handle}`);
  }

  return owner;
}

async function createSourceRecordPair(input: { ownerUserId: string; recordType?: "observation" | "condition" | "medication" | "encounter" }) {
  const [document] = await db
    .insert(sourceDocuments)
    .values({
      ownerUserId: input.ownerUserId,
      sourceKind: "file",
      fileName: "review-fixture.csv",
      mimeType: "text/csv",
      status: "needs_review",
      classification: "lab_csv",
      parserName: "openvitals.lab_csv",
      parserVersion: "0.1.0"
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
      status: "needs_review"
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
      parserName: "openvitals.lab_csv",
      parserVersion: "0.1.0",
      sourceText: "name: LDL Cholesterol; value: 142; unit: mg/dL; date:",
      extractionConfidence: "0.6200",
      originalPayload: {
        test_name: "LDL Cholesterol",
        value: "142",
        unit: "mg/dL",
        date: ""
      },
      reviewState: "needs_review"
    })
    .returning();

  if (!record) {
    throw new Error("Failed to create test source record");
  }

  return { document, job, record };
}

async function createReviewableObservation(input: { ownerUserId: string }) {
  const source = await createSourceRecordPair({ ownerUserId: input.ownerUserId });
  const [observation] = await db
    .insert(observations)
    .values({
      ownerUserId: input.ownerUserId,
      sourceRecordId: source.record.id,
      category: "labs",
      displayName: "LDL Cholesterol",
      observedAtUnknown: true,
      originalValue: "142",
      valueNumeric: "142.000000",
      normalizedValueNumeric: "142.000000",
      unitOriginal: "mg/dL",
      unitNormalized: "mg/dL",
      confidence: "0.6200",
      reviewState: "needs_review",
      trustLevel: "parser_extracted"
    })
    .returning();

  if (!observation) {
    throw new Error("Failed to create reviewable observation");
  }

  const [missingDateTask] = await db
    .insert(reviewTasks)
    .values({
      ownerUserId: input.ownerUserId,
      sourceRecordId: source.record.id,
      resourceType: "observation",
      resourceId: observation.id,
      reason: "missing_date",
      confidence: "0.6200",
      suggestedValue: { displayName: "LDL Cholesterol" }
    })
    .returning();

  const [lowConfidenceTask] = await db
    .insert(reviewTasks)
    .values({
      ownerUserId: input.ownerUserId,
      sourceRecordId: source.record.id,
      resourceType: "observation",
      resourceId: observation.id,
      reason: "low_confidence",
      confidence: "0.6200",
      suggestedValue: { displayName: "LDL Cholesterol" }
    })
    .returning();

  if (!missingDateTask || !lowConfidenceTask) {
    throw new Error("Failed to create review tasks");
  }

  return { source, observation, missingDateTask, lowConfidenceTask };
}

describeWithDatabase("review workflow backend integration", () => {
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

  it("confirms an observation, upgrades trust, cascades open tasks, and emits audit and outbox events", async () => {
    const owner = await createOwner();
    const fixture = await createReviewableObservation({ ownerUserId: owner.id });

    const result = await applyReviewAction(db, {
      ownerUserId: owner.id,
      actor: { type: "user", id: owner.id },
      reviewTaskId: fixture.missingDateTask.id,
      action: "confirm",
      note: "Verified during chart review"
    });

    expect(result.reviewTask?.status).toBe("resolved");
    expect(result.reviewTask?.resolutionAction).toBe("confirm");
    expect(result.reviewTask?.resolvedByUserId).toBe(owner.id);
    expect(result.cascadedReviewTaskIds).toEqual([fixture.lowConfidenceTask.id]);

    const [updated] = await db.select().from(observations).where(eq(observations.id, fixture.observation.id)).limit(1);
    expect(updated?.reviewState).toBe("confirmed");
    expect(updated?.trustLevel).toBe("user_confirmed");
    expect((updated?.metadata as { lastReviewAction?: string })?.lastReviewAction).toBe("confirm");

    const [updatedSource] = await db
      .select()
      .from(sourceRecords)
      .where(eq(sourceRecords.id, fixture.source.record.id))
      .limit(1);
    expect(updatedSource?.reviewState).toBe("confirmed");

    const revisions = await listRecordRevisions(db, {
      ownerUserId: owner.id,
      resourceType: "observation",
      resourceId: fixture.observation.id
    });
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.reason).toBe("confirm");
    expect((revisions[0]?.previousValue as { reviewState?: string })?.reviewState).toBe("needs_review");
    expect((revisions[0]?.newValue as { reviewState?: string; trustLevel?: string })?.trustLevel).toBe("user_confirmed");

    const [secondTask] = await db
      .select()
      .from(reviewTasks)
      .where(eq(reviewTasks.id, fixture.lowConfidenceTask.id))
      .limit(1);
    expect(secondTask?.status).toBe("resolved");
    expect(secondTask?.resolutionAction).toBe("confirm");

    const audit = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.ownerUserId, owner.id), eq(auditEvents.action, "record.confirmed")));
    expect(audit).toHaveLength(1);

    const outbox = await db
      .select()
      .from(outboxEvents)
      .where(and(eq(outboxEvents.ownerUserId, owner.id), eq(outboxEvents.eventType, "record.confirmed")));
    expect(outbox).toHaveLength(1);

    const resolvedEvents = await db
      .select()
      .from(outboxEvents)
      .where(and(eq(outboxEvents.ownerUserId, owner.id), eq(outboxEvents.eventType, "review_task.resolved")));
    expect(resolvedEvents).toHaveLength(1);
  });

  it("corrects an observation, preserves prior values, and persists revisions", async () => {
    const owner = await createOwner();
    const fixture = await createReviewableObservation({ ownerUserId: owner.id });

    const correctedDate = new Date("2026-01-04T09:30:00Z");

    const result = await applyReviewAction(db, {
      ownerUserId: owner.id,
      actor: { type: "user", id: owner.id },
      reviewTaskId: fixture.missingDateTask.id,
      action: "correct",
      corrections: {
        observedAt: correctedDate.toISOString(),
        observedAtUnknown: false,
        valueNumeric: "138",
        normalizedValueNumeric: "138",
        unitNormalized: "mg/dL"
      }
    });

    expect(result.reviewTask?.resolutionAction).toBe("correct");
    expect(result.reviewTask?.status).toBe("resolved");

    const [updated] = await db
      .select()
      .from(observations)
      .where(eq(observations.id, fixture.observation.id))
      .limit(1);
    expect(updated?.reviewState).toBe("corrected");
    expect(updated?.trustLevel).toBe("user_corrected");
    expect(updated?.observedAt?.toISOString()).toBe(correctedDate.toISOString());
    expect(updated?.observedAtUnknown).toBe(false);
    expect(Number(updated?.valueNumeric)).toBe(138);
    expect(Number(updated?.normalizedValueNumeric)).toBe(138);

    const revisions = await listRecordRevisions(db, {
      ownerUserId: owner.id,
      resourceType: "observation",
      resourceId: fixture.observation.id
    });

    expect(revisions).toHaveLength(1);
    const previousValue = revisions[0]?.previousValue as Record<string, unknown>;
    expect(previousValue.observedAtUnknown).toBe(true);
    expect(previousValue.valueNumeric).toBe("142.000000");
    expect(previousValue.trustLevel).toBe("parser_extracted");

    const newValue = revisions[0]?.newValue as Record<string, unknown>;
    expect(newValue.observedAtUnknown).toBe(false);
    expect(Number(newValue.valueNumeric)).toBe(138);
    expect(newValue.trustLevel).toBe("user_corrected");

    const auditCorrected = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.ownerUserId, owner.id), eq(auditEvents.action, "record.corrected")));
    expect(auditCorrected).toHaveLength(1);
    expect((auditCorrected[0]?.metadata as { recordRevisionId?: string })?.recordRevisionId).toBe(revisions[0]?.id);
  });

  it("ignores an observation, dismissing review tasks without upgrading trust", async () => {
    const owner = await createOwner();
    const fixture = await createReviewableObservation({ ownerUserId: owner.id });

    const result = await applyReviewAction(db, {
      ownerUserId: owner.id,
      actor: { type: "user", id: owner.id },
      reviewTaskId: fixture.missingDateTask.id,
      action: "ignore"
    });

    expect(result.reviewTask?.status).toBe("dismissed");
    expect(result.cascadedReviewTaskIds).toEqual([fixture.lowConfidenceTask.id]);

    const [observation] = await db
      .select()
      .from(observations)
      .where(eq(observations.id, fixture.observation.id))
      .limit(1);
    expect(observation?.reviewState).toBe("ignored");
    expect(observation?.trustLevel).toBe("parser_extracted");

    const audit = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.ownerUserId, owner.id), eq(auditEvents.action, "record.ignored")));
    expect(audit).toHaveLength(1);
  });

  it("merges duplicate observations and links the merge target in metadata", async () => {
    const owner = await createOwner();
    const fixture = await createReviewableObservation({ ownerUserId: owner.id });
    const targetSource = await createSourceRecordPair({ ownerUserId: owner.id });
    const [targetObservation] = await db
      .insert(observations)
      .values({
        ownerUserId: owner.id,
        sourceRecordId: targetSource.record.id,
        category: "labs",
        displayName: "LDL Cholesterol",
        observedAt: new Date("2026-01-04T09:30:00Z"),
        originalValue: "138",
        valueNumeric: "138.000000",
        normalizedValueNumeric: "138.000000",
        unitOriginal: "mg/dL",
        unitNormalized: "mg/dL",
        reviewState: "confirmed",
        trustLevel: "user_confirmed"
      })
      .returning();

    if (!targetObservation) {
      throw new Error("Failed to create merge target");
    }

    const result = await applyReviewAction(db, {
      ownerUserId: owner.id,
      actor: { type: "user", id: owner.id },
      reviewTaskId: fixture.missingDateTask.id,
      action: "merge_duplicate",
      mergeIntoResourceId: targetObservation.id
    });

    expect(result.reviewTask?.resolutionAction).toBe("merge_duplicate");

    const [merged] = await db
      .select()
      .from(observations)
      .where(eq(observations.id, fixture.observation.id))
      .limit(1);
    expect(merged?.reviewState).toBe("merged");
    expect((merged?.metadata as { mergedIntoResourceId?: string })?.mergedIntoResourceId).toBe(targetObservation.id);

    await expect(
      applyReviewAction(db, {
        ownerUserId: owner.id,
        actor: { type: "user", id: owner.id },
        resourceType: "observation",
        resourceId: targetObservation.id,
        action: "merge_duplicate",
        mergeIntoResourceId: targetObservation.id
      })
    ).rejects.toBeInstanceOf(ReviewActionError);
  });

  it("marks a record unknown without upgrading trust", async () => {
    const owner = await createOwner();
    const fixture = await createReviewableObservation({ ownerUserId: owner.id });

    const result = await applyReviewAction(db, {
      ownerUserId: owner.id,
      actor: { type: "user", id: owner.id },
      reviewTaskId: fixture.missingDateTask.id,
      action: "mark_unknown"
    });

    expect(result.reviewTask?.resolutionAction).toBe("mark_unknown");

    const [observation] = await db
      .select()
      .from(observations)
      .where(eq(observations.id, fixture.observation.id))
      .limit(1);
    expect(observation?.reviewState).toBe("unknown");
    expect(observation?.trustLevel).toBe("parser_extracted");
  });

  it("attaches a note without resolving the task or changing the canonical record", async () => {
    const owner = await createOwner();
    const fixture = await createReviewableObservation({ ownerUserId: owner.id });

    const result = await applyReviewAction(db, {
      ownerUserId: owner.id,
      actor: { type: "user", id: owner.id },
      reviewTaskId: fixture.missingDateTask.id,
      action: "attach_note",
      note: "Need to ask the lab for the collection date"
    });

    expect(result.reviewTask?.status).toBe("open");
    expect(result.reviewTask?.resolutionNote).toBe("Need to ask the lab for the collection date");
    expect(result.recordRevision).toBeNull();

    const [observation] = await db
      .select()
      .from(observations)
      .where(eq(observations.id, fixture.observation.id))
      .limit(1);
    expect(observation?.reviewState).toBe("needs_review");

    const audit = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.ownerUserId, owner.id), eq(auditEvents.action, "record.note_attached")));
    expect(audit).toHaveLength(1);
  });

  it("rejects double-resolving a closed review task", async () => {
    const owner = await createOwner();
    const fixture = await createReviewableObservation({ ownerUserId: owner.id });

    await applyReviewAction(db, {
      ownerUserId: owner.id,
      actor: { type: "user", id: owner.id },
      reviewTaskId: fixture.missingDateTask.id,
      action: "confirm"
    });

    await expect(
      applyReviewAction(db, {
        ownerUserId: owner.id,
        actor: { type: "user", id: owner.id },
        reviewTaskId: fixture.missingDateTask.id,
        action: "confirm"
      })
    ).rejects.toMatchObject({ code: "review_task_already_closed" });
  });

  it("supports applying actions directly to a canonical record without an existing review task", async () => {
    const owner = await createOwner();
    const sourcePair = await createSourceRecordPair({ ownerUserId: owner.id });
    const [observation] = await db
      .insert(observations)
      .values({
        ownerUserId: owner.id,
        sourceRecordId: sourcePair.record.id,
        category: "labs",
        displayName: "Random Glucose",
        observedAt: new Date("2026-01-02T08:00:00Z"),
        originalValue: "98",
        valueNumeric: "98.000000",
        normalizedValueNumeric: "98.000000",
        unitOriginal: "mg/dL",
        unitNormalized: "mg/dL",
        reviewState: "needs_review",
        trustLevel: "parser_extracted"
      })
      .returning();

    if (!observation) {
      throw new Error("Failed to create observation for direct action");
    }

    const result = await applyReviewAction(db, {
      ownerUserId: owner.id,
      actor: { type: "user", id: owner.id },
      resourceType: "observation",
      resourceId: observation.id,
      action: "confirm"
    });

    expect(result.reviewTask).toBeNull();
    const [updated] = await db
      .select()
      .from(observations)
      .where(eq(observations.id, observation.id))
      .limit(1);
    expect(updated?.reviewState).toBe("confirmed");
    expect(updated?.trustLevel).toBe("user_confirmed");
  });

  it("resolves a source-document review task without writing record revisions", async () => {
    const owner = await createOwner();
    const [document] = await db
      .insert(sourceDocuments)
      .values({
        ownerUserId: owner.id,
        sourceKind: "file",
        fileName: "lab.png",
        mimeType: "image/png",
        status: "needs_review"
      })
      .returning();

    if (!document) {
      throw new Error("Failed to create source document");
    }

    const [task] = await db
      .insert(reviewTasks)
      .values({
        ownerUserId: owner.id,
        resourceType: "source_document",
        resourceId: document.id,
        reason: "image_requires_review"
      })
      .returning();

    if (!task) {
      throw new Error("Failed to create source-document review task");
    }

    const result = await applyReviewAction(db, {
      ownerUserId: owner.id,
      actor: { type: "user", id: owner.id },
      reviewTaskId: task.id,
      action: "ignore"
    });

    expect(result.reviewTask?.status).toBe("dismissed");
    expect(result.recordRevision).toBeNull();
    expect(result.updatedRecord).toBeNull();

    const revisions = await db
      .select()
      .from(recordRevisions)
      .where(eq(recordRevisions.ownerUserId, owner.id));
    expect(revisions).toHaveLength(0);
  });

  it("segregates canonical records by review bucket through the listing API", async () => {
    const owner = await createOwner();
    const sourcePair = await createSourceRecordPair({ ownerUserId: owner.id });

    const inserts = [
      { displayName: "Trusted A1c", reviewState: "not_required" as const, observedAt: new Date("2026-01-01") },
      { displayName: "Confirmed LDL", reviewState: "confirmed" as const, observedAt: new Date("2026-01-02") },
      { displayName: "Corrected HDL", reviewState: "corrected" as const, observedAt: new Date("2026-01-03") },
      { displayName: "Needs Review TG", reviewState: "needs_review" as const, observedAt: new Date("2026-01-04") },
      { displayName: "Ignored Glucose", reviewState: "ignored" as const, observedAt: new Date("2026-01-05") },
      { displayName: "Merged Glucose", reviewState: "merged" as const, observedAt: new Date("2026-01-06") },
      { displayName: "Unknown Marker", reviewState: "unknown" as const, observedAt: new Date("2026-01-07") }
    ];

    for (const insert of inserts) {
      await db.insert(observations).values({
        ownerUserId: owner.id,
        sourceRecordId: sourcePair.record.id,
        category: "labs",
        displayName: insert.displayName,
        observedAt: insert.observedAt,
        originalValue: "1.0",
        valueNumeric: "1.000000",
        normalizedValueNumeric: "1.000000",
        unitOriginal: "x",
        unitNormalized: "x",
        reviewState: insert.reviewState
      });
    }

    const trusted = await listObservations(db, { ownerUserId: owner.id, bucket: "trusted" });
    expect(trusted.map((row) => row.displayName).sort()).toEqual(
      ["Trusted A1c", "Confirmed LDL", "Corrected HDL"].sort()
    );

    const review = await listObservations(db, { ownerUserId: owner.id, bucket: "review_needed" });
    expect(review.map((row) => row.displayName)).toEqual(["Needs Review TG"]);

    const ignored = await listObservations(db, { ownerUserId: owner.id, bucket: "ignored" });
    expect(ignored.map((row) => row.displayName).sort()).toEqual(["Ignored Glucose", "Merged Glucose"].sort());

    const unknown = await listObservations(db, { ownerUserId: owner.id, bucket: "unknown" });
    expect(unknown.map((row) => row.displayName)).toEqual(["Unknown Marker"]);

    const counts = await countCanonicalRecordsByBucket(db, {
      ownerUserId: owner.id,
      resourceType: "observation"
    });
    expect(counts).toEqual({ trusted: 3, review_needed: 1, ignored: 2, unknown: 1 });

    const allViaUnion = await listCanonicalRecords(db, {
      ownerUserId: owner.id,
      resourceType: "observation",
      bucket: "trusted"
    });
    expect(allViaUnion).toHaveLength(3);
  });

  it("supports condition, medication, and encounter corrections", async () => {
    const owner = await createOwner();
    const sourcePair = await createSourceRecordPair({ ownerUserId: owner.id, recordType: "condition" });

    const [condition] = await db
      .insert(conditions)
      .values({
        ownerUserId: owner.id,
        sourceRecordId: sourcePair.record.id,
        displayName: "Hyperlipidemia",
        clinicalStatus: "active",
        verificationStatus: "provisional",
        confidence: "0.7000",
        reviewState: "needs_review",
        trustLevel: "parser_extracted"
      })
      .returning();

    if (!condition) {
      throw new Error("Failed to create condition fixture");
    }

    const conditionResult = await applyReviewAction(db, {
      ownerUserId: owner.id,
      actor: { type: "user", id: owner.id },
      resourceType: "condition",
      resourceId: condition.id,
      action: "correct",
      corrections: { clinicalStatus: "resolved", verificationStatus: "confirmed", notes: "Resolved with statin therapy" }
    });

    expect(conditionResult.updatedRecord).not.toBeNull();
    const [updatedCondition] = await db
      .select()
      .from(conditions)
      .where(eq(conditions.id, condition.id))
      .limit(1);
    expect(updatedCondition?.clinicalStatus).toBe("resolved");
    expect(updatedCondition?.verificationStatus).toBe("confirmed");
    expect(updatedCondition?.notes).toBe("Resolved with statin therapy");
    expect(updatedCondition?.reviewState).toBe("corrected");
    expect(updatedCondition?.trustLevel).toBe("user_corrected");

    const medSource = await createSourceRecordPair({ ownerUserId: owner.id, recordType: "medication" });
    const [medication] = await db
      .insert(medications)
      .values({
        ownerUserId: owner.id,
        sourceRecordId: medSource.record.id,
        displayName: "Metformin",
        dosageText: "500mg",
        active: true,
        confidence: "0.8000",
        reviewState: "needs_review",
        trustLevel: "parser_extracted"
      })
      .returning();

    if (!medication) {
      throw new Error("Failed to create medication fixture");
    }

    const medResult = await applyReviewAction(db, {
      ownerUserId: owner.id,
      actor: { type: "user", id: owner.id },
      resourceType: "medication",
      resourceId: medication.id,
      action: "correct",
      corrections: { dosageText: "1000mg", frequency: "twice daily", active: false }
    });
    expect(medResult.updatedRecord).not.toBeNull();
    const [updatedMed] = await db
      .select()
      .from(medications)
      .where(eq(medications.id, medication.id))
      .limit(1);
    expect(updatedMed?.dosageText).toBe("1000mg");
    expect(updatedMed?.frequency).toBe("twice daily");
    expect(updatedMed?.active).toBe(false);

    const encSource = await createSourceRecordPair({ ownerUserId: owner.id, recordType: "encounter" });
    const [encounter] = await db
      .insert(encounters)
      .values({
        ownerUserId: owner.id,
        sourceRecordId: encSource.record.id,
        encounterType: "ambulatory",
        startedAt: new Date("2026-01-01T09:00:00Z"),
        confidence: "0.7500",
        reviewState: "needs_review",
        trustLevel: "parser_extracted"
      })
      .returning();

    if (!encounter) {
      throw new Error("Failed to create encounter fixture");
    }

    const encResult = await applyReviewAction(db, {
      ownerUserId: owner.id,
      actor: { type: "user", id: owner.id },
      resourceType: "encounter",
      resourceId: encounter.id,
      action: "correct",
      corrections: {
        providerName: "Dr. Lee",
        facilityName: "OpenVitals Clinic",
        endedAt: new Date("2026-01-01T09:30:00Z").toISOString()
      }
    });
    expect(encResult.updatedRecord).not.toBeNull();
    const [updatedEnc] = await db
      .select()
      .from(encounters)
      .where(eq(encounters.id, encounter.id))
      .limit(1);
    expect(updatedEnc?.providerName).toBe("Dr. Lee");
    expect(updatedEnc?.facilityName).toBe("OpenVitals Clinic");
    expect(updatedEnc?.endedAt?.toISOString()).toBe(new Date("2026-01-01T09:30:00Z").toISOString());
  });

  it("isolates records by owner so cross-owner actions cannot mutate state", async () => {
    const ownerA = await createOwner({ handle: "owner-a" });
    const ownerB = await createOwner({ handle: "owner-b" });
    const fixture = await createReviewableObservation({ ownerUserId: ownerA.id });

    await expect(
      applyReviewAction(db, {
        ownerUserId: ownerB.id,
        actor: { type: "user", id: ownerB.id },
        reviewTaskId: fixture.missingDateTask.id,
        action: "confirm"
      })
    ).rejects.toMatchObject({ code: "review_task_not_found" });

    await expect(
      applyReviewAction(db, {
        ownerUserId: ownerB.id,
        actor: { type: "user", id: ownerB.id },
        resourceType: "observation",
        resourceId: fixture.observation.id,
        action: "confirm"
      })
    ).rejects.toMatchObject({ code: "resource_not_found" });

    await expect(
      applyReviewAction(db, {
        ownerUserId: ownerB.id,
        actor: { type: "user", id: ownerB.id },
        reviewTaskId: fixture.missingDateTask.id,
        action: "attach_note",
        note: "tampering"
      })
    ).rejects.toMatchObject({ code: "review_task_not_found" });

    const [task] = await db
      .select()
      .from(reviewTasks)
      .where(eq(reviewTasks.id, fixture.missingDateTask.id))
      .limit(1);
    expect(task?.status).toBe("open");
    expect(task?.resolutionNote).toBeNull();

    const [observation] = await db
      .select()
      .from(observations)
      .where(eq(observations.id, fixture.observation.id))
      .limit(1);
    expect(observation?.reviewState).toBe("needs_review");
    expect(observation?.trustLevel).toBe("parser_extracted");
  });
});
