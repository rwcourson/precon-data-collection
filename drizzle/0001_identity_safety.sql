ALTER TABLE "api_idempotency_keys" ADD COLUMN "operation" text;--> statement-breakpoint
ALTER TABLE "api_idempotency_keys" ADD COLUMN "payload_hash" text;--> statement-breakpoint
UPDATE "api_idempotency_keys" SET "operation" = 'legacy', "payload_hash" = 'legacy' WHERE "operation" IS NULL OR "payload_hash" IS NULL;--> statement-breakpoint
ALTER TABLE "api_idempotency_keys" ALTER COLUMN "operation" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "api_idempotency_keys" ALTER COLUMN "payload_hash" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "api_idempotency_token_key_unique" ON "api_idempotency_keys" USING btree ("token_id", "key");--> statement-breakpoint

ALTER TABLE "api_destructive_challenges" ADD COLUMN "actor_id" integer;--> statement-breakpoint
ALTER TABLE "api_destructive_challenges" ADD COLUMN "challenge_hash" text;--> statement-breakpoint
ALTER TABLE "api_destructive_challenges" ADD COLUMN "target" text;--> statement-breakpoint
ALTER TABLE "api_destructive_challenges" ADD COLUMN "payload_hash" text;--> statement-breakpoint
UPDATE "api_destructive_challenges" AS c
SET "actor_id" = t."created_by_id",
    "challenge_hash" = c."challenge",
    "target" = 'legacy',
    "payload_hash" = 'legacy'
FROM "api_tokens" AS t
WHERE c."token_id" = t."id";--> statement-breakpoint
ALTER TABLE "api_destructive_challenges" ALTER COLUMN "actor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "api_destructive_challenges" ALTER COLUMN "challenge_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "api_destructive_challenges" ALTER COLUMN "target" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "api_destructive_challenges" ALTER COLUMN "payload_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "api_destructive_challenges" DROP COLUMN "challenge";--> statement-breakpoint
ALTER TABLE "api_destructive_challenges" ADD CONSTRAINT "api_destructive_challenges_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_destructive_challenge_hash_unique" ON "api_destructive_challenges" USING btree ("challenge_hash");--> statement-breakpoint

CREATE UNIQUE INDEX "api_tokens_token_hash_unique" ON "api_tokens" USING btree ("token_hash");
