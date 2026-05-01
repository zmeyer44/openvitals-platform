CREATE TYPE "public"."file_classification_decision" AS ENUM('supported', 'unsupported', 'empty', 'review_needed', 'error');--> statement-breakpoint
CREATE TABLE "file_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"import_job_id" uuid NOT NULL,
	"parser_name" text NOT NULL,
	"parser_version" text NOT NULL,
	"decision" "file_classification_decision" NOT NULL,
	"classification" text NOT NULL,
	"confidence" numeric(5, 4),
	"empty" boolean DEFAULT false NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"reason" text,
	"warnings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"import_job_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"from_status" "import_job_status",
	"to_status" "import_job_status" NOT NULL,
	"actor_type" "actor_type" DEFAULT 'system' NOT NULL,
	"actor_id" text,
	"reason" text,
	"error_code" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_classifications" ADD CONSTRAINT "file_classifications_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_classifications" ADD CONSTRAINT "file_classifications_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_classifications" ADD CONSTRAINT "file_classifications_import_job_id_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_status_history" ADD CONSTRAINT "import_status_history_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_status_history" ADD CONSTRAINT "import_status_history_import_job_id_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_status_history" ADD CONSTRAINT "import_status_history_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_classifications_import_job_idx" ON "file_classifications" USING btree ("import_job_id");--> statement-breakpoint
CREATE INDEX "file_classifications_document_idx" ON "file_classifications" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "file_classifications_owner_decision_idx" ON "file_classifications" USING btree ("owner_user_id","decision");--> statement-breakpoint
CREATE INDEX "import_status_history_import_job_idx" ON "import_status_history" USING btree ("import_job_id","created_at");--> statement-breakpoint
CREATE INDEX "import_status_history_document_idx" ON "import_status_history" USING btree ("source_document_id","created_at");--> statement-breakpoint
CREATE INDEX "import_status_history_owner_idx" ON "import_status_history" USING btree ("owner_user_id","created_at");