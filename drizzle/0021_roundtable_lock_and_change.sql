CREATE TABLE IF NOT EXISTS "round_lock_revisions" (
  "id" serial PRIMARY KEY NOT NULL,
  "round_id" integer NOT NULL,
  "revision" integer NOT NULL,
  "snapshot" jsonb NOT NULL,
  "locked_by_id" integer NOT NULL,
  "locked_at" timestamp DEFAULT now() NOT NULL,
  "unlocked_by_id" integer,
  "unlocked_at" timestamp,
  "unlock_reason" text
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "round_lock_revisions_round_revision_unique"
  ON "round_lock_revisions" ("round_id", "revision");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "round_lock_revisions_active_idx"
  ON "round_lock_revisions" ("round_id", "locked_at")
  WHERE "unlocked_at" IS NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "publication_outbox" (
  "id" serial PRIMARY KEY NOT NULL,
  "destination" text DEFAULT 'databricks' NOT NULL,
  "event_type" text NOT NULL,
  "round_id" integer NOT NULL,
  "lock_revision_id" integer NOT NULL,
  "idempotency_key" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "available_at" timestamp DEFAULT now() NOT NULL,
  "processed_at" timestamp,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "publication_outbox_idempotency_unique"
  ON "publication_outbox" ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "publication_outbox_status_available_idx"
  ON "publication_outbox" ("status", "available_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "round_field_exceptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "round_id" integer NOT NULL,
  "field_key" text NOT NULL,
  "kind" text NOT NULL,
  "value_snapshot" text,
  "reason" text,
  "elected_by_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "revoked_at" timestamp
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "round_field_exceptions_round_field_idx"
  ON "round_field_exceptions" ("round_id", "field_key");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_round_watermarks" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "round_id" integer NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "last_acked_audit_id" integer,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_round_watermarks_user_round_unique"
  ON "user_round_watermarks" ("user_id", "round_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "product_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "event" text NOT NULL,
  "user_id" integer,
  "region" text,
  "properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_events_event_time_idx"
  ON "product_events" ("event", "occurred_at");--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "round_lock_revisions" ADD CONSTRAINT "round_lock_revisions_round_id_estimate_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."estimate_rounds"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "round_lock_revisions" ADD CONSTRAINT "round_lock_revisions_locked_by_id_users_id_fk" FOREIGN KEY ("locked_by_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "round_lock_revisions" ADD CONSTRAINT "round_lock_revisions_unlocked_by_id_users_id_fk" FOREIGN KEY ("unlocked_by_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "publication_outbox" ADD CONSTRAINT "publication_outbox_round_id_estimate_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."estimate_rounds"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "publication_outbox" ADD CONSTRAINT "publication_outbox_lock_revision_id_round_lock_revisions_id_fk" FOREIGN KEY ("lock_revision_id") REFERENCES "public"."round_lock_revisions"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "round_field_exceptions" ADD CONSTRAINT "round_field_exceptions_round_id_estimate_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."estimate_rounds"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "round_field_exceptions" ADD CONSTRAINT "round_field_exceptions_elected_by_id_users_id_fk" FOREIGN KEY ("elected_by_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_round_watermarks" ADD CONSTRAINT "user_round_watermarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_round_watermarks" ADD CONSTRAINT "user_round_watermarks_round_id_estimate_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."estimate_rounds"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_events" ADD CONSTRAINT "product_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
