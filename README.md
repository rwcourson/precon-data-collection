# B&G Precon Data Collection — V1

In-house web app for Precon **project data collection**: the bid schedule, post-bid yellow-field capture, a Salesforce link when the job number exists, and the summary numbers Lucy already publishes.

This is **not** Jay’s Gantt, Lowery’s Precon App, Magnet Workforce, or a Salesforce replacement. Smartsheet stays the system of record through 2026. Target enterprise flip ~January 2027. This V1 is the November “we can run the Monday loop here” bar.

Default identity is **Brian Meyers**, Central RPD.

## What V1 is

1. **Bid schedule** — Upcoming / Active / Outstanding. Owner, Drawings Due, Bid Review, Bid Date, Procurement, Design Delivery, Bid Amount. Instant status moves. Multiple estimate rounds on one job.
2. **Post-bid capture** — Required (yellow) blanks block RPD lock and name the missing labels. Optional (light blue) does not. Destini-sourced fields are badged.
3. **Company systems** — Salesforce / Connect lookup first. **No job number yet (ROM)** creates an unlinked `TBD-…` record. Staged match inbox. Databricks feed is built; write-back is off.
4. **Visualization** — Region / Division / Corporate dashboards. **Default = one latest/final round per job** so pricing rounds are not summed. Power BI stays for DMs; numbers must match.

Primary nav: Overview, Bid Schedule, Post-Bid, Dashboards, Reports. Sheets / Studio / Forecast / DMR / Magnus live under **More**.

## Quick start

### Full data (recommended — Neon)

Hosted Neon holds the Smartsheet import. With `DATABASE_MODE=postgres` and Neon URLs in `.env.local`:

```bash
npm install
npm run db:status   # should show ~600+ jobs / ~1000+ rounds / sheets
npm run dev         # http://localhost:3000 against Neon
```

Do **not** run `npm run db:reset` if you want this dataset — that rebuilds the small synthetic demo on local PGlite and never writes Neon.

After pulling a fresh Smartsheet export, `npm run db:import-smartsheet` maps **Owner**, **Drawings Due Date**, and **Bid Review Date** through the shipped parser (`src/lib/integrations/smartsheet/parse.ts`).

### Synthetic demo only (offline PGlite)

```bash
npm install
npm run db:reset    # wipe .pglite/data + demo seed (default user: Brian Meyers)
npm run dev         # requires DATABASE_MODE=pglite (see .env.development)
```

### Full offline rebuild from Smartsheet export

```bash
npm run db:bootstrap:smartsheet   # → .pglite/data-full
# then point .env.local at PGLITE_DATA_DIR=.pglite/data-full + DATABASE_MODE=pglite
```

## The 12-minute demo

Start as Brian Meyers in the **Central** workspace. Do not lead with New Pursuit or Admin.

1. Bid schedule — real columns, group by sector or division, move a row between buckets.
2. Add a second estimate round on a job they know.
3. Submit → post-bid. Lock blocked on blanks; lock a complete row.
4. Change **Outcome** after lock. Audit line appears.
5. Print the consolidated Central bid schedule PDF.
6. Dashboards — expected fee vs back-page fee, latest-round default. Say: Power BI stays.

Salesforce-first New Pursuit is there if asked. Manual tab is **No job number yet (ROM)**.

Open items to take to Brian, Keller, Lucy, and Eric: [docs/V1-REMAINING-QUESTIONS.md](docs/V1-REMAINING-QUESTIONS.md).

## What's real vs. mocked

| Real | Mocked / deferred |
| --- | --- |
| Postgres schema (jobs → estimate rounds), Owner + operational dates, field dictionary | Live Salesforce/Connect (seeded mirror; adapter ready) |
| Status state machine + lock gate labels | Destini autofill (CSV import + badges; no unique final-phase tag yet) |
| Latest-round-per-job leadership rollups | Native mobile (responsive web; iOS/Expo exist but are not V1) |
| RBAC, Region workspaces | Microsoft Entra SSO (`AUTH_MODE=demo` uses Brian Meyers) |
| Post-lock outcome + audit | Live warehouse write (`DATABRICKS_ALLOW_WRITE` stays false) |
| PDF + Excel exports, consolidated regional preset | Live SMTP (outbox until Resend) |

## Production configuration

Every integration has a live path guarded by an environment variable; unset, it falls back to something reviewable rather than something broken.

| Variable | Effect |
| --- | --- |
| `AUTH_MODE=sso` | Microsoft Entra via Better Auth (`/sign-in`). |
| `CONNECT_MODE=rest`, `CONNECT_API_URL`, `CONNECT_API_TOKEN` | Live B&G Connect lookup. |
| `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`, `DATABRICKS_TABLE` | Warehouse feed builds for real; write stays off unless IT sets allow-write. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Reminder emails send; otherwise they queue to the outbox. |
| `CRON_SECRET` | Required as a bearer token on reminder / databricks-sync routes. |

## Smoke tests

With the dev server running on port 3000:

```bash
npm test                 # shipped parse, lock gate, latest-round, four-core
npm run smoke            # end-to-end walkthrough
npm run smoke:isolated   # isolated server + smoke
npm run smoke:approval   # RPD approve/lock + audit
npm run docs:check
npm run verify:web       # build + typecheck + lint + test + isolated smoke
```

## Stack

Next.js 16 (App Router) · TypeScript · Drizzle ORM + PGlite / Neon · Tailwind 4 + shadcn/ui · ExcelJS

See [apps/ios/README.md](apps/ios/README.md) for the native client (same `/api/v1/mobile`). It is not part of the V1 leadership demo.

## Layout

- `src/lib/integrations/smartsheet/parse.ts` — shipped Smartsheet row mapping
- `src/lib/fields.ts` — field dictionary (Owner is optional / not a lock gate)
- `src/lib/rollup.ts` — `latestRoundsPerJob` / `applyLeadershipRoundScope`
- `src/lib/validation.ts` — `evaluateLockGate`
- `src/lib/demo-identity.ts` — default Central RPD **Brian Meyers**
- `docs/V1-REMAINING-QUESTIONS.md` — team feedback list
