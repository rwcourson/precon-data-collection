CREATE TABLE IF NOT EXISTS "source_provenance" (
  "id" serial PRIMARY KEY NOT NULL,
  "job_id" integer,
  "round_id" integer,
  "field_key" text NOT NULL,
  "source" text NOT NULL,
  "source_record_id" text,
  "value_hash" text,
  "imported_by_id" integer,
  "imported_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "source_provenance_has_parent" CHECK ("job_id" IS NOT NULL OR "round_id" IS NOT NULL)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_provenance_round_field_idx"
  ON "source_provenance" ("round_id", "field_key");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "integration_import_batches" (
  "id" serial PRIMARY KEY NOT NULL,
  "source" text NOT NULL,
  "source_name" text,
  "checksum" text NOT NULL,
  "status" text DEFAULT 'preview' NOT NULL,
  "summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "imported_by_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_import_batches_source_checksum_unique"
  ON "integration_import_batches" ("source", "checksum");--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "source_provenance" ADD CONSTRAINT "source_provenance_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_provenance" ADD CONSTRAINT "source_provenance_round_id_estimate_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."estimate_rounds"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_provenance" ADD CONSTRAINT "source_provenance_imported_by_id_users_id_fk" FOREIGN KEY ("imported_by_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_import_batches" ADD CONSTRAINT "integration_import_batches_imported_by_id_users_id_fk" FOREIGN KEY ("imported_by_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
