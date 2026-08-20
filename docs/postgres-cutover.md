# Postgres cutover (PGlite → hosted Postgres)

When `DATABASE_URL` is set, the app uses Neon/Postgres via `postgres.js`
(`prepare: false` for the pooler). Without it, local PGlite is the fallback.

## Commands

```bash
# Load Neon URLs into the shell, then:
npx drizzle-kit migrate          # apply drizzle/ migrations (prefer UNPOOLED URL)
pnpm run db:seed                 # demo personas + sample rounds
```

Prefer `DATABASE_URL_UNPOOLED` for migrate/push. App runtime uses the pooled
`DATABASE_URL`.

Prefer `pnpm run db:migrate:deploy` in production (`APP_ENV=production` + unpooled URL + advisory lock). Do not import `server-only` services from raw `tsx` seed scripts.

CI also runs the full vitest suite against a real `postgres:17` service (`web-postgres` job, `TEST_DATABASE_URL`). Locally, optional:

```bash
docker compose up -d --wait
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres pnpm test
```

If port 5432 is already in use, run a throwaway `postgres:17-alpine` on another loopback port (for example `127.0.0.1:55432`) and point `TEST_DATABASE_URL` at that container. Never pass Production `DATABASE_URL` to Vitest.

Without `TEST_DATABASE_URL`, `pnpm test` stays on throwaway PGlite.

Hosting and the Vercel env matrix: [github-and-vercel.md](github-and-vercel.md).

## Checklist

- [x] Hosted Postgres (Neon) + `DATABASE_URL` / `DATABASE_URL_UNPOOLED` on Vercel
- [x] Microsoft Entra SSO on **Production** (`AUTH_MODE=sso`)
- [x] `CRON_SECRET` on Production; cron paths declared in `vercel.json`
- [x] AI Gateway key on Production / Preview / Development
- [ ] Preview env SSO parity (Entra + `APP_ORIGIN` + Better Auth URL)
- [ ] Object storage for note attachments / snapshots (`vercel-blob`)
- [ ] SMTP / Resend (`RESEND_API_KEY`, `EMAIL_FROM`) — schedules write the outbox today
- [ ] Salesforce / Connect REST (`CONNECT_MODE=rest`, `CONNECT_API_URL`)
- [ ] Databricks write-back (`DATABRICKS_ALLOW_WRITE` stays false)
