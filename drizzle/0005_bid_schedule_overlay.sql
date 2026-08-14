ALTER TABLE "estimate_rounds" ADD COLUMN IF NOT EXISTS "drawings_due_date" date;--> statement-breakpoint
ALTER TABLE "estimate_rounds" ADD COLUMN IF NOT EXISTS "bid_review_date" date;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bid_schedule_views" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "owner_id" integer NOT NULL REFERENCES "public"."users"("id"),
  "region" text,
  "shared" boolean DEFAULT false NOT NULL,
  "config" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
