UPDATE "intake_workflows"
SET "status" = 'abandoned',
    "updated_at" = now()
WHERE "status" = 'in_progress'
  AND "id" NOT IN (
    SELECT DISTINCT ON ("owner_user_id") "id"
    FROM "intake_workflows"
    WHERE "status" = 'in_progress'
    ORDER BY "owner_user_id", "created_at" DESC, "id" DESC
  );--> statement-breakpoint
CREATE UNIQUE INDEX "intake_workflows_one_active_per_owner" ON "intake_workflows" USING btree ("owner_user_id") WHERE "intake_workflows"."status" = 'in_progress';