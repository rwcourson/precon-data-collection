CREATE TABLE IF NOT EXISTS "device_code" (
  "id" text PRIMARY KEY NOT NULL,
  "device_code" text NOT NULL,
  "user_code" text NOT NULL,
  "user_id" text,
  "client_id" text,
  "scope" text,
  "status" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "last_polled_at" timestamp,
  "polling_interval" integer,
  "oauth_client_id" text,
  "resources" text[]
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "device_code" ADD CONSTRAINT "device_code_user_id_user_id_fk"
 FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "device_code" ADD CONSTRAINT "device_code_oauth_client_id_oauth_client_client_id_fk"
 FOREIGN KEY ("oauth_client_id") REFERENCES "public"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deviceCode_deviceCode_uidx" ON "device_code" USING btree ("device_code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deviceCode_userCode_uidx" ON "device_code" USING btree ("user_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deviceCode_userId_idx" ON "device_code" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deviceCode_oauthClientId_idx" ON "device_code" USING btree ("oauth_client_id");
