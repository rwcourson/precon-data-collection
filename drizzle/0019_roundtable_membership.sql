CREATE TABLE IF NOT EXISTS "organization_groups" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "region" text,
  "parent_key" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_groups_key_unique"
  ON "organization_groups" ("key");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_group_memberships" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "group_id" integer NOT NULL,
  "membership_role" text DEFAULT 'member' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_group_memberships_user_group_unique"
  ON "user_group_memberships" ("user_id", "group_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "job_group_memberships" (
  "id" serial PRIMARY KEY NOT NULL,
  "job_id" integer NOT NULL,
  "group_id" integer NOT NULL,
  "participation_role" text DEFAULT 'partner' NOT NULL,
  "discipline" text,
  "added_by_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_group_memberships_job_group_unique"
  ON "job_group_memberships" ("job_id", "group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_group_memberships_group_idx"
  ON "job_group_memberships" ("group_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "job_relationships" (
  "id" serial PRIMARY KEY NOT NULL,
  "parent_job_id" integer NOT NULL,
  "child_job_id" integer NOT NULL,
  "kind" text DEFAULT 'sub_job' NOT NULL,
  "created_by_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "job_relationships_not_self" CHECK ("parent_job_id" <> "child_job_id")
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_relationships_parent_child_unique"
  ON "job_relationships" ("parent_job_id", "child_job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_relationships_child_idx"
  ON "job_relationships" ("child_job_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "round_staff_assignments" (
  "id" serial PRIMARY KEY NOT NULL,
  "round_id" integer NOT NULL,
  "stage" text NOT NULL,
  "user_id" integer,
  "role_label" text,
  "assigned_by_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "round_staff_assignments_round_stage_user_unique"
  ON "round_staff_assignments" ("round_id", "stage", "user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "round_staff_assignments_round_idx"
  ON "round_staff_assignments" ("round_id");--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "user_group_memberships" ADD CONSTRAINT "user_group_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_group_memberships" ADD CONSTRAINT "user_group_memberships_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_group_memberships" ADD CONSTRAINT "job_group_memberships_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_group_memberships" ADD CONSTRAINT "job_group_memberships_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_group_memberships" ADD CONSTRAINT "job_group_memberships_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_relationships" ADD CONSTRAINT "job_relationships_parent_job_id_jobs_id_fk" FOREIGN KEY ("parent_job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_relationships" ADD CONSTRAINT "job_relationships_child_job_id_jobs_id_fk" FOREIGN KEY ("child_job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_relationships" ADD CONSTRAINT "job_relationships_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "round_staff_assignments" ADD CONSTRAINT "round_staff_assignments_round_id_estimate_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."estimate_rounds"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "round_staff_assignments" ADD CONSTRAINT "round_staff_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "round_staff_assignments" ADD CONSTRAINT "round_staff_assignments_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

INSERT INTO "organization_groups" ("key", "name", "kind", "region")
SELECT DISTINCT
  'department:' || lower(regexp_replace("precon_department", '[^a-zA-Z0-9]+', '-', 'g')),
  "precon_department",
  'precon_department',
  "region"
FROM "estimate_rounds"
WHERE "precon_department" IS NOT NULL
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint

INSERT INTO "job_group_memberships" ("job_id", "group_id", "participation_role")
SELECT DISTINCT j."id", g."id", 'lead'
FROM "jobs" j
JOIN "organization_groups" g ON g."name" = j."precon_department"
ON CONFLICT ("job_id", "group_id") DO NOTHING;
