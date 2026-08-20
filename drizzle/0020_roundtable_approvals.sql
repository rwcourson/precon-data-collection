CREATE TABLE IF NOT EXISTS "approval_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "region" text NOT NULL,
  "job_id" integer,
  "round_id" integer,
  "payload" jsonb NOT NULL,
  "expected_updated_at" timestamp,
  "requested_by_id" integer NOT NULL,
  "requested_at" timestamp DEFAULT now() NOT NULL,
  "decided_by_id" integer,
  "decided_at" timestamp,
  "decision_reason" text,
  "published_job_id" integer,
  "published_round_id" integer,
  "highlight_until" timestamp
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_requests_region_status_idx"
  ON "approval_requests" ("region", "status", "requested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_requests_round_status_idx"
  ON "approval_requests" ("round_id", "status");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "group_edit_policies" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL,
  "role" "role" NOT NULL,
  "mode" text DEFAULT 'propose' NOT NULL,
  "updated_by_id" integer,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "group_edit_policies_group_role_unique"
  ON "group_edit_policies" ("group_id", "role");--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_round_id_estimate_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."estimate_rounds"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_published_job_id_jobs_id_fk" FOREIGN KEY ("published_job_id") REFERENCES "public"."jobs"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_published_round_id_estimate_rounds_id_fk" FOREIGN KEY ("published_round_id") REFERENCES "public"."estimate_rounds"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_edit_policies" ADD CONSTRAINT "group_edit_policies_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_edit_policies" ADD CONSTRAINT "group_edit_policies_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
