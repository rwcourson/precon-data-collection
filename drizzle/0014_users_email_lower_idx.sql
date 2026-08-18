-- SSO identity resolution looks users up by lower(email) on every session;
-- back that expression with an index.
CREATE INDEX IF NOT EXISTS "users_email_lower_idx" ON "users" (lower("email"));
