# B&G Precon Data Collection — Demo Prototype

A working, high-fidelity prototype of the in-house web application that replaces the
SmartSheet-based **Preconstruction Bid & Post-Bid Data Collection** system
("B&G Precon Pursuits and Data"), built from the *Precon Data Collection
Requirements 1.0* BRD.

Everything runs locally against an embedded Postgres (PGlite) with realistic seeded
data — no external services required. Integrations (Salesforce/Connect, SSO,
Destini) are convincingly mocked; everything else actually works.

## Quick start

### Full data (recommended — Neon)

Your hosted Neon database already holds the Smartsheet import and workspace
sheets. With `DATABASE_MODE=postgres` and Neon URLs in `.env.local`:

```bash
npm install
npm run db:status   # should show ~600+ jobs / ~1000+ rounds / sheets
npm run dev         # http://localhost:3000 against Neon
```

Do **not** run `npm run db:reset` if you want this dataset — that command only
rebuilds the **small synthetic demo** on local PGlite and never writes Neon.

### Synthetic demo only (offline PGlite)

```bash
npm install
npm run db:reset    # wipe .pglite/data + ~42 jobs / ~108 rounds demo seed
npm run dev         # requires DATABASE_MODE=pglite (see .env.development)
```

### Full offline rebuild from Smartsheet export

Source files live in `data/smartsheet/json` (47 sheets). Rebuild a local
PGlite copy without touching Neon:

```bash
npm run db:bootstrap:smartsheet   # → .pglite/data-full
# then point .env.local at PGLITE_DATA_DIR=.pglite/data-full + DATABASE_MODE=pglite
```

Reseed the **demo** store anytime with `npm run db:reset` (stop the dev server
first — PGlite is single-process).
## The demo story

Use the **role switcher** (top right) to walk the four-stage pipeline as each persona:

1. **Sarah Chen (PCM)** — Bid Schedule: browse Active / Upcoming / Outstanding,
   create a pursuit from the mocked B&G Connect lookup (or manually for a Quick ROM
   with no Salesforce job yet), add a second Estimate Round under the same Job Number.
2. **Marcus Webb (Estimate Lead)** — flip a round to *Submitted* (notification fires),
   then complete post-bid entry: required fields marked with `*`, dropdowns locked to
   managed reference lists, repeatable Self-Perform / Support Services fields,
   Destini-mapped fields badged, Rate Only conditional logic.
3. **Bryan Myers (RPD)** — try to Approve & Lock an incomplete record (blocked with
   the exact missing fields), approve a complete one, then make a post-lock
   correction and show the audit trail capturing who/what/old/new/when.
4. **Patricia Lawson (Leadership) / Tom Reeves (Corporate Admin)** — Dashboards:
   Division → Region → Corporate rollups, multi-year trends, calculated metrics
   (fee %, contingency %, fee per PM month, win rate) computed server-side.
5. **Tom Reeves (Corporate Admin)** — Admin: manage reference lists (retire values
   without touching historical records); **Bryan (RPD)** adds a Region-scoped custom
   column that instantly appears in exports and the report builder.
6. **Anyone** — Report Builder: cross-dataset fields + filters + grouping +
   aggregation, save/share reports, export Excel/PDF. Bid Schedule exports support
   column selection/ordering, grouping, sorting, headers/footers, and reusable
   saved templates.
7. **Anyone** — Sheets: the workspace people actually navigate, seeded with the
   real B&G folder tree from the Smartsheet export.

## Sheets

Smartsheet's shape is a workspace of folders and sheets, so that shape is kept —
with one change that removes the reason Regions drifted apart. A **pursuit view**
is a live slice of the estimate records: pick columns, filter, group, edit a cell
and the record itself changes, so two sheets can never disagree. A **standalone
sheet** is your own columns and rows for things that are not pursuits — a roster,
monthly cost tracking, an action list. Either can be created from scratch or by
**importing a .csv/.tsv/.xlsx**, where column types and values (dates, dollars,
checkboxes) are read from the file rather than retyped.

Sheets can be renamed, moved, duplicated, pinned to the sidebar, archived, and
restored; folders can be renamed in place. Archiving is reversible and lives in
an **Archived** section on `/sheets`, so clearing out a sheet mid-year is not a
one-way door.

Governance is read from the data, not just enforced on submit: `listSheets`
returns `canManage` per sheet, so a Preconstruction Manager never sees *Rename*
or *Archive* on a sheet that is not theirs, and a folder shows a rename control
only when they own something in it. The rename dialog states how many of the
folder's sheets will actually move.

`npm run db:seed-sheets` rebuilds just the sheet tree from the export without a
full re-import.

## What's real vs. mocked

| Real | Mocked / deferred |
| --- | --- |
| Postgres schema (jobs → estimate rounds one-to-many), full field dictionary | Salesforce/Connect data (seeded mirror behind a live-ready adapter) |
| Explicit status state machine with transition log | Destini / InEight autofill (manual entry, API-ready field mapping) |
| RBAC enforced in every server action, Region scoping enforced in SQL | Native mobile apps (responsive web instead) |
| Required-field validation gating RPD lock | An actual IdP (SSO reads forwarded identity; demo personas otherwise) |
| Post-lock audit logging, schema-change audit | A live warehouse (feed builds and pushes, credentials pending) |
| True PDF (headless Chromium) + Excel exports, saved templates | |
| Custom report engine over flattened cross-dataset rows | |
| Two-tier column governance (Corporate vs. RPD) with EAV custom columns | |
| Import review queue, reminder cadence, migration reconciliation | |
| Sheets workspace: live pursuit views + standalone grids, spreadsheet import, folder tree, archive/restore | |

## Production configuration

Every integration has a live path guarded by an environment variable; unset, it
falls back to something reviewable rather than something broken.

| Variable | Effect |
| --- | --- |
| `AUTH_MODE=sso` | Identity comes from the authenticating proxy instead of the demo persona cookie. `src/proxy.ts` returns 401 for requests that arrive without one. |
| `SSO_EMAIL_HEADER`, `SSO_NAME_HEADER`, `SSO_GROUPS_HEADER` | Override the forwarded header names. IdP group → role/Region mapping is edited in **Admin · Access**. |
| `CONNECT_MODE=rest`, `CONNECT_API_URL`, `CONNECT_API_TOKEN` | Pursuit lookup and match-and-merge read the live B&G Connect facade instead of the seeded mirror. |
| `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`, `DATABRICKS_TABLE` | The warehouse feed pushes for real; without them it builds and previews the payload. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Reminder emails send; otherwise they queue to a visible outbox. |
| `CRON_SECRET` | Required as a bearer token on `POST /api/jobs/reminders` and `POST /api/jobs/databricks-sync`. |

**Admin · Access** shows the current mode and group mappings, **Admin · Integrations**
runs the warehouse feed, and **Admin · Migration** reports per-year import
completeness, formula reproducibility, and the cutover checklist.

## Cutover and the status deliverable

Two sponsor decisions are wired into the app rather than kept in a document.
Every Smartsheet bid year migrates, so **Admin · Migration** names the sheets the
import actually read and calls out the years the supplied extract is missing.
Legacy values are accepted as history, so **Admin · Review** offers *Confirm
legacy baseline* — one action that closes every open flag in the active
workspace and leaves validation to apply from cutover forward. The review queue
is built by the importer itself (`syncDataQualityFlags`), so it exists as soon as
data lands.

`GET /api/export/status` renders the sponsor-facing **Status & Roadmap** PDF —
what is built, what is waiting on B&G IT, migration state, the cutover
checklist, and the questions still open with the business. Every figure is read
from the running system at request time, so the document cannot drift from the
app. Add `?format=html` to preview it in the browser; the button lives in
**Admin · Migration**.

## Smoke tests

With the dev server running on port 3000:

```bash
npm run smoke            # end-to-end demo walkthrough (home → bid schedule → post-bid → dashboards → reports → admin → mobile)
npm run smoke:approval   # focused RPD approve/lock + audit trail check
npm run audit:ui         # design-system audit across 16 routes × light/dark
```

Screenshots land in `.smoke-shots/` (gitignored).

## Controls

Buttons and badges come from `components/ui/button.tsx` and
`components/ui/badge.tsx`, and call sites pick a token rather than restating
its pixels. Button sizes are `xs | sm | default | lg` plus the matching
`icon-*`; badges are `default` (20px, `text-xs`) and `sm` (18px, `text-2xs`)
and are always pills — a rounded rectangle means someone overrode the
primitive. `text-2xs` (11px) is the one micro-label step below Tailwind's
`xs`; the app previously used 10px and 11px interchangeably for the same job.

Status colour is a variant, not a class string: `success`, `warning`, `info`,
`accent` and `teal` exist on `Badge`, and `success`, `warning`, `info` and
`accent` on `Alert`, so the "approved green" is defined once. `BadgeRemove` is
the dismiss control on a removable chip — it carries the accessible name and
focus ring that a bare `<button><X/></button>` does not.

`npm run audit:ui` enforces this against the running app. It derives the
expected pixel values from the live root font size (the app's root is 13/14px,
not 16px) and fails on any badge or button off the scale, any badge that is not
a pill, any button without an accessible name or an explicit `type`, and any
hand-rolled control with no `focus-visible` style. It reads `BASE_URL`, which
defaults to port 3000 — pass it explicitly if the dev server moved.

### Theming

Light and dark come from `components/theme-provider.tsx`. There is no React
state: `useTheme()` reads `localStorage["theme"]` and the OS preference through
`useSyncExternalStore`, so the `dark` class on `<html>` and what components
render cannot drift apart. `resolvedTheme` is `undefined` until hydration
because the server cannot know the OS preference — guard on it rather than
adding a `mounted` flag.

The anti-flash script is inlined into `<head>` from `app/layout.tsx` as a plain
string. Keep it there: this replaced `next-themes`, which rendered the same
script inside the component tree, and React 19 logs an error for any `<script>`
it meets during a client render.

## Stack

Next.js 16 (App Router) · TypeScript · Drizzle ORM + PGlite (embedded Postgres) ·
Tailwind 4 + shadcn/ui (Base UI) · Recharts · ExcelJS

## Layout

- `src/db/schema.ts` — full Drizzle schema (rounds, multi-values, reference lists, custom columns, audit, templates)
- `src/db/seed.ts` — deterministic realistic dataset generator
- `src/lib/fields.ts` — the BRD field dictionary, introspected by forms/exports/reports
- `src/lib/metrics.ts` — server-side calculated metrics, grouped by family
- `src/lib/permissions.ts` — RBAC role matrix + status state machine
- `src/lib/workspace.ts` — Region workspace resolution and scoping (Miro folder model)
- `src/lib/auth.ts` — identity seam: forwarded SSO headers → role/Region mapping
- `src/lib/integrations/connect` — B&G Connect lookup adapter (mirror or live REST)
- `src/lib/integrations/databricks` — field map, SQL client, outbound warehouse feed
- `src/lib/migration.ts` — import reconciliation and cutover checklist
- `src/lib/status-report.ts` — sponsor status & roadmap document, built from live state
- `src/lib/data-quality-sync.ts` — review-queue scan shared by the importer and the admin rescan
- `src/lib/report-engine.ts` — filter/group/aggregate engine behind the report builder and exports
- `src/actions/*` — server actions (pursuits, post-bid, admin, reports, templates, access, integrations)
- `src/app/*` — Bid Schedule, Post-Bid queue, round detail, dashboards, report builder, admin

## Native iOS (SwiftUI)

See [apps/ios/README.md](apps/ios/README.md) for the native Precon client (same `/api/v1/mobile` as Expo).
