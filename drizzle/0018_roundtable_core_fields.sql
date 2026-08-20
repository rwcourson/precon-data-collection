ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "salesforce_shadow" jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "hpp_flag" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "go_no_go_flag" text;--> statement-breakpoint
ALTER TABLE "estimate_rounds" ADD COLUMN IF NOT EXISTS "interview_date" date;--> statement-breakpoint
ALTER TABLE "estimate_rounds" ADD COLUMN IF NOT EXISTS "project_start_month" text;--> statement-breakpoint
ALTER TABLE "estimate_rounds" ADD COLUMN IF NOT EXISTS "awardable_amount" double precision;--> statement-breakpoint
ALTER TABLE "estimate_rounds" ADD COLUMN IF NOT EXISTS "contract_amount_signed" double precision;--> statement-breakpoint
ALTER TABLE "status_transitions" ADD COLUMN IF NOT EXISTS "reason" text;--> statement-breakpoint
ALTER TABLE "status_transitions" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_user_idempotency_unique"
  ON "notifications" ("user_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;--> statement-breakpoint
UPDATE "estimate_rounds"
SET "project_start_month" = substring("project_start_date"::text from 1 for 7)
WHERE "project_start_month" IS NULL AND "project_start_date" IS NOT NULL;
