CREATE TABLE IF NOT EXISTS "mcp_user_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"enabled" boolean,
	"scope_ceiling" jsonb,
	"updated_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_user_access_user_id_unique" ON "mcp_user_access" ("user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_user_access" ADD CONSTRAINT "mcp_user_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_user_access" ADD CONSTRAINT "mcp_user_access_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
