# Postgres cutover (PGlite → hosted Postgres)

PGlite is demo-local only. Production should use hosted Postgres with PITR.

## Adapter readiness

1. Set `DATABASE_URL=postgres://...` (Drizzle already targets Postgres dialect).
2. Replace the PGlite client bootstrap in `src/db` with `postgres.js` / `pg` pool
   when `DATABASE_URL` is present; keep PGlite as the local fallback.
3. Run `npm run db:push` (or migrate journal once introduced) against the target.
4. Seed only non-production environments.
5. Point snapshot storage at private object storage (S3/R2) — local adapter writes
   `.data/snapshots/` today (`src/lib/recovery.ts`).
6. Configure cron with `CRON_SECRET`:
   - `POST /api/jobs/reminders`
   - `POST /api/jobs/distribution`
   - `POST /api/jobs/salesforce-sync`
   - `POST /api/jobs/snapshots`
   - `POST /api/jobs/databricks-sync`

## Checklist

- [ ] Hosted Postgres + credentials from IT
- [ ] Object storage for PDFs/snapshots
- [ ] SMTP / Resend (`RESEND_API_KEY`, `EMAIL_FROM`)
- [ ] Salesforce / Connect REST (`CONNECT_MODE=rest`, `CONNECT_API_URL`)
- [ ] Databricks warehouse credentials
- [ ] SSO headers (`AUTH_MODE=sso`) including SPD→RPD group map
