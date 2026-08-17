ALTER TABLE "estimate_rounds" ADD COLUMN IF NOT EXISTS "team_assigned_at" timestamp;--> statement-breakpoint
ALTER TABLE "estimate_rounds" ADD COLUMN IF NOT EXISTS "team_assigned_by_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "estimate_rounds" ADD CONSTRAINT "estimate_rounds_team_assigned_by_id_users_id_fk" FOREIGN KEY ("team_assigned_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
