# B&G Precon — Pursuits & Data

In-house web app for Precon **project data collection**: the bid schedule, post-bid yellow-field capture, a Salesforce link when the job number exists, and the summary numbers Lucy already publishes.

The shipped V1 baseline is the working Smartsheet process on the web. The
[Aug. 19 RPD Roundtable contract](docs/rpd-roundtable-product-contract.md)
governs work after that baseline. Same-data Gantt, lock revisions, and
locked-only Databricks publication are in the tree behind rollout flags and
are not treated as permanent exclusions. Lowery's staffing/equipment/rates
app remains a separate product. Smartsheet stays readable until a reconciled
history dump is signed off.

Default identity is **Brian Meyers**, Central RPD.

**Live:** https://precon-data.magnus.brasfieldgorrie.app · **Repo:** [rwcourson/precon-data-collection](https://github.com/rwcourson/precon-data-collection) (public) · **Docs index:** [docs/README.md](docs/README.md)

## What V1 is

1. **Bid schedule** — Upcoming / Active / Outstanding. Owner, Drawings Due, Bid Review, Bid Date, Procurement, Design Delivery, Bid Amount. Instant status moves. Multiple estimate rounds on one job. Hierarchical region → market filter. Server-persisted column prefs.
2. **Post-bid capture** — Required (yellow) blanks block RPD lock and name the missing labels. Optional and region-custom columns (Central tab) do not. Destini-sourced fields are badged.
3. **Company systems** — Salesforce / Connect lookup first. **No job number yet (ROM)** creates an unlinked `TBD-…` record. Staged match inbox. Databricks feed is built; write-back is off.
4. **Visualization** — Region / Division / Corporate dashboards, including a seeded Standard set. **Default = one latest/final round per job** so pricing rounds are not summed. Power BI stays for DMs; numbers must match.
5. **Effort notes** — Chat on the pricing effort (`@[userId]` mentions, 25 MB attachments). Not project-level, not private.
6. **Staffing** — Lives on the **estimate round**, not the job overview. Estimate lead plus Concept / DD / CD people on `/rounds/[id]`. Explicit “team assigned” mark. Overview **Needs staffing** = Upcoming + unstaffed in your scope. Job **Who can see this** is region visibility only.
7. **Copilot** — `/copilot` (Eve locally; Magnus fallback on Vercel). Tools are Principal-scoped. Threads persist per user in the browser. PCM/lead chrome hides Copilot.

**V1 demo nav (historical):** Overview, Bid Schedule, Post-Bid, Dashboards, Reports. Sheets / Studio / Forecast / DMR / Copilot live under **More**. After Aug. 19, PCM and estimate lead see Overview, Bid Schedule, and Post-Bid only (`roleChrome`). Dashboards/Reports/Copilot stay in RPD/admin Tools and More.

Canonical post–Aug. 19 requirements and Phases 0–16:
[docs/rpd-roundtable-product-contract.md](docs/rpd-roundtable-product-contract.md).
Shipped Jay-meeting upgrades:
[docs/jay-mcdaniel-upgrades.md](docs/jay-mcdaniel-upgrades.md). GitHub Actions
+ Vercel env/crons:
[docs/github-and-vercel.md](docs/github-and-vercel.md). Open legacy V1 items:
[docs/V1-REMAINING-QUESTIONS.md](docs/V1-REMAINING-QUESTIONS.md).

## Quick start

### Full data (recommended — Neon)

Hosted Neon holds the Smartsheet import. With `DATABASE_MODE=postgres` and Neon URLs in `.env.local`:

```bash
pnpm install
pnpm run db:status   # should show ~600+ jobs / ~1000+ rounds / sheets
pnpm run dev         # http://localhost:3000 against Neon
```

Do **not** run `pnpm run db:reset` if you want this dataset — that rebuilds the small synthetic demo on local PGlite and never writes Neon.

After pulling a fresh Smartsheet export (`pnpm smartsheet:pull`), `pnpm smartsheet:dump-counts` checksums the gitignored JSON with the same parser as import. `pnpm run db:import-smartsheet` maps **Owner**, **Drawings Due Date**, and **Bid Review Date** through the shipped parser (`src/lib/integrations/smartsheet/parse.ts`). The dump helper never flips `SMARTSHEET_MODE`.

### Synthetic demo only (offline PGlite)

```bash
pnpm install
pnpm run db:reset    # wipe .pglite/data + demo seed (default user: Brian Meyers)
pnpm run dev         # requires DATABASE_MODE=pglite (see .env.development)
```

Stop `next dev` before `db:reset` or `next build` — the build deletes `.next/dev`.

### Full offline rebuild from Smartsheet export

```bash
pnpm run db:bootstrap:smartsheet   # → .pglite/data-full
# then point .env.local at PGLITE_DATA_DIR=.pglite/data-full + DATABASE_MODE=pglite
```

## The 12-minute demo

Start as Brian Meyers in the **Central** workspace. Do not lead with New Pursuit or Admin.

1. Bid schedule — real columns, group by sector or division, open the region → market filter (Georgia is one click or three).
2. Open an upcoming round → **Notes** tab; post a mention. Show the bell deep link.
3. Overview **Needs staffing** → mark team assigned → the count drops.
4. Submit → post-bid. Lock blocked on blanks; Central extras sit on their own tab and do not block. Lock a complete row.
5. Change **Outcome** after lock. Audit line appears.
6. Print the consolidated Central bid schedule PDF (latest note wraps on the right).
7. Dashboards — Standard set is read-only. Open a Studio canvas and Export PPTX (B&G deck of the widgets, not the forecast file). Reports → run a report (results are full width) and Email schedules (Friday 8am).
8. `/copilot` — “Which upcoming efforts in my region have no team assigned?” Tables show Job Number / Status, not raw keys. Open **Recent** to resume a prior thread.

Salesforce-first New Pursuit is there if asked. Manual tab is **No job number yet (ROM)**. Duplicate names warn; **Show in my region instead** adopts visibility instead of creating a fourth Auburn.

## What's real vs. mocked

| Real | Mocked / deferred |
| --- | --- |
| Postgres schema (jobs → estimate rounds), Owner + operational dates, field dictionary | Live Salesforce/Connect (seeded mirror; adapter ready) |
| Status state machine + lock gate labels | Destini autofill (CSV import + badges; no unique final-phase tag yet) |
| Latest-round-per-job leadership rollups | Native mobile (responsive web; iOS/Expo exist but are not V1) |
| RBAC kernel, Region workspaces, multi-region visibility | Microsoft Entra SSO locally (`AUTH_MODE=demo` uses Brian Meyers) |
| Post-lock outcome + audit; current `finalizeRound()` lock seam | Versioned lock revisions and live locked-only warehouse publication (planned Phases 10/15; `DATABRICKS_ALLOW_WRITE` stays false today) |
| PDF + Excel exports, latest-note column, Standard dashboards | Live SMTP (outbox until Resend); Eve sibling (Magnus on Vercel) |

## Production configuration

Every integration has a live path guarded by an environment variable; unset, it falls back to something reviewable rather than something broken. Full matrix: [docs/github-and-vercel.md](docs/github-and-vercel.md). Placeholders live in `.env.example`.

| Variable | Effect |
| --- | --- |
| `AUTH_MODE=sso` | Microsoft Entra via Better Auth (`/sign-in`). |
| `CONNECT_MODE=rest`, `CONNECT_API_URL`, `CONNECT_API_TOKEN` | Live B&G Connect lookup. |
| `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`, `DATABRICKS_TABLE` | Current warehouse adapter configuration; write stays off. Phase 15 replaces it with reconciled, locked-only async publication before enablement. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Reminder / schedule emails send; otherwise they queue to the outbox. |
| `CRON_SECRET` | Required as a bearer token on reminder / distribution / sync / snapshot routes. Vercel Cron sends it automatically. |
| `AI_GATEWAY_API_KEY`, `AI_MODEL` | Magnus + Eve tool loop via Vercel AI Gateway. |
| `PRIVATE_STORAGE_MODE=vercel-blob`, `BLOB_READ_WRITE_TOKEN` | Note attachments and report artifacts in Blob. Local disk otherwise. |
| `APP_ORIGIN` | Public origin for Better Auth, Eve tool callbacks, and cookies. |

## Smoke tests

```bash
pnpm test                 # unit + integration (PGlite)
pnpm run docs:check
pnpm run db:migrate:check
pnpm run smoke:isolated   # isolated production server + Playwright
pnpm run verify:web       # build + typecheck + lint + test + isolated smoke
pnpm run verify:all       # web + Expo + iOS
```

Optional real-Postgres suite (same tests as CI's `web-postgres` lane):

```bash
docker compose up -d --wait
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres pnpm test
```

Keep `pnpm test` without `TEST_DATABASE_URL` for the zero-setup PGlite default.

Run `pnpm run typecheck` **after** `pnpm run build` on a clean tree (Next 16 generates `LayoutProps`).

## Stack

Next.js 16.3 (App Router) · React 19 · TypeScript · Drizzle ORM + PGlite / Neon · Tailwind 4 + shadcn/ui · Better Auth · AI SDK 7 · Eve (`withEve`) · ExcelJS · pnpm workspace (`apps/mobile`) · Biome

See [apps/ios/README.md](apps/ios/README.md) for the native client (same `/api/v1/mobile`). It is not part of the V1 leadership demo.

## Toolchain

| Piece | Command / layout |
| --- | --- |
| Package manager | pnpm 11.22.0 workspace: root + `apps/mobile` (`pnpm-workspace.yaml`, `node-linker=hoisted` in `.npmrc`) |
| Lint / format | `pnpm run lint` → `biome check .`; `pnpm run fix` → `biome check --write .` |
| Tests (default) | `pnpm test` on throwaway PGlite |
| Tests (real Postgres) | `TEST_DATABASE_URL=… pnpm test` (CI job `web-postgres`; local `docker compose up -d --wait`) |
| Install | `pnpm install` at repo root (one lockfile: `pnpm-lock.yaml`) |

## Eve copilot

The copilot is an Eve agent under `agent/` mounted with `withEve()` in `next.config.ts`. Local `next dev` starts Eve beside Next and rewrites `/eve/v1/*`. Tools do **not** open a second PGlite handle — they POST to `/api/v1/copilot/tools` with the caller’s Principal (HMAC + numeric user id). Never use Eve `localDev()` auth in this app.

Magnus (`/api/v1/ai/magnus` and mobile `/api/v1/mobile/copilot`) stays for API consumers and for Vercel, where the Eve sibling is not running. Both share `copilotQueryService`.

If you run Eve outside Next (`npx eve dev`), set `APP_ORIGIN` to the Next origin (for example `http://127.0.0.1:3010`) so tool calls and session auth can reach the app.

## Layout

- `src/lib/integrations/smartsheet/parse.ts` — shipped Smartsheet row mapping
- `src/lib/fields.ts` — field dictionary (Owner is optional / not a lock gate)
- `src/lib/rollup.ts` — `latestRoundsPerJob` / `applyLeadershipRoundScope`
- `src/lib/validation.ts` — `evaluateLockGate`
- `src/lib/authorization/` — kernel, loaders, visibility SQL
- `src/lib/demo-identity.ts` — default Central RPD **Brian Meyers**
- `docs/README.md` — documentation index
- `brand/` + `src/lib/brand/` — 2026 slideshow kit and PPTX theme
- `docs/generated-documents.md` — how generated decks stay on brand
