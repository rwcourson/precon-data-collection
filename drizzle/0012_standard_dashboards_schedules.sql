ALTER TABLE "dashboards" ADD COLUMN IF NOT EXISTS "is_standard" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "distribution_lists" ADD COLUMN IF NOT EXISTS "saved_report_id" integer;--> statement-breakpoint
ALTER TABLE "distribution_lists" ADD COLUMN IF NOT EXISTS "weekday" integer;--> statement-breakpoint
ALTER TABLE "distribution_lists" ADD COLUMN IF NOT EXISTS "hour" integer;--> statement-breakpoint
ALTER TABLE "distribution_lists" ADD COLUMN IF NOT EXISTS "paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribution_lists" ADD CONSTRAINT "distribution_lists_saved_report_id_saved_reports_id_fk" FOREIGN KEY ("saved_report_id") REFERENCES "public"."saved_reports"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
