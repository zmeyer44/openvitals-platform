CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('user', 'recipient', 'system', 'worker', 'admin', 'integration');--> statement-breakpoint
CREATE TYPE "public"."import_job_status" AS ENUM('uploaded', 'classified', 'parsed', 'normalized', 'needs_review', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."intake_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('connected', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('available', 'running', 'retryable', 'completed', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'sent', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."record_category" AS ENUM('labs', 'medications', 'conditions', 'vitals', 'documents', 'encounters', 'family_history', 'lifestyle', 'notes');--> statement-breakpoint
CREATE TYPE "public"."record_review_state" AS ENUM('not_required', 'needs_review', 'confirmed', 'corrected', 'ignored', 'merged', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."review_action" AS ENUM('confirm', 'correct', 'ignore', 'merge_duplicate', 'mark_unknown', 'attach_note');--> statement-breakpoint
CREATE TYPE "public"."review_task_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."share_policy_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('file', 'integration', 'manual_intake', 'manual_entry');--> statement-breakpoint
CREATE TYPE "public"."source_record_type" AS ENUM('observation', 'condition', 'medication', 'encounter', 'note', 'family_history', 'lifestyle', 'unsupported', 'empty');--> statement-breakpoint
CREATE TYPE "public"."trust_level" AS ENUM('ai_extracted', 'parser_extracted', 'integration_imported', 'user_entered', 'user_confirmed', 'user_corrected');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'clinician', 'caregiver', 'admin');--> statement-breakpoint
CREATE TYPE "public"."webhook_event_status" AS ENUM('accepted', 'rejected', 'processed');--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_auth_id" text,
	"email" varchar(320) NOT NULL,
	"display_name" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" text,
	"user_agent_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blob_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"storage_provider" text DEFAULT 'local' NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"source_record_id" uuid,
	"snomed_code" text,
	"icd10_code" text,
	"display_name" text NOT NULL,
	"clinical_status" text,
	"verification_status" text,
	"onset_at" timestamp with time zone,
	"abatement_at" timestamp with time zone,
	"notes" text,
	"confidence" numeric(5, 4),
	"review_state" "record_review_state" DEFAULT 'needs_review' NOT NULL,
	"trust_level" "trust_level" DEFAULT 'parser_extracted' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encounters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"source_record_id" uuid,
	"encounter_type" text,
	"provider_name" text,
	"facility_name" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"reason" text,
	"confidence" numeric(5, 4),
	"review_state" "record_review_state" DEFAULT 'needs_review' NOT NULL,
	"trust_level" "trust_level" DEFAULT 'parser_extracted' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"status" "import_job_status" DEFAULT 'uploaded' NOT NULL,
	"idempotency_key" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"retry_after" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"step_key" text NOT NULL,
	"answer_key" text NOT NULL,
	"answer_value" jsonb,
	"skipped" boolean DEFAULT false NOT NULL,
	"canonical_resource_type" text,
	"canonical_resource_id" uuid,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"status" "intake_status" DEFAULT 'in_progress' NOT NULL,
	"current_step" text,
	"skipped_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"signature_header" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"status" "webhook_event_status" NOT NULL,
	"rejection_reason" text,
	"sanitized_payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_account_id" text NOT NULL,
	"status" "integration_status" DEFAULT 'connected' NOT NULL,
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_sync_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"status" "job_status" DEFAULT 'available' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_by" text,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"dead_letter_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"source_record_id" uuid,
	"rxnorm_code" text,
	"display_name" text NOT NULL,
	"dosage_text" text,
	"route" text,
	"frequency" text,
	"started_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"confidence" numeric(5, 4),
	"review_state" "record_review_state" DEFAULT 'needs_review' NOT NULL,
	"trust_level" "trust_level" DEFAULT 'parser_extracted' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"source_record_id" uuid,
	"category" "record_category" DEFAULT 'labs' NOT NULL,
	"loinc_code" text,
	"display_name" text NOT NULL,
	"observed_at" timestamp with time zone,
	"observed_at_unknown" boolean DEFAULT false NOT NULL,
	"original_value" text,
	"value_numeric" numeric(18, 6),
	"value_text" text,
	"normalized_value_numeric" numeric(18, 6),
	"unit_original" text,
	"unit_normalized" text,
	"reference_range_low" numeric(18, 6),
	"reference_range_high" numeric(18, 6),
	"interpretation" text,
	"confidence" numeric(5, 4),
	"review_state" "record_review_state" DEFAULT 'needs_review' NOT NULL,
	"trust_level" "trust_level" DEFAULT 'parser_extracted' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 10 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_by" text,
	"locked_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"source_document_id" uuid,
	"source_record_id" uuid,
	"import_job_id" uuid,
	"actor_type" "actor_type" DEFAULT 'system' NOT NULL,
	"actor_id" text,
	"derivation" text NOT NULL,
	"parser_name" text,
	"parser_version" text,
	"confidence" numeric(5, 4),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"previous_value" jsonb NOT NULL,
	"new_value" jsonb NOT NULL,
	"reason" text,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"source_record_id" uuid,
	"resource_type" text,
	"resource_id" uuid,
	"status" "review_task_status" DEFAULT 'open' NOT NULL,
	"reason" text NOT NULL,
	"confidence" numeric(5, 4),
	"suggested_value" jsonb,
	"resolution_action" "review_action",
	"resolution_note" text,
	"assigned_to_user_id" uuid,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"recipient_user_id" uuid,
	"recipient_email" varchar(320),
	"recipient_name" text,
	"access_token_hash" text,
	"status" "share_policy_status" DEFAULT 'active' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"from_observed_at" timestamp with time zone,
	"to_observed_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"revoked_by_user_id" uuid,
	"revoked_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_policy_scopes" (
	"policy_id" uuid NOT NULL,
	"category" "record_category" NOT NULL,
	"include_source_documents" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_policy_scopes_policy_id_category_pk" PRIMARY KEY("policy_id","category")
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"blob_object_id" uuid,
	"source_kind" "source_kind" DEFAULT 'file' NOT NULL,
	"file_name" text,
	"mime_type" text,
	"sha256" varchar(64),
	"status" "import_job_status" DEFAULT 'uploaded' NOT NULL,
	"classification" text,
	"parser_name" text,
	"parser_version" text,
	"classified_at" timestamp with time zone,
	"parsed_at" timestamp with time zone,
	"normalized_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"import_job_id" uuid,
	"record_type" "source_record_type" NOT NULL,
	"external_record_id" text,
	"parser_name" text NOT NULL,
	"parser_version" text NOT NULL,
	"source_text" text,
	"source_page" integer,
	"source_location" jsonb,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"extraction_confidence" numeric(5, 4),
	"original_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"review_state" "record_review_state" DEFAULT 'needs_review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"date_of_birth" timestamp with time zone,
	"sex_at_birth" text,
	"gender_identity" text,
	"blood_type" text,
	"emergency_contact" jsonb,
	"goals" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blob_objects" ADD CONSTRAINT "blob_objects_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_answers" ADD CONSTRAINT "intake_answers_workflow_id_intake_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."intake_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_answers" ADD CONSTRAINT "intake_answers_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_workflows" ADD CONSTRAINT "intake_workflows_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance" ADD CONSTRAINT "provenance_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance" ADD CONSTRAINT "provenance_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance" ADD CONSTRAINT "provenance_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance" ADD CONSTRAINT "provenance_import_job_id_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_revisions" ADD CONSTRAINT "record_revisions_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_assigned_to_user_id_app_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_resolved_by_user_id_app_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_policies" ADD CONSTRAINT "share_policies_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_policies" ADD CONSTRAINT "share_policies_recipient_user_id_app_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_policies" ADD CONSTRAINT "share_policies_created_by_user_id_app_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_policies" ADD CONSTRAINT "share_policies_revoked_by_user_id_app_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_policy_scopes" ADD CONSTRAINT "share_policy_scopes_policy_id_share_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."share_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_blob_object_id_blob_objects_id_fk" FOREIGN KEY ("blob_object_id") REFERENCES "public"."blob_objects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_import_job_id_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_email_unique" ON "app_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_external_auth_id_unique" ON "app_users" USING btree ("external_auth_id");--> statement-breakpoint
CREATE INDEX "audit_events_owner_action_idx" ON "audit_events" USING btree ("owner_user_id","action","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_resource_idx" ON "audit_events" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blob_objects_object_key_unique" ON "blob_objects" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "blob_objects_owner_idx" ON "blob_objects" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "blob_objects_sha256_idx" ON "blob_objects" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "conditions_owner_status_idx" ON "conditions" USING btree ("owner_user_id","clinical_status");--> statement-breakpoint
CREATE INDEX "conditions_source_record_idx" ON "conditions" USING btree ("source_record_id");--> statement-breakpoint
CREATE INDEX "conditions_review_state_idx" ON "conditions" USING btree ("owner_user_id","review_state");--> statement-breakpoint
CREATE INDEX "encounters_owner_date_idx" ON "encounters" USING btree ("owner_user_id","started_at");--> statement-breakpoint
CREATE INDEX "encounters_source_record_idx" ON "encounters" USING btree ("source_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "import_jobs_idempotency_key_unique" ON "import_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "import_jobs_owner_status_idx" ON "import_jobs" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "import_jobs_source_document_idx" ON "import_jobs" USING btree ("source_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "intake_answers_workflow_answer_unique" ON "intake_answers" USING btree ("workflow_id","step_key","answer_key");--> statement-breakpoint
CREATE INDEX "intake_answers_owner_idx" ON "intake_answers" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "intake_workflows_owner_status_idx" ON "intake_workflows" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_webhook_events_provider_event_unique" ON "integration_webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "integration_webhook_events_provider_status_idx" ON "integration_webhook_events" USING btree ("provider","status");--> statement-breakpoint
CREATE INDEX "integration_webhook_events_received_idx" ON "integration_webhook_events" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_provider_account_unique" ON "integrations" USING btree ("owner_user_id","provider","external_account_id");--> statement-breakpoint
CREATE INDEX "integrations_owner_provider_idx" ON "integrations" USING btree ("owner_user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "job_queue_idempotency_key_unique" ON "job_queue" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "job_queue_ready_idx" ON "job_queue" USING btree ("status","run_after","created_at");--> statement-breakpoint
CREATE INDEX "job_queue_kind_status_idx" ON "job_queue" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "medications_owner_active_idx" ON "medications" USING btree ("owner_user_id","active");--> statement-breakpoint
CREATE INDEX "medications_source_record_idx" ON "medications" USING btree ("source_record_id");--> statement-breakpoint
CREATE INDEX "medications_review_state_idx" ON "medications" USING btree ("owner_user_id","review_state");--> statement-breakpoint
CREATE INDEX "observations_owner_category_date_idx" ON "observations" USING btree ("owner_user_id","category","observed_at");--> statement-breakpoint
CREATE INDEX "observations_source_record_idx" ON "observations" USING btree ("source_record_id");--> statement-breakpoint
CREATE INDEX "observations_review_state_idx" ON "observations" USING btree ("owner_user_id","review_state");--> statement-breakpoint
CREATE INDEX "outbox_events_ready_idx" ON "outbox_events" USING btree ("status","available_at","created_at");--> statement-breakpoint
CREATE INDEX "outbox_events_aggregate_idx" ON "outbox_events" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "outbox_events_owner_idx" ON "outbox_events" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "provenance_resource_idx" ON "provenance" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "provenance_source_record_idx" ON "provenance" USING btree ("source_record_id");--> statement-breakpoint
CREATE INDEX "provenance_owner_idx" ON "provenance" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "record_revisions_resource_idx" ON "record_revisions" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "record_revisions_owner_idx" ON "record_revisions" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "review_tasks_owner_status_idx" ON "review_tasks" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "review_tasks_resource_idx" ON "review_tasks" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "review_tasks_source_record_idx" ON "review_tasks" USING btree ("source_record_id");--> statement-breakpoint
CREATE INDEX "share_policies_owner_status_idx" ON "share_policies" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "share_policies_recipient_user_idx" ON "share_policies" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "share_policies_token_hash_idx" ON "share_policies" USING btree ("access_token_hash");--> statement-breakpoint
CREATE INDEX "share_policy_scopes_category_idx" ON "share_policy_scopes" USING btree ("category");--> statement-breakpoint
CREATE INDEX "source_documents_owner_status_idx" ON "source_documents" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "source_documents_blob_idx" ON "source_documents" USING btree ("blob_object_id");--> statement-breakpoint
CREATE INDEX "source_records_document_idx" ON "source_records" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "source_records_import_job_idx" ON "source_records" USING btree ("import_job_id");--> statement-breakpoint
CREATE INDEX "source_records_owner_type_idx" ON "source_records" USING btree ("owner_user_id","record_type");
