ALTER TABLE "conditions" DROP CONSTRAINT "conditions_source_record_id_source_records_id_fk";
--> statement-breakpoint
ALTER TABLE "encounters" DROP CONSTRAINT "encounters_source_record_id_source_records_id_fk";
--> statement-breakpoint
ALTER TABLE "medications" DROP CONSTRAINT "medications_source_record_id_source_records_id_fk";
--> statement-breakpoint
ALTER TABLE "observations" DROP CONSTRAINT "observations_source_record_id_source_records_id_fk";
--> statement-breakpoint
ALTER TABLE "conditions" ALTER COLUMN "source_record_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "encounters" ALTER COLUMN "source_record_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "medications" ALTER COLUMN "source_record_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "observations" ALTER COLUMN "source_record_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance" ADD CONSTRAINT "provenance_origin_required" CHECK (
        "provenance"."source_document_id" is not null
        or "provenance"."source_record_id" is not null
        or "provenance"."import_job_id" is not null
        or ("provenance"."actor_type" = 'user' and "provenance"."actor_id" is not null)
        or ("provenance"."actor_type" = 'integration' and "provenance"."actor_id" is not null)
      );