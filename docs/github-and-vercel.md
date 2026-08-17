# GitHub and Vercel

How this repo is hosted. Update this file when the project name, domain, or env matrix changes.

## GitHub

| | |
| --- | --- |
| Repo | [rwcourson/precon-data-collection](https://github.com/rwcourson/precon-data-collection) (private) |
| Default branch | `master` |
| Production URL | https://precon-data.magnus.brasfieldgorrie.app |

### Actions

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every pull request and on push to `master` / `main`.

| Job | Runner | What it proves |
| --- | --- | --- |
| `web` | Ubuntu | `db:migrate:check`, `contract:check`, `security:check`, `perf:check`, `release:check`, `docs:check`, `verify:web` (build + typecheck + lint + test + isolated smoke) |
| `expo` | Ubuntu | Mobile typecheck / tests / bundle |
| `ios` | macOS, **push only** | Native iOS verify |

`verify:web` needs Playwright Chromium (`npx playwright install --with-deps chromium` in CI) and demo PGlite env (`APP_ENV=demo`, `AUTH_MODE=demo`, `DATABASE_MODE=pglite`).

Do not skip hooks on commits. Do not force-push `master`.

### What belongs in git

Commit app source, `drizzle/*.sql`, `docs/`, `.env.example`, `.env.development` (modes only). Never commit `.env.local`, `.vercel/`, `.pglite/`, `.eve/`, `.supergoal/`, or Smartsheet dumps.

## Vercel

| | |
| --- | --- |
| Team | `brasfieldgorrie` (`team_F2jIBe8T2jXoqzaMfI6DRhZ4`) |
| Project | `precon-data` (`prj_YCBuzZGkGtWtckvdwyeSVpu6TDDz`) |
| Framework | Next.js |
| Production domain | `precon-data.magnus.brasfieldgorrie.app` |
| Alias | `precon-data-prod.magnus.brasfieldgorrie.app` |
| Git production | `precon-data-git-master.magnus.brasfieldgorrie.app` |
| Node on Vercel | **24.x** (local / CI use Node 22 per `package.json` `engines`) |

Git integration deploys `master` to Production and every other branch to Preview. Do not run `vercel --prod` unless you intend to skip the PR.

```bash
npx vercel ls --scope brasfieldgorrie
npx vercel env ls --scope brasfieldgorrie
npx vercel cron ls
```

### Eve on Vercel

`withEve()` starts a sibling Eve process during **`next dev`**. Vercel serverless does not run that sibling. `/copilot` probes `/eve/v1/health` and falls back to Magnus (`/api/v1/ai/magnus`) when Eve is down. That is expected in production until Eve has a durable host.

HMAC for `/api/v1/copilot/tools` uses `BETTER_AUTH_SECRET` (then `AI_GATEWAY_API_KEY`). Both exist on Production.

### Cron jobs

Declared in [`vercel.json`](../vercel.json). Vercel invokes them with **GET** and `Authorization: Bearer $CRON_SECRET`. `CRON_SECRET` must stay set on Production (32+ characters).

| Path | Schedule (UTC) | Why |
| --- | --- | --- |
| `/api/jobs/distribution` | `0 * * * *` | Hourly so Friday/Monday 8am America/Chicago schedules fire; `periodKey` is idempotent |
| `/api/jobs/reminders` | `0 13 * * 1-5` | Weekday 8am Chicago (CDT) |
| `/api/jobs/salesforce-sync` | `15 11 * * *` | Daily incremental inbox sweep |
| `/api/jobs/snapshots` | `0 8 * * 0` | Weekly recovery snapshot |

`/api/jobs/databricks-sync` GET is **preview-only**. Do not put a mutating Databricks write on Vercel Cron while `DATABRICKS_ALLOW_WRITE` is false.

### Environment matrix

Names only — values live in the Vercel dashboard. Production has the live set. Preview is **not** a full clone of Production.

| Variable | Production | Preview | Development (Vercel) | Local |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | yes | yes | yes | `.env.local` or PGlite |
| `DATABASE_MODE` | yes | — | yes | `.env.development` = `pglite` |
| `AUTH_MODE` | yes (`sso`) | — | yes | `demo` |
| `APP_ORIGIN` / `ALLOWED_ORIGINS` / `BETTER_AUTH_URL` | yes | — | yes | localhost |
| `BETTER_AUTH_SECRET` + Microsoft Entra trio | yes | — | yes | optional |
| `CRON_SECRET` | yes | — | — | unused in demo |
| `AI_GATEWAY_API_KEY` / `AI_MODEL` | yes | yes | yes | `.env.local` |
| `EMAIL_MODE` | yes (`stub` until Resend) | — | yes | stub |
| `RESEND_API_KEY` / `EMAIL_FROM` | **not set** | — | — | stub outbox |
| `PRIVATE_STORAGE_MODE` | yes | — | yes | `local` |
| `BLOB_READ_WRITE_TOKEN` | **not set** | — | — | local disk |
| `CONNECT_MODE` / `SMARTSHEET_MODE` / `DATABRICKS_MODE` | yes | — | yes | mock / disabled |
| `DATABRICKS_*` + `DATABRICKS_ALLOW_WRITE` | yes (write stays false) | yes | yes | disabled |

Gaps to close before treating Preview as a login-able demo:

1. Copy `AUTH_MODE`, `APP_ORIGIN`, `ALLOWED_ORIGINS`, `BETTER_AUTH_*`, and Microsoft vars to **Preview** (or Preview stays a broken SSO redirect).
2. Add Entra redirect URIs for `https://precon-data-git-<branch>.magnus.brasfieldgorrie.app/api/auth/callback/microsoft`.
3. Add `RESEND_API_KEY` + `EMAIL_FROM` when scheduled report mail should leave the outbox.
4. Add `BLOB_READ_WRITE_TOKEN` and set `PRIVATE_STORAGE_MODE=vercel-blob` when note attachments must survive serverless.

Neon marketplace vars (`POSTGRES_*`, `PGHOST`, …) are present on all three environments. App code reads `DATABASE_URL` / `DATABASE_URL_UNPOOLED`.

### Migrations on deploy

`npm run db:migrate:deploy` applies `drizzle/` against `DATABASE_URL_UNPOOLED` when `APP_ENV=production`. Preview/production deploys that skip this leave new tables (notes, visibility, prefs, schedules) missing. After merging schema work, run migrate against the unpooled URL before the first request that touches those tables.

```bash
APP_ENV=production DATABASE_URL_UNPOOLED=… npm run db:migrate:deploy
```

### Pulling env locally

```bash
npx vercel env pull .env.local --scope brasfieldgorrie
```

`.env.local` wins over `.env.development`. Do not run `npm run db:reset` against a shell that still has Neon URLs if you meant to keep hosted data — demo bootstrap wipes **PGlite only**, but it is easy to confuse which database `next dev` will open. `npm run db:status` first.
