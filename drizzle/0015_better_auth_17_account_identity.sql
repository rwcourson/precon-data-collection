-- Better Auth 1.7: accounts are identified by (issuer, accountId).
-- Microsoft now uses the directory `oid` claim instead of pairwise `sub`.
-- Backfill from stored id_tokens; drop Microsoft rows we cannot migrate so
-- the next sign-in creates a clean oid-keyed account (email join is unchanged).

CREATE OR REPLACE FUNCTION precon_jwt_payload(token text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  payload text;
  padded text;
  json_text text;
BEGIN
  IF token IS NULL OR position('.' in token) = 0 THEN
    RETURN NULL;
  END IF;
  payload := split_part(token, '.', 2);
  IF payload IS NULL OR length(payload) < 8 THEN
    RETURN NULL;
  END IF;
  padded := replace(replace(payload, '-', '+'), '_', '/');
  WHILE length(padded) % 4 <> 0 LOOP
    padded := padded || '=';
  END LOOP;
  BEGIN
    json_text := convert_from(decode(padded, 'base64'), 'utf8');
    RETURN json_text::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;
--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "account"
SET
  "issuer" = COALESCE(precon_jwt_payload("id_token")->>'iss', "issuer"),
  "account_id" = CASE
    WHEN "provider_id" = 'microsoft'
      AND COALESCE(precon_jwt_payload("id_token")->>'oid', '') <> ''
      THEN precon_jwt_payload("id_token")->>'oid'
    ELSE "account_id"
  END
WHERE "id_token" IS NOT NULL AND "id_token" <> '';--> statement-breakpoint
DELETE FROM "account"
WHERE "provider_id" = 'microsoft'
  AND COALESCE(precon_jwt_payload("id_token")->>'oid', '') = '';--> statement-breakpoint
UPDATE "account"
SET "issuer" = 'local:oauth:' || replace("provider_id", '/', '%2F')
WHERE "issuer" IS NULL OR "issuer" = '';--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer", "account_id");--> statement-breakpoint
DROP FUNCTION IF EXISTS precon_jwt_payload(text);
