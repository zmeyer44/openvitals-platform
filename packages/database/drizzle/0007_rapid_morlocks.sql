CREATE UNIQUE INDEX "blob_objects_owner_id_unique" ON "blob_objects" USING btree ("owner_user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "conditions_owner_id_unique" ON "conditions" USING btree ("owner_user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "encounters_owner_id_unique" ON "encounters" USING btree ("owner_user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "import_jobs_owner_id_unique" ON "import_jobs" USING btree ("owner_user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "medications_owner_id_unique" ON "medications" USING btree ("owner_user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "observations_owner_id_unique" ON "observations" USING btree ("owner_user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_tasks_owner_id_unique" ON "review_tasks" USING btree ("owner_user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_documents_owner_id_unique" ON "source_documents" USING btree ("owner_user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_records_owner_id_unique" ON "source_records" USING btree ("owner_user_id","id");--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_owner_source_record_fk" FOREIGN KEY ("owner_user_id","source_record_id") REFERENCES "public"."source_records"("owner_user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_owner_source_record_fk" FOREIGN KEY ("owner_user_id","source_record_id") REFERENCES "public"."source_records"("owner_user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_classifications" ADD CONSTRAINT "file_classifications_owner_source_document_fk" FOREIGN KEY ("owner_user_id","source_document_id") REFERENCES "public"."source_documents"("owner_user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_classifications" ADD CONSTRAINT "file_classifications_owner_import_job_fk" FOREIGN KEY ("owner_user_id","import_job_id") REFERENCES "public"."import_jobs"("owner_user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_owner_source_document_fk" FOREIGN KEY ("owner_user_id","source_document_id") REFERENCES "public"."source_documents"("owner_user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_status_history" ADD CONSTRAINT "import_status_history_owner_import_job_fk" FOREIGN KEY ("owner_user_id","import_job_id") REFERENCES "public"."import_jobs"("owner_user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_status_history" ADD CONSTRAINT "import_status_history_owner_source_document_fk" FOREIGN KEY ("owner_user_id","source_document_id") REFERENCES "public"."source_documents"("owner_user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_owner_source_record_fk" FOREIGN KEY ("owner_user_id","source_record_id") REFERENCES "public"."source_records"("owner_user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_owner_source_record_fk" FOREIGN KEY ("owner_user_id","source_record_id") REFERENCES "public"."source_records"("owner_user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance" ADD CONSTRAINT "provenance_owner_source_document_fk" FOREIGN KEY ("owner_user_id","source_document_id") REFERENCES "public"."source_documents"("owner_user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance" ADD CONSTRAINT "provenance_owner_source_record_fk" FOREIGN KEY ("owner_user_id","source_record_id") REFERENCES "public"."source_records"("owner_user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance" ADD CONSTRAINT "provenance_owner_import_job_fk" FOREIGN KEY ("owner_user_id","import_job_id") REFERENCES "public"."import_jobs"("owner_user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_owner_source_record_fk" FOREIGN KEY ("owner_user_id","source_record_id") REFERENCES "public"."source_records"("owner_user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_owner_blob_fk" FOREIGN KEY ("owner_user_id","blob_object_id") REFERENCES "public"."blob_objects"("owner_user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_owner_source_document_fk" FOREIGN KEY ("owner_user_id","source_document_id") REFERENCES "public"."source_documents"("owner_user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_owner_import_job_fk" FOREIGN KEY ("owner_user_id","import_job_id") REFERENCES "public"."import_jobs"("owner_user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "openvitals_assert_resource_owner"(
  p_resource_type text,
  p_resource_id uuid,
  p_owner_user_id uuid
) RETURNS void AS $$
DECLARE
  matched boolean;
BEGIN
  IF p_resource_type IS NULL OR p_resource_id IS NULL OR p_owner_user_id IS NULL THEN
    RETURN;
  END IF;

  CASE p_resource_type
    WHEN 'blob_object' THEN
      SELECT EXISTS (SELECT 1 FROM blob_objects WHERE id = p_resource_id AND owner_user_id = p_owner_user_id) INTO matched;
    WHEN 'condition' THEN
      SELECT EXISTS (SELECT 1 FROM conditions WHERE id = p_resource_id AND owner_user_id = p_owner_user_id) INTO matched;
    WHEN 'encounter' THEN
      SELECT EXISTS (SELECT 1 FROM encounters WHERE id = p_resource_id AND owner_user_id = p_owner_user_id) INTO matched;
    WHEN 'import_job' THEN
      SELECT EXISTS (SELECT 1 FROM import_jobs WHERE id = p_resource_id AND owner_user_id = p_owner_user_id) INTO matched;
    WHEN 'intake_workflow' THEN
      SELECT EXISTS (SELECT 1 FROM intake_workflows WHERE id = p_resource_id AND owner_user_id = p_owner_user_id) INTO matched;
    WHEN 'medication' THEN
      SELECT EXISTS (SELECT 1 FROM medications WHERE id = p_resource_id AND owner_user_id = p_owner_user_id) INTO matched;
    WHEN 'observation' THEN
      SELECT EXISTS (SELECT 1 FROM observations WHERE id = p_resource_id AND owner_user_id = p_owner_user_id) INTO matched;
    WHEN 'review_task' THEN
      SELECT EXISTS (SELECT 1 FROM review_tasks WHERE id = p_resource_id AND owner_user_id = p_owner_user_id) INTO matched;
    WHEN 'share_policy' THEN
      SELECT EXISTS (SELECT 1 FROM share_policies WHERE id = p_resource_id AND owner_user_id = p_owner_user_id) INTO matched;
    WHEN 'source_document' THEN
      SELECT EXISTS (SELECT 1 FROM source_documents WHERE id = p_resource_id AND owner_user_id = p_owner_user_id) INTO matched;
    WHEN 'source_record' THEN
      SELECT EXISTS (SELECT 1 FROM source_records WHERE id = p_resource_id AND owner_user_id = p_owner_user_id) INTO matched;
    WHEN 'user_profile' THEN
      SELECT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = p_resource_id AND user_id = p_owner_user_id) INTO matched;
    ELSE
      RAISE EXCEPTION 'Unsupported owner-scoped resource type: %', p_resource_type
        USING ERRCODE = '23503';
  END CASE;

  IF NOT matched THEN
    RAISE EXCEPTION 'Resource % % does not belong to owner %', p_resource_type, p_resource_id, p_owner_user_id
      USING ERRCODE = '23503';
  END IF;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "openvitals_guard_provenance_owner"() RETURNS trigger AS $$
BEGIN
  PERFORM openvitals_assert_resource_owner(NEW.resource_type, NEW.resource_id, NEW.owner_user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "provenance_resource_owner_guard"
BEFORE INSERT OR UPDATE OF "owner_user_id", "resource_type", "resource_id"
ON "provenance"
FOR EACH ROW EXECUTE FUNCTION "openvitals_guard_provenance_owner"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "openvitals_guard_review_task_owner"() RETURNS trigger AS $$
BEGIN
  IF (NEW.resource_type IS NULL) <> (NEW.resource_id IS NULL) THEN
    RAISE EXCEPTION 'Review task resource_type and resource_id must be both null or both present'
      USING ERRCODE = '23514';
  ELSIF NEW.resource_type IS NOT NULL THEN
    PERFORM openvitals_assert_resource_owner(NEW.resource_type, NEW.resource_id, NEW.owner_user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "review_tasks_resource_owner_guard"
BEFORE INSERT OR UPDATE OF "owner_user_id", "resource_type", "resource_id"
ON "review_tasks"
FOR EACH ROW EXECUTE FUNCTION "openvitals_guard_review_task_owner"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "openvitals_guard_record_revision_owner"() RETURNS trigger AS $$
BEGIN
  PERFORM openvitals_assert_resource_owner(NEW.resource_type, NEW.resource_id, NEW.owner_user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "record_revisions_resource_owner_guard"
BEFORE INSERT OR UPDATE OF "owner_user_id", "resource_type", "resource_id"
ON "record_revisions"
FOR EACH ROW EXECUTE FUNCTION "openvitals_guard_record_revision_owner"();
