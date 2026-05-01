import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { Pool } from "pg";
import { createDb, type OpenVitalsDatabase } from "../packages/database/src/client";
import {
  appUsers,
  auditEvents,
  authUsers,
  conditions,
  intakeAnswers,
  intakeWorkflows,
  medications,
  outboxEvents,
  provenance,
  recordRevisions,
  reviewTasks,
  sourceDocuments,
  sourceRecords,
  userProfiles
} from "../packages/database/src/schema";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl && process.env.CI) {
  throw new Error(
    "TEST_DATABASE_URL or DATABASE_URL is required for intake workflow integration tests in CI."
  );
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

async function createOwner(handle = "intake-owner") {
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
    throw new Error(`Failed to create intake test owner ${handle}`);
  }

  return {
    appUser: owner,
    ownerUserId: owner.id,
    actor: { type: "user" as const, id: owner.id }
  };
}

describeWithDatabase("intake workflow backend integration", () => {
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

  it("starts a new intake, then resumes the same workflow on subsequent calls", async () => {
    const owner = await createOwner();
    const { startOrResumeIntake, getCurrentIntake } = await import(
      "../apps/web/src/server/intake"
    );

    const first = await startOrResumeIntake(db, { owner });
    expect(first.resumed).toBe(false);
    expect(first.workflow.status).toBe("in_progress");
    expect(first.workflow.currentStep).toBe("profile");

    const second = await startOrResumeIntake(db, { owner });
    expect(second.resumed).toBe(true);
    expect(second.workflow.id).toBe(first.workflow.id);

    const current = await getCurrentIntake(db, { owner });
    expect(current?.workflow.id).toBe(first.workflow.id);

    const workflows = await db
      .select()
      .from(intakeWorkflows)
      .where(eq(intakeWorkflows.ownerUserId, owner.ownerUserId));
    expect(workflows).toHaveLength(1);
    await expect(
      db.insert(intakeWorkflows).values({
        ownerUserId: owner.ownerUserId,
        status: "in_progress",
        currentStep: "profile",
        skippedSteps: []
      })
    ).rejects.toMatchObject({ cause: { code: "23505" } });

    const audit = await db
      .select()
      .from(auditEvents)
      .where(
        and(eq(auditEvents.ownerUserId, owner.ownerUserId), eq(auditEvents.action, "intake.started"))
      );
    expect(audit).toHaveLength(1);

    const outbox = await db
      .select()
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.ownerUserId, owner.ownerUserId),
          eq(outboxEvents.eventType, "intake.started")
        )
      );
    expect(outbox).toHaveLength(1);
  });

  it("maps profile, condition, medication, and note answers into canonical records with provenance", async () => {
    const owner = await createOwner();
    const { startOrResumeIntake, saveIntakeStep } = await import(
      "../apps/web/src/server/intake"
    );

    const { workflow } = await startOrResumeIntake(db, { owner });

    const profile = await saveIntakeStep(db, {
      owner,
      intakeId: workflow.id,
      body: {
        stepKey: "profile",
        answers: [
          {
            answerKey: "dateOfBirth",
            payload: { kind: "profile_field", field: "dateOfBirth", value: "1987-04-12" }
          },
          {
            answerKey: "sexAtBirth",
            payload: { kind: "profile_field", field: "sexAtBirth", value: "female" }
          }
        ]
      }
    });

    expect(profile.workflow.currentStep).toBe("conditions");
    const profileAnswers = profile.answers.filter((answer) => answer.stepKey === "profile");
    expect(profileAnswers).toHaveLength(2);

    const [profileRow] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, owner.ownerUserId));
    expect(profileRow?.sexAtBirth).toBe("female");
    expect(profileRow?.dateOfBirth?.toISOString().slice(0, 10)).toBe("1987-04-12");

    const profileProvenance = await db
      .select()
      .from(provenance)
      .where(
        and(
          eq(provenance.ownerUserId, owner.ownerUserId),
          eq(provenance.resourceType, "user_profile")
        )
      );
    expect(profileProvenance.length).toBeGreaterThanOrEqual(2);
    expect(profileProvenance.every((row) => row.derivation === "intake_profile_field")).toBe(true);
    expect(profileProvenance.every((row) => row.sourceDocumentId !== null)).toBe(true);

    const conditionResult = await saveIntakeStep(db, {
      owner,
      intakeId: workflow.id,
      body: {
        stepKey: "conditions",
        answers: [
          {
            answerKey: "primary",
            payload: {
              kind: "condition",
              displayName: "Hypertension",
              clinicalStatus: "active",
              notes: "Diagnosed 2018"
            }
          }
        ]
      }
    });
    expect(conditionResult.workflow.currentStep).toBe("medications");

    const conditionRows = await db
      .select()
      .from(conditions)
      .where(eq(conditions.ownerUserId, owner.ownerUserId));
    expect(conditionRows).toHaveLength(1);
    expect(conditionRows[0]?.displayName).toBe("Hypertension");
    expect(conditionRows[0]?.reviewState).toBe("confirmed");
    expect(conditionRows[0]?.trustLevel).toBe("user_entered");

    const conditionProvenance = await db
      .select()
      .from(provenance)
      .where(
        and(
          eq(provenance.ownerUserId, owner.ownerUserId),
          eq(provenance.resourceType, "condition")
        )
      );
    expect(conditionProvenance).toHaveLength(1);
    expect(conditionProvenance[0]?.derivation).toBe("intake_answer");
    expect(conditionProvenance[0]?.sourceRecordId).toBe(conditionRows[0]?.sourceRecordId);
    expect(conditionProvenance[0]?.parserName).toBe("openvitals.intake");

    const medsResult = await saveIntakeStep(db, {
      owner,
      intakeId: workflow.id,
      body: {
        stepKey: "medications",
        answers: [
          {
            answerKey: "primary",
            payload: {
              kind: "medication",
              displayName: "Lisinopril",
              dosageText: "10 mg",
              frequency: "daily"
            }
          }
        ]
      }
    });
    expect(medsResult.workflow.currentStep).toBe("allergies");

    const medRows = await db
      .select()
      .from(medications)
      .where(eq(medications.ownerUserId, owner.ownerUserId));
    expect(medRows).toHaveLength(1);
    expect(medRows[0]?.displayName).toBe("Lisinopril");
    expect(medRows[0]?.active).toBe(true);

    const noteResult = await saveIntakeStep(db, {
      owner,
      intakeId: workflow.id,
      body: {
        stepKey: "notes",
        answers: [
          {
            answerKey: "main",
            payload: {
              kind: "note",
              text: "Recurring headache, not sure of cause",
              topic: "headaches"
            }
          }
        ]
      }
    });

    const reviewTaskRows = await db
      .select()
      .from(reviewTasks)
      .where(eq(reviewTasks.ownerUserId, owner.ownerUserId));
    expect(reviewTaskRows).toHaveLength(1);
    expect(reviewTaskRows[0]?.reason).toBe("intake_note_review");
    expect(reviewTaskRows[0]?.status).toBe("open");

    const noteAnswerRow = noteResult.answers.find((row) => row.stepKey === "notes");
    expect(noteAnswerRow?.canonicalResourceType).toBe("review_task");
    expect(noteAnswerRow?.canonicalResourceId).toBe(reviewTaskRows[0]?.id);

    const sourceDoc = await db
      .select()
      .from(sourceDocuments)
      .where(
        and(
          eq(sourceDocuments.ownerUserId, owner.ownerUserId),
          eq(sourceDocuments.sourceKind, "manual_intake")
        )
      );
    expect(sourceDoc).toHaveLength(1);
    expect(sourceDoc[0]?.parserName).toBe("openvitals.intake");

    const sourceRecordRows = await db
      .select()
      .from(sourceRecords)
      .where(eq(sourceRecords.sourceDocumentId, sourceDoc[0]!.id));
    expect(sourceRecordRows.length).toBeGreaterThanOrEqual(3);
    expect(sourceRecordRows.every((row) => row.externalRecordId?.startsWith(workflow.id))).toBe(true);

    const stepSavedEvents = await db
      .select()
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.ownerUserId, owner.ownerUserId),
          eq(outboxEvents.eventType, "intake.step_saved")
        )
      );
    expect(stepSavedEvents).toHaveLength(4);
  });

  it("re-running save_step replaces existing answer values via the conflict-on-upsert key", async () => {
    const owner = await createOwner();
    const { startOrResumeIntake, saveIntakeStep } = await import(
      "../apps/web/src/server/intake"
    );

    const { workflow } = await startOrResumeIntake(db, { owner });

    await saveIntakeStep(db, {
      owner,
      intakeId: workflow.id,
      body: {
        stepKey: "profile",
        answers: [
          {
            answerKey: "bloodType",
            payload: { kind: "profile_field", field: "bloodType", value: "A+" }
          }
        ]
      }
    });

    await saveIntakeStep(db, {
      owner,
      intakeId: workflow.id,
      body: {
        stepKey: "profile",
        answers: [
          {
            answerKey: "bloodType",
            payload: { kind: "profile_field", field: "bloodType", value: "O+" }
          }
        ],
        advanceTo: null
      }
    });

    const rows = await db
      .select()
      .from(intakeAnswers)
      .where(
        and(
          eq(intakeAnswers.ownerUserId, owner.ownerUserId),
          eq(intakeAnswers.workflowId, workflow.id),
          eq(intakeAnswers.stepKey, "profile")
        )
      );
    expect(rows).toHaveLength(1);
    expect((rows[0]?.answerValue as { value?: string } | null)?.value).toBe("O+");

    const [profileRow] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, owner.ownerUserId));
    expect(profileRow?.bloodType).toBe("O+");
  });

  it("re-saving canonical intake answers updates existing records instead of duplicating them", async () => {
    const owner = await createOwner();
    const { startOrResumeIntake, saveIntakeStep } = await import(
      "../apps/web/src/server/intake"
    );

    const { workflow } = await startOrResumeIntake(db, { owner });

    await saveIntakeStep(db, {
      owner,
      intakeId: workflow.id,
      body: {
        stepKey: "conditions",
        answers: [
          {
            answerKey: "primary",
            payload: { kind: "condition", displayName: "Asthma", clinicalStatus: "active" }
          }
        ]
      }
    });

    const [first] = await db
      .select()
      .from(conditions)
      .where(eq(conditions.ownerUserId, owner.ownerUserId))
      .limit(1);

    await saveIntakeStep(db, {
      owner,
      intakeId: workflow.id,
      body: {
        stepKey: "conditions",
        answers: [
          {
            answerKey: "primary",
            payload: {
              kind: "condition",
              displayName: "Asthma",
              clinicalStatus: "resolved",
              notes: "No symptoms this year"
            }
          }
        ],
        advanceTo: null
      }
    });

    const conditionRows = await db
      .select()
      .from(conditions)
      .where(eq(conditions.ownerUserId, owner.ownerUserId));
    expect(conditionRows).toHaveLength(1);
    expect(conditionRows[0]?.id).toBe(first?.id);
    expect(conditionRows[0]?.clinicalStatus).toBe("resolved");
    expect(conditionRows[0]?.notes).toBe("No symptoms this year");

    const sourceRecordRows = await db
      .select()
      .from(sourceRecords)
      .where(eq(sourceRecords.ownerUserId, owner.ownerUserId));
    expect(sourceRecordRows).toHaveLength(1);

    const revisions = await db
      .select()
      .from(recordRevisions)
      .where(eq(recordRevisions.resourceId, first!.id));
    expect(revisions).toHaveLength(1);
    expect((revisions[0]?.previousValue as { clinicalStatus?: string }).clinicalStatus).toBe("active");
    expect((revisions[0]?.newValue as { clinicalStatus?: string }).clinicalStatus).toBe("resolved");
  });

  it("records skipped steps without writing canonical records and emits a skip event", async () => {
    const owner = await createOwner();
    const { startOrResumeIntake, skipIntakeStep } = await import(
      "../apps/web/src/server/intake"
    );

    const { workflow } = await startOrResumeIntake(db, { owner });

    const detail = await skipIntakeStep(db, {
      owner,
      intakeId: workflow.id,
      body: { stepKey: "lifestyle", reason: "Will revisit later" }
    });

    expect(detail.workflow.skippedSteps).toContain("lifestyle");
    expect(detail.workflow.currentStep).toBe("notes");
    expect(detail.answers.find((row) => row.stepKey === "lifestyle")?.skipped).toBe(true);

    const conditionRows = await db
      .select()
      .from(conditions)
      .where(eq(conditions.ownerUserId, owner.ownerUserId));
    expect(conditionRows).toHaveLength(0);

    const skipEvents = await db
      .select()
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.ownerUserId, owner.ownerUserId),
          eq(outboxEvents.eventType, "intake.step_skipped")
        )
      );
    expect(skipEvents).toHaveLength(1);
    expect((skipEvents[0]?.payload as { stepKey?: string }).stepKey).toBe("lifestyle");
  });

  it("completes a workflow exactly once and rejects further edits", async () => {
    const owner = await createOwner();
    const { startOrResumeIntake, completeIntake, saveIntakeStep } = await import(
      "../apps/web/src/server/intake"
    );

    const { workflow } = await startOrResumeIntake(db, { owner });
    const completed = await completeIntake(db, { owner, intakeId: workflow.id });
    expect(completed.workflow.status).toBe("completed");
    expect(completed.workflow.completedAt).toBeInstanceOf(Date);

    const idempotent = await completeIntake(db, { owner, intakeId: workflow.id });
    expect(idempotent.workflow.id).toBe(workflow.id);
    expect(idempotent.workflow.status).toBe("completed");

    const completionEvents = await db
      .select()
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.ownerUserId, owner.ownerUserId),
          eq(outboxEvents.eventType, "intake.completed")
        )
      );
    expect(completionEvents).toHaveLength(1);

    await expect(
      saveIntakeStep(db, {
        owner,
        intakeId: workflow.id,
        body: {
          stepKey: "conditions",
          answers: [
            {
              answerKey: "primary",
              payload: { kind: "condition", displayName: "Asthma" }
            }
          ]
        }
      })
    ).rejects.toMatchObject({ status: 409, code: "intake_not_open" });
  });

  it("isolates intake workflows by owner so cross-owner access fails", async () => {
    const ownerA = await createOwner("intake-a");
    const ownerB = await createOwner("intake-b");
    const { startOrResumeIntake, saveIntakeStep, getIntakeDetail } = await import(
      "../apps/web/src/server/intake"
    );

    const { workflow } = await startOrResumeIntake(db, { owner: ownerA });

    const detailForA = await getIntakeDetail(db, {
      owner: ownerA,
      intakeId: workflow.id
    });
    expect(detailForA?.workflow.id).toBe(workflow.id);

    const detailForB = await getIntakeDetail(db, {
      owner: ownerB,
      intakeId: workflow.id
    });
    expect(detailForB).toBeNull();

    await expect(
      saveIntakeStep(db, {
        owner: ownerB,
        intakeId: workflow.id,
        body: {
          stepKey: "conditions",
          answers: [
            { answerKey: "primary", payload: { kind: "condition", displayName: "tampering" } }
          ]
        }
      })
    ).rejects.toMatchObject({ status: 404, code: "intake_not_found" });
  });
});
