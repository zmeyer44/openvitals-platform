import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export type JsonObject = Record<string, unknown>;

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const actorTypeEnum = pgEnum("actor_type", [
  "user",
  "recipient",
  "system",
  "worker",
  "admin",
  "integration"
]);

export const userRoleEnum = pgEnum("user_role", ["user", "clinician", "caregiver", "admin"]);

export const importJobStatusEnum = pgEnum("import_job_status", [
  "uploaded",
  "classified",
  "parsed",
  "normalized",
  "needs_review",
  "completed",
  "failed"
]);

export const sourceKindEnum = pgEnum("source_kind", [
  "file",
  "integration",
  "manual_intake",
  "manual_entry"
]);

export const sourceRecordTypeEnum = pgEnum("source_record_type", [
  "observation",
  "condition",
  "medication",
  "encounter",
  "note",
  "family_history",
  "lifestyle",
  "unsupported",
  "empty"
]);

export const recordCategoryEnum = pgEnum("record_category", [
  "labs",
  "medications",
  "conditions",
  "vitals",
  "documents",
  "encounters",
  "family_history",
  "lifestyle",
  "notes"
]);

export const recordReviewStateEnum = pgEnum("record_review_state", [
  "not_required",
  "needs_review",
  "confirmed",
  "corrected",
  "ignored",
  "merged",
  "unknown"
]);

export const trustLevelEnum = pgEnum("trust_level", [
  "ai_extracted",
  "parser_extracted",
  "integration_imported",
  "user_entered",
  "user_confirmed",
  "user_corrected"
]);

export const reviewTaskStatusEnum = pgEnum("review_task_status", [
  "open",
  "resolved",
  "dismissed"
]);

export const reviewActionEnum = pgEnum("review_action", [
  "confirm",
  "correct",
  "ignore",
  "merge_duplicate",
  "mark_unknown",
  "attach_note"
]);

export const jobStatusEnum = pgEnum("job_status", [
  "available",
  "running",
  "retryable",
  "completed",
  "failed",
  "dead_letter"
]);

export const outboxStatusEnum = pgEnum("outbox_status", [
  "pending",
  "processing",
  "sent",
  "failed",
  "dead_letter"
]);

export const intakeStatusEnum = pgEnum("intake_status", [
  "in_progress",
  "completed",
  "abandoned"
]);

export const sharePolicyStatusEnum = pgEnum("share_policy_status", [
  "active",
  "revoked",
  "expired"
]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "connected",
  "revoked",
  "error"
]);

export const webhookEventStatusEnum = pgEnum("webhook_event_status", [
  "accepted",
  "rejected",
  "processed"
]);

export const authUsers = pgTable(
  "auth_users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    ...timestamps
  },
  (table) => [uniqueIndex("auth_users_email_unique").on(table.email)]
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" })
  },
  (table) => [
    uniqueIndex("auth_sessions_token_unique").on(table.token),
    index("auth_sessions_user_id_idx").on(table.userId)
  ]
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("auth_accounts_user_id_idx").on(table.userId),
    uniqueIndex("auth_accounts_provider_account_unique").on(table.providerId, table.accountId)
  ]
);

export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("auth_verifications_identifier_idx").on(table.identifier)]
);

export const betterAuthSchema = {
  user: authUsers,
  session: authSessions,
  account: authAccounts,
  verification: authVerifications
};

export const appUsers = pgTable(
  "app_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalAuthId: text("external_auth_id").references(() => authUsers.id, { onDelete: "set null" }),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: text("display_name"),
    role: userRoleEnum("role").default("user").notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex("app_users_email_unique").on(table.email),
    uniqueIndex("app_users_external_auth_id_unique").on(table.externalAuthId)
  ]
);

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    dateOfBirth: timestamp("date_of_birth", { withTimezone: true }),
    sexAtBirth: text("sex_at_birth"),
    genderIdentity: text("gender_identity"),
    bloodType: text("blood_type"),
    emergencyContact: jsonb("emergency_contact").$type<JsonObject>(),
    goals: jsonb("goals").$type<JsonObject>(),
    ...timestamps
  }
);

export const blobObjects = pgTable(
  "blob_objects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    storageProvider: text("storage_provider").default("local").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    metadata: jsonb("metadata").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex("blob_objects_object_key_unique").on(table.objectKey),
    index("blob_objects_owner_idx").on(table.ownerUserId),
    index("blob_objects_sha256_idx").on(table.sha256)
  ]
);

export const sourceDocuments = pgTable(
  "source_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    blobObjectId: uuid("blob_object_id").references(() => blobObjects.id, { onDelete: "set null" }),
    sourceKind: sourceKindEnum("source_kind").default("file").notNull(),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    sha256: varchar("sha256", { length: 64 }),
    status: importJobStatusEnum("status").default("uploaded").notNull(),
    classification: text("classification"),
    parserName: text("parser_name"),
    parserVersion: text("parser_version"),
    classifiedAt: timestamp("classified_at", { withTimezone: true }),
    parsedAt: timestamp("parsed_at", { withTimezone: true }),
    normalizedAt: timestamp("normalized_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    ...timestamps
  },
  (table) => [
    index("source_documents_owner_status_idx").on(table.ownerUserId, table.status),
    index("source_documents_blob_idx").on(table.blobObjectId)
  ]
);

export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: "cascade" }),
    status: importJobStatusEnum("status").default("uploaded").notNull(),
    idempotencyKey: text("idempotency_key"),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    retryAfter: timestamp("retry_after", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    metrics: jsonb("metrics").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    uniqueIndex("import_jobs_idempotency_key_unique").on(table.idempotencyKey),
    index("import_jobs_owner_status_idx").on(table.ownerUserId, table.status),
    index("import_jobs_source_document_idx").on(table.sourceDocumentId)
  ]
);

export const sourceRecords = pgTable(
  "source_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: "cascade" }),
    importJobId: uuid("import_job_id").references(() => importJobs.id, { onDelete: "set null" }),
    recordType: sourceRecordTypeEnum("record_type").notNull(),
    externalRecordId: text("external_record_id"),
    parserName: text("parser_name").notNull(),
    parserVersion: text("parser_version").notNull(),
    sourceText: text("source_text"),
    sourcePage: integer("source_page"),
    sourceLocation: jsonb("source_location").$type<JsonObject>(),
    extractedAt: timestamp("extracted_at", { withTimezone: true }).defaultNow().notNull(),
    extractionConfidence: numeric("extraction_confidence", { precision: 5, scale: 4 }),
    originalPayload: jsonb("original_payload").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    warnings: jsonb("warnings").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    reviewState: recordReviewStateEnum("review_state").default("needs_review").notNull(),
    ...timestamps
  },
  (table) => [
    index("source_records_document_idx").on(table.sourceDocumentId),
    index("source_records_import_job_idx").on(table.importJobId),
    index("source_records_owner_type_idx").on(table.ownerUserId, table.recordType)
  ]
);

export const observations = pgTable(
  "observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id")
      .notNull()
      .references(() => sourceRecords.id, { onDelete: "no action" }),
    category: recordCategoryEnum("category").default("labs").notNull(),
    loincCode: text("loinc_code"),
    displayName: text("display_name").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }),
    observedAtUnknown: boolean("observed_at_unknown").default(false).notNull(),
    originalValue: text("original_value"),
    valueNumeric: numeric("value_numeric", { precision: 18, scale: 6 }),
    valueText: text("value_text"),
    normalizedValueNumeric: numeric("normalized_value_numeric", { precision: 18, scale: 6 }),
    unitOriginal: text("unit_original"),
    unitNormalized: text("unit_normalized"),
    referenceRangeLow: numeric("reference_range_low", { precision: 18, scale: 6 }),
    referenceRangeHigh: numeric("reference_range_high", { precision: 18, scale: 6 }),
    interpretation: text("interpretation"),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    reviewState: recordReviewStateEnum("review_state").default("needs_review").notNull(),
    trustLevel: trustLevelEnum("trust_level").default("parser_extracted").notNull(),
    metadata: jsonb("metadata").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    ...timestamps
  },
  (table) => [
    index("observations_owner_category_date_idx").on(table.ownerUserId, table.category, table.observedAt),
    index("observations_source_record_idx").on(table.sourceRecordId),
    index("observations_review_state_idx").on(table.ownerUserId, table.reviewState)
  ]
);

export const conditions = pgTable(
  "conditions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id")
      .notNull()
      .references(() => sourceRecords.id, { onDelete: "no action" }),
    snomedCode: text("snomed_code"),
    icd10Code: text("icd10_code"),
    displayName: text("display_name").notNull(),
    clinicalStatus: text("clinical_status"),
    verificationStatus: text("verification_status"),
    onsetAt: timestamp("onset_at", { withTimezone: true }),
    abatementAt: timestamp("abatement_at", { withTimezone: true }),
    notes: text("notes"),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    reviewState: recordReviewStateEnum("review_state").default("needs_review").notNull(),
    trustLevel: trustLevelEnum("trust_level").default("parser_extracted").notNull(),
    metadata: jsonb("metadata").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    ...timestamps
  },
  (table) => [
    index("conditions_owner_status_idx").on(table.ownerUserId, table.clinicalStatus),
    index("conditions_source_record_idx").on(table.sourceRecordId),
    index("conditions_review_state_idx").on(table.ownerUserId, table.reviewState)
  ]
);

export const medications = pgTable(
  "medications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id")
      .notNull()
      .references(() => sourceRecords.id, { onDelete: "no action" }),
    rxnormCode: text("rxnorm_code"),
    displayName: text("display_name").notNull(),
    dosageText: text("dosage_text"),
    route: text("route"),
    frequency: text("frequency"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    active: boolean("active").default(true).notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    reviewState: recordReviewStateEnum("review_state").default("needs_review").notNull(),
    trustLevel: trustLevelEnum("trust_level").default("parser_extracted").notNull(),
    metadata: jsonb("metadata").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    ...timestamps
  },
  (table) => [
    index("medications_owner_active_idx").on(table.ownerUserId, table.active),
    index("medications_source_record_idx").on(table.sourceRecordId),
    index("medications_review_state_idx").on(table.ownerUserId, table.reviewState)
  ]
);

export const encounters = pgTable(
  "encounters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id")
      .notNull()
      .references(() => sourceRecords.id, { onDelete: "no action" }),
    encounterType: text("encounter_type"),
    providerName: text("provider_name"),
    facilityName: text("facility_name"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    reason: text("reason"),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    reviewState: recordReviewStateEnum("review_state").default("needs_review").notNull(),
    trustLevel: trustLevelEnum("trust_level").default("parser_extracted").notNull(),
    metadata: jsonb("metadata").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    ...timestamps
  },
  (table) => [
    index("encounters_owner_date_idx").on(table.ownerUserId, table.startedAt),
    index("encounters_source_record_idx").on(table.sourceRecordId)
  ]
);

export const provenance = pgTable(
  "provenance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    sourceDocumentId: uuid("source_document_id").references(() => sourceDocuments.id, { onDelete: "set null" }),
    sourceRecordId: uuid("source_record_id").references(() => sourceRecords.id, { onDelete: "set null" }),
    importJobId: uuid("import_job_id").references(() => importJobs.id, { onDelete: "set null" }),
    actorType: actorTypeEnum("actor_type").default("system").notNull(),
    actorId: text("actor_id"),
    derivation: text("derivation").notNull(),
    parserName: text("parser_name"),
    parserVersion: text("parser_version"),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    metadata: jsonb("metadata").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    check(
      "provenance_origin_required",
      sql`
        ${table.sourceDocumentId} is not null
        or ${table.sourceRecordId} is not null
        or ${table.importJobId} is not null
        or (${table.actorType} = 'user' and ${table.actorId} is not null)
        or (${table.actorType} = 'integration' and ${table.actorId} is not null)
      `
    ),
    index("provenance_resource_idx").on(table.resourceType, table.resourceId),
    index("provenance_source_record_idx").on(table.sourceRecordId),
    index("provenance_owner_idx").on(table.ownerUserId)
  ]
);

export const reviewTasks = pgTable(
  "review_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id").references(() => sourceRecords.id, { onDelete: "cascade" }),
    resourceType: text("resource_type"),
    resourceId: uuid("resource_id"),
    status: reviewTaskStatusEnum("status").default("open").notNull(),
    reason: text("reason").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    suggestedValue: jsonb("suggested_value").$type<JsonObject>(),
    resolutionAction: reviewActionEnum("resolution_action"),
    resolutionNote: text("resolution_note"),
    assignedToUserId: uuid("assigned_to_user_id").references(() => appUsers.id, { onDelete: "set null" }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => appUsers.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    index("review_tasks_owner_status_idx").on(table.ownerUserId, table.status),
    index("review_tasks_resource_idx").on(table.resourceType, table.resourceId),
    index("review_tasks_source_record_idx").on(table.sourceRecordId)
  ]
);

export const recordRevisions = pgTable(
  "record_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    previousValue: jsonb("previous_value").$type<JsonObject>().notNull(),
    newValue: jsonb("new_value").$type<JsonObject>().notNull(),
    reason: text("reason"),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: text("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("record_revisions_resource_idx").on(table.resourceType, table.resourceId),
    index("record_revisions_owner_idx").on(table.ownerUserId)
  ]
);

export const intakeWorkflows = pgTable(
  "intake_workflows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    status: intakeStatusEnum("status").default("in_progress").notNull(),
    currentStep: text("current_step"),
    skippedSteps: jsonb("skipped_steps").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [index("intake_workflows_owner_status_idx").on(table.ownerUserId, table.status)]
);

export const intakeAnswers = pgTable(
  "intake_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => intakeWorkflows.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    stepKey: text("step_key").notNull(),
    answerKey: text("answer_key").notNull(),
    answerValue: jsonb("answer_value").$type<JsonObject>(),
    skipped: boolean("skipped").default(false).notNull(),
    canonicalResourceType: text("canonical_resource_type"),
    canonicalResourceId: uuid("canonical_resource_id"),
    answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("intake_answers_workflow_answer_unique").on(table.workflowId, table.stepKey, table.answerKey),
    index("intake_answers_owner_idx").on(table.ownerUserId)
  ]
);

export const sharePolicies = pgTable(
  "share_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    recipientUserId: uuid("recipient_user_id").references(() => appUsers.id, { onDelete: "set null" }),
    recipientEmail: varchar("recipient_email", { length: 320 }),
    recipientName: text("recipient_name"),
    accessTokenHash: text("access_token_hash"),
    status: sharePolicyStatusEnum("status").default("active").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    fromObservedAt: timestamp("from_observed_at", { withTimezone: true }),
    toObservedAt: timestamp("to_observed_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => appUsers.id, { onDelete: "set null" }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => appUsers.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    ...timestamps
  },
  (table) => [
    index("share_policies_owner_status_idx").on(table.ownerUserId, table.status),
    index("share_policies_recipient_user_idx").on(table.recipientUserId),
    index("share_policies_token_hash_idx").on(table.accessTokenHash)
  ]
);

export const sharePolicyScopes = pgTable(
  "share_policy_scopes",
  {
    policyId: uuid("policy_id")
      .notNull()
      .references(() => sharePolicies.id, { onDelete: "cascade" }),
    category: recordCategoryEnum("category").notNull(),
    includeSourceDocuments: boolean("include_source_documents").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.policyId, table.category] }),
    index("share_policy_scopes_category_idx").on(table.category)
  ]
);

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalAccountId: text("external_account_id").notNull(),
    status: integrationStatusEnum("status").default("connected").notNull(),
    encryptedAccessToken: text("encrypted_access_token"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: jsonb("scopes").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex("integrations_provider_account_unique").on(
      table.ownerUserId,
      table.provider,
      table.externalAccountId
    ),
    index("integrations_owner_provider_idx").on(table.ownerUserId, table.provider)
  ]
);

export const integrationWebhookEvents = pgTable(
  "integration_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    signatureHeader: text("signature_header"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    verified: boolean("verified").default(false).notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    status: webhookEventStatusEnum("status").notNull(),
    rejectionReason: text("rejection_reason"),
    sanitizedPayload: jsonb("sanitized_payload").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull()
  },
  (table) => [
    uniqueIndex("integration_webhook_events_provider_event_unique").on(table.provider, table.eventId),
    index("integration_webhook_events_provider_status_idx").on(table.provider, table.status),
    index("integration_webhook_events_received_idx").on(table.receivedAt)
  ]
);

export const jobQueue = pgTable(
  "job_queue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull(),
    status: jobStatusEnum("status").default("available").notNull(),
    payload: jsonb("payload").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    idempotencyKey: text("idempotency_key"),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    runAfter: timestamp("run_after", { withTimezone: true }).defaultNow().notNull(),
    lockedBy: text("locked_by"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lastError: text("last_error"),
    deadLetterReason: text("dead_letter_reason"),
    ...timestamps
  },
  (table) => [
    uniqueIndex("job_queue_idempotency_key_unique").on(table.idempotencyKey),
    index("job_queue_ready_idx").on(table.status, table.runAfter, table.createdAt),
    index("job_queue_kind_status_idx").on(table.kind, table.status)
  ]
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: text("event_type").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    ownerUserId: uuid("owner_user_id").references(() => appUsers.id, { onDelete: "set null" }),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: text("actor_id"),
    payload: jsonb("payload").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    metadata: jsonb("metadata").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    status: outboxStatusEnum("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(10).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    lockedBy: text("locked_by"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("outbox_events_ready_idx").on(table.status, table.availableAt, table.createdAt),
    index("outbox_events_aggregate_idx").on(table.aggregateType, table.aggregateId),
    index("outbox_events_owner_idx").on(table.ownerUserId)
  ]
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id").references(() => appUsers.id, { onDelete: "set null" }),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id"),
    metadata: jsonb("metadata").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
    ipHash: text("ip_hash"),
    userAgentHash: text("user_agent_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("audit_events_owner_action_idx").on(table.ownerUserId, table.action, table.createdAt),
    index("audit_events_resource_idx").on(table.resourceType, table.resourceId),
    index("audit_events_actor_idx").on(table.actorType, table.actorId)
  ]
);
