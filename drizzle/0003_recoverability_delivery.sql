CREATE TABLE IF NOT EXISTS "deletion_batches" (
  "id" serial PRIMARY KEY NOT NULL,
  "actor_id" integer,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "deletion_batch_id" integer;--> statement-breakpoint
ALTER TABLE "estimate_rounds" ADD COLUMN IF NOT EXISTS "deletion_batch_id" integer;--> statement-breakpoint
ALTER TABLE "sheets" ADD COLUMN IF NOT EXISTS "deletion_batch_id" integer;--> statement-breakpoint
ALTER TABLE "sheet_rows" ADD COLUMN IF NOT EXISTS "deletion_batch_id" integer;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN IF NOT EXISTS "logical_delivery_key" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN IF NOT EXISTS "provider_message_id" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamp;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_artifacts" (
  "id" serial PRIMARY KEY NOT NULL,
  "report_key" text NOT NULL,
  "checksum" text NOT NULL,
  "byte_size" integer NOT NULL,
  "content_type" text NOT NULL DEFAULT 'application/pdf',
  "storage_key" text NOT NULL,
  "region" text,
  "owner_id" integer,
  "parameters" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS email_outbox_logical_delivery_unique
  ON email_outbox (logical_delivery_key)
  WHERE logical_delivery_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS report_artifacts_report_key_idx ON report_artifacts (report_key, created_at);
