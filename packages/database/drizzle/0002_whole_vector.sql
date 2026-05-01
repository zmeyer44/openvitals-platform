ALTER TABLE "conditions" DROP CONSTRAINT "conditions_source_record_id_source_records_id_fk";
--> statement-breakpoint
ALTER TABLE "encounters" DROP CONSTRAINT "encounters_source_record_id_source_records_id_fk";
--> statement-breakpoint
ALTER TABLE "medications" DROP CONSTRAINT "medications_source_record_id_source_records_id_fk";
--> statement-breakpoint
ALTER TABLE "observations" DROP CONSTRAINT "observations_source_record_id_source_records_id_fk";
--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE no action ON UPDATE no action;