CREATE TABLE IF NOT EXISTS "user_table_prefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"surface" text NOT NULL,
	"config" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_table_prefs_user_surface_unique" ON "user_table_prefs" ("user_id","surface");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_table_prefs" ADD CONSTRAINT "user_table_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
