# Jay McDaniel meeting upgrades

Shipped after the 2026-08-14 leadership conversation. These sit on top of V1. They do **not** replace Smartsheet as the 2026 system of record.

This page is the operator and engineer contract for everything that meeting asked to add now.

## Guardrails (do not regress)

- Notes attach to **pricing efforts** (`estimate_rounds`) only. No project-level notes.
- Notes are public to anyone who can read the round. No private / only-me notes.
- There is no spreadsheet-toggle. The app exists so 80 columns stay readable.
- Salesforce remains the official project PK. Duplicate create **warns**; it does not mint a second official-create path.
- `jobs.region` is the **home region** only. Access is the visibility union, not that column.

## What shipped

| Area | What you get | Where |
| --- | --- | --- |
| Authorization | One `authorize()` kernel; new capabilities registered | `src/lib/authorization/` |
| Visibility | Extra regions + person pins; Auburn-style duplicate warning | Job **Regions** editor; New Pursuit |
| Bid schedule | Region → market tree (`preconDepartment`); server column prefs | Filter popover; `?view=` / `?source=prefs` |
| Notes | Chat thread + attachments on the round | Round **Notes** tab |
| Mentions | `@[userId]` tokens, bell + deep link | Composer `@`; `/rounds/{id}?tab=notes&note=` |
| Staffing | Explicit team-assigned mark; Needs staffing queue | Overview card; `?queue=needs-staffing` |
| Print / reports | Latest note column; wrap CSS | Bid-schedule / upcoming presets |
| Post-bid | Region custom tab; ready vs awaiting chips | Post-bid queue; Central — Heavy Civil tab |
| Finalize | `finalizeRound()` lock-passthrough | [ADR 002](adr/002-post-bid-finalize-seam.md) |
| Dashboards | Seeded Standard set; duplicate to personal | Studio; Standard badge |
| Schedules | Owner Friday/Monday 8am mail; idempotent `periodKey` | Reports → Email schedules |
| Copilot | Eve agent + Principal tools; Magnus fallback | `/copilot` |

## Visibility

`jobs.region` is home only. Who sees a job is:

1. A `job_region_visibility` row whose region is in the principal’s `allowedRegions`, or
2. A `job_user_visibility` pin for that user, or
3. A see-all role in a corporate workspace.

SQL: `principalJobVisibilityPredicate`. Do **not** reuse `principalRegionPredicate` for jobs or rounds (that predicate is for sheets / dashboards / region-scoped admin).

- Directors toggle **only their own region** (`visibility.manage-region`).
- Corporate Admin pins people (`visibility.assign-user`).
- Home region cannot be removed. New pursuits stamp the **creator’s** home region, not the Salesforce house office.
- Duplicate create returns `{ kind: "duplicates" }`. Confirm with `confirmDuplicate: true` (tests use `requireCreatedPursuit()`).

Migrations: `drizzle/0007_job_visibility.sql`. Inserts get a home visibility row from a trigger — a job with zero visibility rows is invisible to regional principals.

## Bid schedule

Hierarchical filter is **`preconDepartment`**, not a Georgia special case. Empty selection = all visible rows. Selecting a region equals the union of its departments.

- Rows share one inset and vertical center. Status pills hug a tight column; lifecycle section labels stay sticky when you scroll. Bid Due badges wrap instead of clipping.
- Date cells use the themed `DatePicker` (popover calendar). Do not put `<input type="date">` back — the OS picker ignores the theme.
- URL: `regions`, `departments`. Saved views store config v2 (`src/lib/view-config.ts`); legacy JSONB still loads.
- Per-user show/hide, density, and widths live in `user_table_prefs`. A named view URL (`?view=`) wins. `?source=prefs` skips the starred default. Widths are **not** in `localStorage`.
- The filter trigger is a native `<button>` (`nativeButton={true}`).

## Notes and mentions

Chat-shaped history on the pricing effort: author, timestamp, edit marker, soft-delete, attachments.

- Body max **10,000** characters. Markup mentions are `@[userId]`, never a display-name string.
- Attachments: any file type, **25 MB** inclusive, server-enforced. Download: `GET /api/notes/attachments/:id` (kernel read on the parent round, `Content-Disposition: attachment`).
- Mentions notify only users who can **read** that round. Re-editing the same mention does not duplicate. Deep link: `/rounds/{id}?tab=notes&note={id}`.
- Composer is contenteditable chips (`NoteComposer`); storage stays `@[userId]`. The mention picker opens only after the first letter, ranks matches, and portals above the composer so it is not clipped.
- Notes live on the round **Notes** tab only. There is no bid-schedule row drawer.

## Staffing

`teamAssignedAt` / `teamAssignedById` on the round. Not inferred from Estimate Lead.

- Overview **Needs staffing** = Upcoming + unstaffed + the current hierarchy. Same row set as `/bid-schedule?section=upcoming&queue=needs-staffing` and the copilot `query_needs_staffing` tool.
- `staffing.mark` is denied for leadership. The button is hidden when the kernel denies.

## Reports, print, dashboards, schedules

- Custom Report Builder results sit **full width** under the saved-list + builder row. Job Name (and other long text) takes leftover column width; dollars/metrics are right-aligned (`src/lib/report-layout.ts`).
- Latest note for print/Excel is one `DISTINCT ON (round_id)` query (`round_notes_round_created_idx`). Soft-deletes excluded. Truncated at 300 characters. That query stays **off** the bid-schedule page hot path.
- Standard dashboards (corporate + one per Destini region) are read-only (`isStandard`). Studio does not expose Clone or Copilot in the header; `cloneDashboard` remains for the mobile API.
- Studio **Export PPTX** downloads that canvas (`GET /api/export/pptx?dashboardId=`). Forecast **Export PPTX** stays the volume-projection deck. Both use the 2026 B&G slideshow kit — see [generated-documents.md](generated-documents.md).
- Widget cards show title + metric subtitle only. Do not put chart-type badges (Donut, Horizontal Bar) back on the canvas.
- Report owners schedule weekday + hour (Jay’s Friday / Monday 8am). Delivery is idempotent per `periodKey`. HTML is rendered as the **owner**, with the same wrap CSS as print.
- Seed CLIs must not import `server-only` services. Demo standards are inserted from `allStandardDashboardDefs()` in `src/db/seed.ts`.

## Post-bid

Region custom columns (example: Central — Heavy Civil) render in their own tab and **never** block lock. Queue chips: ready-to-lock vs awaiting required fields, with missing labels.

The lock-vs-Databricks flip is `finalizeRound()` only — [ADR 002](adr/002-post-bid-finalize-seam.md).

## Copilot

Eve does **not** run inside Next request handlers. `withEve()` in `next.config.ts` starts a sibling process in `next dev` and rewrites `/eve/v1/*`.

Tools POST `/api/v1/copilot/tools` with HMAC + a **numeric** `x-eve-principal-id`. They do not open a second PGlite handle. Do not use Eve `localDev()` auth here — it produced `principalId: "local-dev"` and `users.id = NaN`.

| Tool | Answers |
| --- | --- |
| `query_needs_staffing` | Upcoming + unstaffed in scope |
| `query_efforts` | Visibility-scoped efforts |
| `search_notes` | Note hits with round citations |
| `person_history` | Estimate lead + staffing marks for a year |
| `plan_chart` | Chart spec for the canvas |

UI: `/copilot` — typography-only empty state, then rail + canvas. Assistant replies render markdown (`CopilotMarkdown`). Query tables use product column labels (`columnDisplayLabel`), not raw keys. `prefers-reduced-motion` disables the slide. If `/eve/v1/health` is not ok (typical on Vercel production), the page falls back to Magnus `useChat` over `/api/v1/ai/magnus`. Magnus stays for API and mobile and shares `copilotQueryService`.

Local Eve outside Next: `APP_ORIGIN=http://127.0.0.1:3010` (or whatever port Next is on). Ignore `.eve/` in git and eslint.

## Chrome

- ⌘K search palette is `sm:max-w-xl`.
- Collapsed-sidebar hover menus are compact (`p-1`, `py-1` items) so Dashboards → Corporate / Region / Division is a short list.
- Selects, command items, and mention rows share the same accent hover.
- Pass `items={[{ value, label }]}` to `Select` / `UrlSelect` whenever the stored value is an id or key — the trigger must show the name.
- Dollar and count fields use `NumericInput` so commas appear while typing; stored values stay numeric.
- Select and dropdown menus size to `--available-height` and wrap labels so they are not clipped.
- Job **Access** lists visibility regions and the team for those regions; people outside the selected regions sit under **Added individually**.

## File map

| Concern | Path |
| --- | --- |
| Kernel + capabilities | `src/lib/authorization/kernel.ts` |
| Job visibility SQL | `src/lib/authorization/loaders.ts` |
| Hierarchy filter | `src/lib/bid-schedule-filter.ts`, `src/lib/region-departments.ts` |
| Notes / mentions | `src/services/notes-service.ts`, `src/lib/note-body.ts`, `src/components/notes/note-composer.tsx` |
| Date picker | `src/components/ui/date-picker.tsx`, `src/lib/calendar-grid.ts` |
| Report results layout | `src/lib/report-layout.ts` |
| Copilot table labels | `src/lib/column-labels.ts` |
| Staffing | `src/services/staffing-service.ts` |
| Latest note (reports) | `src/lib/latest-note.ts`, `src/lib/latest-note-query.ts` |
| Finalize seam | `src/services/finalize-round.ts` |
| Table prefs | `src/lib/table-prefs.ts` |
| Standard dashboards | `src/lib/standard-dashboards.ts` |
| Schedule periodKey | `src/lib/distribution-schedule.ts` |
| Copilot tools | `src/services/copilot-query-service.ts`, `agent/` |
| HMAC bridge | `src/lib/ai/copilot-bridge.ts` |
| Generated PPTX / brand | `brand/`, `src/lib/brand/`, `src/lib/pptx-canvas.ts`, `src/lib/pptx-forecast.ts` |

## Verify

```bash
npm run docs:check
npm run db:migrate:check    # 13 migrations
npm run verify:web          # build + typecheck + lint + test + isolated smoke
```

Typecheck **after** `next build` on a clean tree (Next 16 generates `LayoutProps`). Isolated smoke must not import `server-only` from `tsx` seed.

## Related

- [generated-documents.md](generated-documents.md) — branded PPTX / future Word and PDF
- [github-and-vercel.md](github-and-vercel.md) — how this ships
- [security/role-capability-matrix.md](security/role-capability-matrix.md) — who can do what
- [magnus-api.md](magnus-api.md) — Magnus + Eve HTTP contract
