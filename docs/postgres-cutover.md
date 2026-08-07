# Postgres cutover (PGlite → hosted Postgres)

When `DATABASE_URL` is set, the app uses Neon/Postgres via `postgres.js`
(`prepare: false` for the pooler). Without it, local PGlite is the fallback.

## Commands

```bash
# Load Neon URLs into the shell, then:
npx drizzle-kit migrate          # apply drizzle/ migrations (prefer UNPOOLED URL)
npm run db:seed                  # demo personas + sample rounds
```

Prefer `DATABASE_URL_UNPOOLED` for migrate/push. App runtime uses the pooled
`DATABASE_URL`.

## Checklist

- [x] Hosted Postgres (Neon) + `DATABASE_URL` on Vercel
- [ ] Object storage for PDFs/snapshots
- [ ] SMTP / Resend (`RESEND_API_KEY`, `EMAIL_FROM`)
- [ ] Salesforce / Connect REST (`CONNECT_MODE=rest`, `CONNECT_API_URL`)
- [ ] Databricks warehouse credentials
- [ ] SSO headers (`AUTH_MODE=sso`) including SPD→RPD group map
- [ ] Cron with `CRON_SECRET` for reminders / SF sync / distribution / snapshots
