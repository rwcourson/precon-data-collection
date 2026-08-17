CREATE TABLE IF NOT EXISTS "round_note_mentions" (
	"id" serial PRIMARY KEY NOT NULL,
	"note_id" integer NOT NULL,
	"mentioned_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "round_note_mentions_note_user_unique" ON "round_note_mentions" ("note_id","mentioned_user_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "note_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "round_note_mentions" ADD CONSTRAINT "round_note_mentions_note_id_round_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."round_notes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "round_note_mentions" ADD CONSTRAINT "round_note_mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_note_id_round_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."round_notes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
