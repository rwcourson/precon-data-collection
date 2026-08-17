CREATE TABLE IF NOT EXISTS "job_region_visibility" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"region" text NOT NULL,
	"added_by_id" integer,
	"added_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_user_visibility" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"added_by_id" integer,
	"added_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_region_visibility_job_region_unique" ON "job_region_visibility" ("job_id","region");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_region_visibility_region_idx" ON "job_region_visibility" ("region");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_user_visibility_job_user_unique" ON "job_user_visibility" ("job_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_user_visibility_user_idx" ON "job_user_visibility" ("user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_region_visibility" ADD CONSTRAINT "job_region_visibility_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_region_visibility" ADD CONSTRAINT "job_region_visibility_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_user_visibility" ADD CONSTRAINT "job_user_visibility_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_user_visibility" ADD CONSTRAINT "job_user_visibility_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_user_visibility" ADD CONSTRAINT "job_user_visibility_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
INSERT INTO "job_region_visibility" ("job_id", "region", "added_by_id", "added_at")
SELECT "id", "region", "created_by_id", "created_at" FROM "jobs"
ON CONFLICT ("job_id", "region") DO NOTHING;--> statement-breakpoint
CREATE OR REPLACE FUNCTION jobs_insert_home_region_visibility()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO job_region_visibility (job_id, region, added_by_id, added_at)
  VALUES (NEW.id, NEW.region, NEW.created_by_id, now())
  ON CONFLICT (job_id, region) DO NOTHING;
  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS jobs_insert_home_region_visibility ON jobs;--> statement-breakpoint
CREATE TRIGGER jobs_insert_home_region_visibility
AFTER INSERT ON jobs
FOR EACH ROW
EXECUTE FUNCTION jobs_insert_home_region_visibility();
