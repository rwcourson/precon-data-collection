# GitHub and Vercel

How this repo is hosted. Update this file when the project name, domain, or env matrix changes.

## GitHub

| | |
| --- | --- |
| Repo | [rwcourson/precon-data-collection](https://github.com/rwcourson/precon-data-collection) (public — made public 2026-08-20 so Actions runs on the free tier; a transfer to the `BG-Innovation` org awaits an org owner since members cannot create repos there) |
| Default branch | `master` |
| Production URL | https://precon-data.magnus.brasfieldgorrie.app |

### Actions

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every pull request and on push to `master` / `main`.

| Job | Runner | What it proves |
| --- | --- | --- |
| `web` | Ubuntu | `db:migrate:check`, `contract:check`, `security:check`, `perf:check`, `release:check`, `docs:check`, `verify:web` (build + typecheck + lint + test + isolated smoke) on PGlite |
| `web-postgres` | Ubuntu + `postgres:17` service | Full vitest suite against real Postgres (`TEST_DATABASE_URL`) |
| `expo` | Ubuntu | Mobile typecheck / tests / bundle |
| `ios` | macOS, **push to `master`/`main` only** | Native iOS verify |

`verify:web` needs Playwright Chromium (`pnpm exec playwright install --with-deps chromium` in CI) and demo PGlite env (`APP_ENV=demo`, `AUTH_MODE=demo`, `DATABASE_MODE=pglite`). CI installs with `pnpm install --frozen-lockfile` (lockfile is `pnpm-lock.yaml`; `packageManager` is `pnpm@11.22.0`). Lint is Biome (`pnpm lint` / `pnpm run lint`), not ESLint.

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
| Node on Vercel | Project setting is **24.x**, but `package.json` `engines` (`>=22 <23`) **wins** — deploys run **22.x**. Local / CI also use 22. |

Git integration deploys `master` to Production and every other branch to Preview. Do not run `vercel --prod` unless you intend to skip the PR.

```bash
npx vercel ls --scope brasfieldgorrie
npx vercel env ls --scope brasfieldgorrie
npx vercel cron ls
```

### Preview deploys and Git author

Vercel Git deploys **BLOCK** when the commit author email does not map to a GitHub user who is on the `brasfieldgorrie` team ([collaboration troubleshooting](https://vercel.com/docs/deployments/troubleshoot-project-collaboration#account-configuration)). Workstation hostname emails such as `rcourson@bgm-….brasfieldgorrie.com` do this. Use a GitHub-linked author, for example:

```bash
git commit --author="rwcourson <308136783+rwcourson@users.noreply.github.com>"
```

A team member can also approve the blocked deployment in the Vercel inspector. `npx vercel` (no `--prod`) creates a Preview as the logged-in CLI user and skips that Git-author check.

### Vercel Authentication

Project SSO protection is **on** for `all_except_custom_domains`. `*.vercel.app` inspector URLs require a Brasfield & Gorrie Vercel login. Custom domains on `magnus.brasfieldgorrie.app` do not — they use the app’s Entra SSO (`AUTH_MODE=sso`) on Production.

### Eve on Vercel

`withEve()` starts a sibling Eve process during **`next dev`**. `next.config.ts` skips that wrapper when `VERCEL` is set so the deploy stays `next build` (Eve 0.38 requires Node >=24; this app’s engines pin 22). `/copilot` probes `/eve/v1/health` and falls back to Magnus (`/api/v1/ai/magnus`) when Eve is down. That is expected in production until Eve has a durable host.

HMAC for `/api/v1/copilot/tools` derives a dedicated signing key from `BETTER_AUTH_SECRET` (then `AI_GATEWAY_API_KEY`) with the `copilot-tools-v1` label, and signs the timestamp + principal + tool + body hash (120 s replay window; see [magnus-api.md](magnus-api.md)). Both secrets exist on Production.

### PDF exports on Vercel

`src/lib/pdf.ts` launches headless Chromium for real `application/pdf` downloads. Locally that is dev-dependency Playwright; on Vercel it is `playwright-core` + `@sparticuz/chromium` (a Linux Chromium build shipped inside the function bundle — no extra env vars). If Chromium fails to launch, exports degrade to print-ready HTML and log the launch error once per instance. Export routes set `maxDuration` (60–120 s) via route segment config.

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
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | yes | yes (Neon **branch**, not Production) | yes | `.env.local` or PGlite |
| `PRODUCTION_DATABASE_URL` | — | yes (comparison only; must differ from Preview `DATABASE_URL`) | — | unused |
| `DATABASE_MODE` | yes | yes (`postgres`) | yes | `.env.development` = `pglite` |
| `AUTH_MODE` | yes (`sso`) | yes (`demo`) | yes | `.env.development` = `demo`; `.env.local` may pull `sso` |
| `APP_ENV` | yes | yes (`demo`) | yes | `.env.development` = `demo`; `.env.local` may pull `local` |
| `APP_ORIGIN` / `ALLOWED_ORIGINS` / `BETTER_AUTH_URL` | yes | derived from `VERCEL_BRANCH_URL` when unset | yes | localhost |
| `BETTER_AUTH_SECRET` + Microsoft Entra trio | yes | — | yes | optional |
| `CRON_SECRET` | yes | — | — | unused in demo |
| `AI_GATEWAY_API_KEY` / `AI_MODEL` | yes | yes | yes | `.env.local` |
| `EMAIL_MODE` | yes (`stub` until Resend) | yes (`stub`) | yes | stub |
| `RESEND_API_KEY` / `EMAIL_FROM` | **not set** | — | — | stub outbox |
| `PRIVATE_STORAGE_MODE` | yes (`vercel-blob`) | yes (`local`) | yes | `local` |
| `BLOB_READ_WRITE_TOKEN` | yes | yes | yes | local disk |
| `CONNECT_MODE` / `SMARTSHEET_MODE` / `DATABRICKS_MODE` | yes | yes (mock / disabled) | yes | mock / disabled |
| `API_TOKEN_MAX_TTL_DAYS` | yes | yes (`90`) | yes | `90` |
| `DATABRICKS_*` + `DATABRICKS_ALLOW_WRITE` | yes (write stays false) | yes | yes | disabled |

Preview uses **demo personas + a Neon branch isolated from Production** (`APP_ENV=demo`, `AUTH_MODE=demo`, `DATABASE_MODE=postgres`, `PRODUCTION_DATABASE_URL` set for the isolation check). Production stays Entra SSO. `APP_ORIGIN` / `ALLOWED_ORIGINS` are derived from `VERCEL_BRANCH_URL` when unset so each branch alias works without a per-branch env row.

Gaps still open:

1. Add Entra redirect URIs and copy Microsoft / `BETTER_AUTH_*` to Preview only if Preview should use SSO instead of personas.
2. Add `RESEND_API_KEY` + `EMAIL_FROM` when scheduled report mail should leave the outbox.

Blob is provisioned (2026-08-20): private store `precon-data-artifacts` (`store_8GkmizxOsVzkjcaf`, iad1) is linked to the project. `BLOB_READ_WRITE_TOKEN` exists on all three environments and Production runs `PRIVATE_STORAGE_MODE=vercel-blob` (`@vercel/blob` is a direct dependency; private put/get live in `src/lib/artifact-storage.ts`).

Neon marketplace vars (`POSTGRES_*`, `PGHOST`, …) are present on all three environments. App code reads `DATABASE_URL` / `DATABASE_URL_UNPOOLED`.

### Migrations on deploy

`pnpm run db:migrate:deploy` applies `drizzle/` against `DATABASE_URL_UNPOOLED` when `APP_ENV=production`. Preview/production deploys that skip this leave new tables (notes, visibility, prefs, schedules) missing. After merging schema work, run migrate against the unpooled URL before the first request that touches those tables.

```bash
APP_ENV=production DATABASE_URL_UNPOOLED=… pnpm run db:migrate:deploy
```

### Pulling env locally

```bash
npx vercel env pull .env.local --scope brasfieldgorrie
```

`.env.local` wins over `.env.development`. After a pull, rewrite local origins so Microsoft OAuth does not send the callback to production or to a port `next dev` is not using:

```
APP_ORIGIN=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001
```

Local Better Auth also follows the browser Host for loopback ports, so a leftover `:3001` URL is not fatal when the app is on `:3000`. Do not run `pnpm run db:reset` against a shell that still has Neon URLs if you meant to keep hosted data — demo bootstrap wipes **PGlite only**, but it is easy to confuse which database `next dev` will open. `pnpm run db:status` first.
