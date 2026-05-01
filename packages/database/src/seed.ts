import { pathToFileURL } from "node:url";
import { and, eq, inArray } from "drizzle-orm";
import { createDb, createPgPool, type OpenVitalsDatabase } from "./client";
import {
  appUsers,
  auditEvents,
  authUsers,
  conditions,
  fileClassifications,
  importJobs,
  importStatusHistory,
  medications,
  observations,
  outboxEvents,
  provenance,
  reviewTasks,
  sharePolicies,
  sharePolicyScopes,
  sourceDocuments,
  sourceRecords,
  userProfiles
} from "./schema";

const seedExternalAuthIds = ["seed:owner", "seed:clinician"];

async function resetSeedUsers(db: OpenVitalsDatabase): Promise<void> {
  await db.delete(appUsers).where(inArray(appUsers.externalAuthId, seedExternalAuthIds));
  await db.delete(authUsers).where(inArray(authUsers.id, seedExternalAuthIds));
}

async function createSeedUser(
  db: OpenVitalsDatabase,
  input: {
    externalAuthId: string;
    email: string;
    displayName: string;
    role?: "user" | "clinician" | "caregiver" | "admin";
  }
) {
  await db.insert(authUsers).values({
    id: input.externalAuthId,
    name: input.displayName,
    email: input.email,
    emailVerified: true
  });

  const [user] = await db
    .insert(appUsers)
    .values({
      externalAuthId: input.externalAuthId,
      email: input.email,
      displayName: input.displayName,
      role: input.role ?? "user"
    })
    .returning();

  if (!user) {
    throw new Error(`Failed to create seed user ${input.email}`);
  }

  return user;
}

async function createSourceRecord(
  db: OpenVitalsDatabase,
  input: {
    ownerUserId: string;
    sourceKind: "file" | "manual_intake" | "manual_entry";
    recordType: "observation" | "condition" | "medication";
    fileName: string;
    sourceText: string;
    originalPayload: Record<string, unknown>;
    status?: "completed" | "needs_review";
  }
) {
  const [document] = await db
    .insert(sourceDocuments)
    .values({
      ownerUserId: input.ownerUserId,
      sourceKind: input.sourceKind,
      fileName: input.fileName,
      mimeType: input.sourceKind === "file" ? "text/csv" : "application/vnd.openvitals.manual+json",
      status: input.status ?? "completed",
      classification: input.sourceKind === "file" ? "lab_csv" : input.sourceKind,
      parserName: input.sourceKind === "file" ? "openvitals.lab_csv" : "openvitals.manual",
      parserVersion: input.sourceKind === "file" ? "0.1.0" : "0.0.1",
      classifiedAt: new Date("2026-01-05T13:00:00Z"),
      parsedAt: new Date("2026-01-05T13:00:02Z"),
      normalizedAt: new Date("2026-01-05T13:00:03Z"),
      completedAt: input.status === "needs_review" ? null : new Date("2026-01-05T13:00:04Z")
    })
    .returning();

  if (!document) {
    throw new Error("Failed to create seed source document");
  }

  const [job] = await db
    .insert(importJobs)
    .values({
      ownerUserId: input.ownerUserId,
      sourceDocumentId: document.id,
      status: input.status ?? "completed",
      metrics: {
        sourceRecordCount: 1,
        canonicalRecordCount: 1,
        reviewTaskCount: input.status === "needs_review" ? 1 : 0
      },
      startedAt: new Date("2026-01-05T13:00:00Z"),
      completedAt: input.status === "needs_review" ? null : new Date("2026-01-05T13:00:04Z")
    })
    .returning();

  if (!job) {
    throw new Error("Failed to create seed import job");
  }

  const parserName = input.sourceKind === "file" ? "openvitals.lab_csv" : "openvitals.manual";
  const parserVersion = input.sourceKind === "file" ? "0.1.0" : "0.0.1";

  await db.insert(fileClassifications).values({
    ownerUserId: input.ownerUserId,
    sourceDocumentId: document.id,
    importJobId: job.id,
    parserName,
    parserVersion,
    decision: input.status === "needs_review" ? "review_needed" : "supported",
    classification: input.sourceKind === "file" ? "lab_csv" : input.sourceKind,
    confidence: input.status === "needs_review" ? "0.6200" : "0.9600",
    selected: true,
    warnings: input.status === "needs_review" ? { items: ["missing_date"] } : { items: [] }
  });

  await db.insert(importStatusHistory).values([
    {
      ownerUserId: input.ownerUserId,
      sourceDocumentId: document.id,
      importJobId: job.id,
      fromStatus: null,
      toStatus: "uploaded",
      actorType: "user",
      actorId: input.ownerUserId,
      reason: "seed_source_created"
    },
    {
      ownerUserId: input.ownerUserId,
      sourceDocumentId: document.id,
      importJobId: job.id,
      fromStatus: "uploaded",
      toStatus: "classified",
      actorType: "worker",
      actorId: "seed-worker",
      reason: "parser_selected"
    },
    {
      ownerUserId: input.ownerUserId,
      sourceDocumentId: document.id,
      importJobId: job.id,
      fromStatus: "classified",
      toStatus: "parsed",
      actorType: "worker",
      actorId: "seed-worker",
      reason: "parser_parse_completed"
    },
    {
      ownerUserId: input.ownerUserId,
      sourceDocumentId: document.id,
      importJobId: job.id,
      fromStatus: "parsed",
      toStatus: "normalized",
      actorType: "worker",
      actorId: "seed-worker",
      reason: "parser_normalize_completed"
    },
    {
      ownerUserId: input.ownerUserId,
      sourceDocumentId: document.id,
      importJobId: job.id,
      fromStatus: "normalized",
      toStatus: input.status ?? "completed",
      actorType: "worker",
      actorId: "seed-worker",
      reason: input.status === "needs_review" ? "materialized_with_review_tasks" : "materialized"
    }
  ]);

  const [record] = await db
    .insert(sourceRecords)
    .values({
      ownerUserId: input.ownerUserId,
      sourceDocumentId: document.id,
      importJobId: job.id,
      recordType: input.recordType,
      parserName,
      parserVersion,
      sourceText: input.sourceText,
      extractionConfidence: input.status === "needs_review" ? "0.6200" : "0.9600",
      originalPayload: input.originalPayload,
      warnings: input.status === "needs_review" ? { items: ["missing_date"] } : { items: [] },
      reviewState: input.status === "needs_review" ? "needs_review" : "not_required"
    })
    .returning();

  if (!record) {
    throw new Error("Failed to create seed source record");
  }

  return { document, job, record };
}

export async function seedDevelopmentData(db: OpenVitalsDatabase): Promise<void> {
  await resetSeedUsers(db);

  const owner = await createSeedUser(db, {
    externalAuthId: "seed:owner",
    email: "alex.openvitals@example.test",
    displayName: "Alex Rivera"
  });
  const clinician = await createSeedUser(db, {
    externalAuthId: "seed:clinician",
    email: "dr.morgan@example.test",
    displayName: "Dr. Morgan Lee",
    role: "clinician"
  });

  await db.insert(userProfiles).values({
    userId: owner.id,
    dateOfBirth: new Date("1987-04-12T00:00:00Z"),
    sexAtBirth: "female",
    genderIdentity: "woman",
    bloodType: "O+",
    goals: {
      items: ["Track lipids", "Prepare concise specialist share packet"]
    }
  });

  const a1cSource = await createSourceRecord(db, {
    ownerUserId: owner.id,
    sourceKind: "file",
    recordType: "observation",
    fileName: "seed-quest-labs.csv",
    sourceText: "test_name: Hemoglobin A1c; value: 5.4; unit: %; date: 2026-01-04",
    originalPayload: {
      test_name: "Hemoglobin A1c",
      value: "5.4",
      unit: "%",
      date: "2026-01-04"
    }
  });

  const ldlSource = await createSourceRecord(db, {
    ownerUserId: owner.id,
    sourceKind: "file",
    recordType: "observation",
    fileName: "seed-quest-labs.csv",
    sourceText: "test_name: LDL Cholesterol; value: 142; unit: mg/dL; date:",
    originalPayload: {
      test_name: "LDL Cholesterol",
      value: "142",
      unit: "mg/dL",
      date: ""
    },
    status: "needs_review"
  });

  const medicationSource = await createSourceRecord(db, {
    ownerUserId: owner.id,
    sourceKind: "manual_intake",
    recordType: "medication",
    fileName: "manual-intake-medications.json",
    sourceText: "Atorvastatin 10 mg by mouth nightly",
    originalPayload: {
      medication: "Atorvastatin",
      dosage: "10 mg",
      frequency: "nightly"
    }
  });

  const conditionSource = await createSourceRecord(db, {
    ownerUserId: owner.id,
    sourceKind: "manual_entry",
    recordType: "condition",
    fileName: "manual-condition.json",
    sourceText: "Family history of hyperlipidemia",
    originalPayload: {
      condition: "Family history of hyperlipidemia"
    }
  });

  const [a1c] = await db
    .insert(observations)
    .values({
      ownerUserId: owner.id,
      sourceRecordId: a1cSource.record.id,
      category: "labs",
      displayName: "Hemoglobin A1c",
      observedAt: new Date("2026-01-04T09:30:00Z"),
      originalValue: "5.4",
      valueNumeric: "5.400000",
      normalizedValueNumeric: "5.400000",
      unitOriginal: "%",
      unitNormalized: "%",
      confidence: "0.9600",
      reviewState: "not_required",
      trustLevel: "parser_extracted"
    })
    .returning();

  const [ldl] = await db
    .insert(observations)
    .values({
      ownerUserId: owner.id,
      sourceRecordId: ldlSource.record.id,
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

  const [medication] = await db
    .insert(medications)
    .values({
      ownerUserId: owner.id,
      sourceRecordId: medicationSource.record.id,
      displayName: "Atorvastatin",
      dosageText: "10 mg",
      route: "oral",
      frequency: "nightly",
      active: true,
      confidence: "1.0000",
      reviewState: "confirmed",
      trustLevel: "user_confirmed"
    })
    .returning();

  const [condition] = await db
    .insert(conditions)
    .values({
      ownerUserId: owner.id,
      sourceRecordId: conditionSource.record.id,
      displayName: "Family history of hyperlipidemia",
      clinicalStatus: "family_history",
      verificationStatus: "user_reported",
      confidence: "1.0000",
      reviewState: "confirmed",
      trustLevel: "user_entered"
    })
    .returning();

  if (!a1c || !ldl || !medication || !condition) {
    throw new Error("Failed to create seed canonical records");
  }

  await db.insert(provenance).values([
    {
      ownerUserId: owner.id,
      resourceType: "observation",
      resourceId: a1c.id,
      sourceDocumentId: a1cSource.document.id,
      sourceRecordId: a1cSource.record.id,
      importJobId: a1cSource.job.id,
      actorType: "worker",
      actorId: "seed-worker",
      derivation: "normalized_from_source_record",
      parserName: "openvitals.lab_csv",
      parserVersion: "0.1.0",
      confidence: "0.9600"
    },
    {
      ownerUserId: owner.id,
      resourceType: "observation",
      resourceId: ldl.id,
      sourceDocumentId: ldlSource.document.id,
      sourceRecordId: ldlSource.record.id,
      importJobId: ldlSource.job.id,
      actorType: "worker",
      actorId: "seed-worker",
      derivation: "normalized_from_source_record",
      parserName: "openvitals.lab_csv",
      parserVersion: "0.1.0",
      confidence: "0.6200",
      metadata: {
        reviewReasons: ["missing_date", "low_confidence"]
      }
    },
    {
      ownerUserId: owner.id,
      resourceType: "medication",
      resourceId: medication.id,
      sourceDocumentId: medicationSource.document.id,
      sourceRecordId: medicationSource.record.id,
      importJobId: medicationSource.job.id,
      actorType: "user",
      actorId: owner.id,
      derivation: "manual_intake_answer"
    },
    {
      ownerUserId: owner.id,
      resourceType: "condition",
      resourceId: condition.id,
      sourceDocumentId: conditionSource.document.id,
      sourceRecordId: conditionSource.record.id,
      importJobId: conditionSource.job.id,
      actorType: "user",
      actorId: owner.id,
      derivation: "manual_entry"
    }
  ]);

  await db.insert(reviewTasks).values([
    {
      ownerUserId: owner.id,
      sourceRecordId: ldlSource.record.id,
      resourceType: "observation",
      resourceId: ldl.id,
      reason: "missing_date",
      confidence: "0.6200",
      suggestedValue: {
        displayName: "LDL Cholesterol",
        originalValue: "142",
        unitOriginal: "mg/dL",
        observedAt: null
      }
    },
    {
      ownerUserId: owner.id,
      sourceRecordId: ldlSource.record.id,
      resourceType: "observation",
      resourceId: ldl.id,
      reason: "low_confidence",
      confidence: "0.6200",
      suggestedValue: {
        displayName: "LDL Cholesterol",
        originalValue: "142"
      }
    }
  ]);

  const [sharePolicy] = await db
    .insert(sharePolicies)
    .values({
      ownerUserId: owner.id,
      recipientUserId: clinician.id,
      recipientEmail: clinician.email,
      recipientName: clinician.displayName,
      status: "active",
      startsAt: new Date("2026-01-05T00:00:00Z"),
      expiresAt: new Date("2026-04-05T00:00:00Z"),
      fromObservedAt: new Date("2025-01-01T00:00:00Z"),
      createdByUserId: owner.id,
      metadata: {
        reason: "Cardiology consult"
      }
    })
    .returning();

  if (!sharePolicy) {
    throw new Error("Failed to create seed share policy");
  }

  await db.insert(sharePolicyScopes).values([
    { policyId: sharePolicy.id, category: "labs", includeSourceDocuments: true },
    { policyId: sharePolicy.id, category: "medications" },
    { policyId: sharePolicy.id, category: "conditions" }
  ]);

  await db.insert(auditEvents).values([
    {
      ownerUserId: owner.id,
      actorType: "worker",
      actorId: "seed-worker",
      action: "import.completed",
      resourceType: "import_job",
      resourceId: a1cSource.job.id,
      metadata: { sourceDocumentId: a1cSource.document.id }
    },
    {
      ownerUserId: owner.id,
      actorType: "user",
      actorId: owner.id,
      action: "share.created",
      resourceType: "share_policy",
      resourceId: sharePolicy.id,
      metadata: { categories: ["labs", "medications", "conditions"] }
    }
  ]);

  await db.insert(outboxEvents).values([
    {
      ownerUserId: owner.id,
      actorType: "worker",
      actorId: "seed-worker",
      eventType: "observation.created",
      aggregateType: "observation",
      aggregateId: a1c.id,
      status: "sent",
      payload: { sourceRecordId: a1cSource.record.id },
      processedAt: new Date("2026-01-05T13:00:05Z")
    },
    {
      ownerUserId: owner.id,
      actorType: "user",
      actorId: owner.id,
      eventType: "share.created",
      aggregateType: "share_policy",
      aggregateId: sharePolicy.id,
      payload: { categories: ["labs", "medications", "conditions"] }
    }
  ]);

  const openReviewTasks = await db
    .select()
    .from(reviewTasks)
    .where(and(eq(reviewTasks.ownerUserId, owner.id), eq(reviewTasks.status, "open")));

  console.log(
    JSON.stringify(
      {
        owner: owner.email,
        clinician: clinician.email,
        observations: [a1c.displayName, ldl.displayName],
        openReviewTasks: openReviewTasks.length,
        sharePolicyId: sharePolicy.id
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = createPgPool();
  const db = createDb(pool);

  seedDevelopmentData(db)
    .then(async () => {
      await pool.end();
    })
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exitCode = 1;
    });
}
