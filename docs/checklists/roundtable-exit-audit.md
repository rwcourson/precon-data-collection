# Roundtable phase exit audit

Requirement-by-requirement evidence against the RPD Roundtable plan exits
(Phases 0–16). File existence alone is not enough; this page names the
observable proof. Operational owner gates stay fail-closed and **unsigned**
until an owner sets the matching env to `1`. This document never signs Lucy,
Power BI, Production Smartsheet cutover, or live Databricks MERGE.

Commands:

```bash
pnpm roundtable:phase-status
pnpm ops:signoff-status
pnpm lucy:frozen-report
pnpm warehouse:readiness
```

## Status key

- **proven** — current tree has software, tests, and docs that satisfy the plan
  exit.
- **operational-unsigned** — in-repo evidence is as strong as this repo can
  make it; an owner gate is still unset.
- **scheduled** — a cohort date has not elapsed; the gate is not waived.
- **deferred** — contract says later-wave / still discuss; mock or adapter
  only.

## Phase 0 — Product contract

| Exit | Evidence | Status |
| --- | --- | --- |
| Every source ID has one owner/phase | `docs/rpd-roundtable-product-contract.md` 1.1–14.9 dispositions | proven |
| Characterization tests before shared-path changes | `bid-schedule.test.ts`, `visibility.characterization.test.ts`, `rollup.test.ts`, `validation.test.ts`, `outcome.test.ts` | proven |
| ADRs for projection, approvals, membership, lock, warehouse | `docs/adr/003`–`007` | proven |
| Temporary product label centralized | `PRODUCT_NAME` in `src/lib/product.ts` + `src/lib/product.test.ts` | proven |
| Nested self-perform mock, no schema | `docs/mocks/nested-self-perform.md`; no `self_perform_lines` in schema | proven / deferred |
| Old docs no longer govern new work | `ROADMAP.md`, `docs/jay-mcdaniel-upgrades.md` point at the contract | proven |

## Phase 1 — Rollout and verification safety

| Exit | Evidence | Status |
| --- | --- | --- |
| Flagged preview enable/disable without data loss or migration rollback | `src/lib/rollout.ts`, high-risk flags default off, `docs/roundtable-rollback.md`, `docs/checklists/roundtable-phases.md` | proven |
| Preview database isolated from Production | `src/lib/preview-isolation.ts`, `scripts/preview-isolation-check.ts` in `pnpm release:check` | proven |
| PCM nav smoke, approval smoke, UI audit, restore, artifacts in CI | `.github/workflows/ci.yml` `web` job | proven |

## Phase 2 — Role-aware chrome

| Exit | Evidence | Status |
| --- | --- | --- |
| Sarah Chen vs Brian Meyers chrome, route auth, desktop/mobile, no PCM Copilot | `scripts/smoke.mjs` personas; `src/lib/navigation.test.ts`; `src/lib/route-access.test.ts`; PCM Copilot denied | proven |
| Shared nav model | `src/lib/navigation.ts` used by sidebar and mobile | proven |
| Title mapping adapter fail-closed | `src/lib/title-mapping-adapter.ts`; unmapped email/title/manager/groups returns `{ source: "unmapped", role: null }` in `title-mapping-adapter.test.ts` | proven |
| Touch-safe FieldHelp | `src/components/ui/field-help.tsx` | proven |

## Phase 3 — Canonical schedule projection

| Exit | Evidence | Status |
| --- | --- | --- |
| Every filtered job once; stable effort; siblings retained; per-user views | `src/lib/schedule-projection.test.ts`; `src/lib/table-prefs.ts`; starring a shared view does not write another user's default (`table-prefs.integration.test.ts`) | proven |
| Indexed latest-note lookup for displayed focals | `src/lib/latest-note-query.ts`, `round_notes_round_created_idx` | proven |

## Phase 4 — Week-one schedule UX

| Exit | Evidence | Status |
| --- | --- | --- |
| 2.4–2.6 grouping labels, lead, bid month | `BID_SCHEDULE_GROUP_OPTIONS` + `src/lib/bid-schedule.test.ts` | proven |
| 2.12 one-click Excel of current projection | Bid Schedule `Download Excel` link (builder stays in Export dialog) | proven |
| 2.16 Pending job number | `displayJobNumber` + `src/lib/format.test.ts` | proven |
| 3.1–3.3, 3.7 queues, deep links, aging, Upcoming+Active | `overview-queues`, `dateAgingNudge`, pipeline section | proven |
| 8.3 latest-note column empty/error | empty: “Add the first note”; error: “Notes unavailable” via `latestNoteBoardLoadForRounds` | proven |
| Playwright/smoke | `scripts/smoke.mjs` labels/modes | proven |

SSR is the Notes loading state: the column does not paint until the join
returns or fails. Gantt has a separate “Loading Gantt…” placeholder.

## Phase 5 — Table, cards, Gantt

| Exit | Evidence | Status |
| --- | --- | --- |
| Same job IDs across modes | `schedule-projection.test.ts`; smoke `table, cards, and gantt share job ids` | proven |
| Conflict-safe permitted date edit | Gantt calls `updateRoundCell(..., effort.updatedAt)`; `transactions.integration.test.ts`; `schedule-modes.contract.test.ts` | proven |
| No people auto-slide; future RM event | `RESOURCE_MANAGEMENT_EVENT = "resource.bar.future"` | proven |
| Lazy Gantt; 1440 / 834 / reduced motion | `gantt-lazy.tsx`; `scripts/ui-audit.mjs`; `scripts/smoke.mjs` iPad viewport | proven |

## Phase 6 — Phase-aware round entry

| Exit | Evidence | Status |
| --- | --- | --- |
| Active/Upcoming expose only schedule cores | `fieldsForRoundEntry({ mode: "schedule" })` in `field-policy.test.ts` | proven |
| Post-Bid retains grouped cards | `mode === "postBid"`; regional extras tab | proven |
| Required from policy; help notes without source badge | every `scheduleCore` field has `note`; `FieldHelp` when `def.note` | proven |
| Banners: Schedule, Posted for RPD, Locked | `entry-form.tsx` + locked `Alert` on the round page | proven |
| No extra two-second create fields | `new-pursuit-dialog.tsx` still ROM + department/phase/year | proven |

## Phase 7 — Salesforce suggestions

| Exit | Evidence | Status |
| --- | --- | --- |
| Accept, override, unlink, duplicate, offline, daily match | `salesforce-link.test.ts`, `connect/normalize.test.ts`, `connect/fallback.test.ts` | proven |
| HPP suggest never auto-set | `suggestHppFromEstimateValue` + `product.test.ts` | proven |
| Production Salesforce credentials (4.6) | operational owner supply; adapters work without them | operational-unsigned |

## Phase 8 — Groups, sub-jobs, staffing, SP intent

| Exit | Evidence | Status |
| --- | --- | --- |
| Dallas/Georgia and Georgia slice stay one job | `organization-visibility.test.ts` | proven |
| Parent/child cycle rejected | `src/lib/job-parent.ts` + `job-parent.test.ts`; `setParentJob` refuses loops | proven |
| One lead group; ops vs precon | `setJobGroupMembership` demotes other leads; group editor cycles discipline | proven |
| Staffing never changes visibility | same file, “does not grant job visibility by staffing” | proven |
| Legacy fallback reads | additive memberships; `job_region_visibility` remains access | proven |
| Nested self-perform schema | mock only | deferred |

## Phase 9 — Approvals

| Exit | Evidence | Status |
| --- | --- | --- |
| PCM, lead, admin, RPD, leadership, corporate-admin publish boundaries | `approval.integration.test.ts` | proven |
| Duplicates across published jobs and pending submissions | `approval.integration.test.ts` “checks pending create payloads as well as published jobs” | proven |
| Lead “My post-bid” default and “you owe post-bid” queue | `postBidShowsMineOnly` + `overview-queues.test.ts` you-owe card | proven |
| No permission theater | `who-can-edit.test.ts` + kernel | proven |

## Phase 10 — Lock revisions

| Exit | Evidence | Status |
| --- | --- | --- |
| Unlock needs auth+reason; locked edits blocked; re-lock new revision; history | `lock-lifecycle.integration.test.ts`, `lock-revisions.test.ts` | proven |
| `finalizeRound()` sole lock seam | ADR-002 / ADR-006; lock service | proven |
| Leadership dashboards default locked | `defaultDashboardStatus()` in `src/lib/rollup.ts` | proven |

## Phase 11 — Field policy

| Exit | Evidence | Status |
| --- | --- | --- |
| Concept, DD, GMP/hard bid, awardable/non-awardable, N/A, zero, ranges, legacy | `field-policy.test.ts` lock-gate plus `calcMetric` / `applyNotApplicableByRound` excluding N/A hours from denominators (`metrics.test.ts`). Reports, warehouse feed, mobile dashboards, leadership rollups, Magnus, and Overview awardable efficiency load `round_field_exceptions` before calculating. | proven |
| Sidecar keyed by round/field/value revision | `round_field_exceptions.valueSnapshot`; `applicableExceptionKeys` drops N/A once the stored value no longer matches (`field-policy.test.ts`). Loaders compare against current round values. | proven |
| Miami / Jacksonville departments | `src/lib/region-departments.ts` | proven |

## Phase 12 — Change awareness

| Exit | Evidence | Status |
| --- | --- | --- |
| Two-user watermarks, values, ack, deep links, deduped notifications | `change-watermarks.test.ts`, `change-awareness.integration.test.ts` | proven |
| Destini/source date-shift grouping | change-awareness integration “groups Destini/source-driven date shifts” | proven |
| Configurable date-shift recipients; in-app/email preferences | Admin notification settings + `dateShiftNotifyLead` / `dateShiftNotifyRegionalRpd`; `includeDateShiftRecipient` in pursuit-service; channels still gated by `settings.inApp` / `settings.email` | proven |

## Phase 13 — Awardable reporting

| Exit | Evidence | Status |
| --- | --- | --- |
| Frozen fixtures reconcile Overview / exports / reports / Magnus / Power BI **candidate** numbers; every formula states grain | `fixtures/roundtable-locked-frozen.json`, `awardable-reporting.test.ts`, `pnpm lucy:frozen-report` | proven |
| Lucy accepts fixtures; production hit-rate switch | `LUCY_FROZEN_FIXTURE_SIGNED_OFF` | operational-unsigned |

## Phase 14 — Destini + Smartsheet cutover

| Exit | Evidence | Status |
| --- | --- | --- |
| Repeat imports idempotent; previews list every proposed Destini key | `destini-import.test.ts` checksum + `buildDestiniFieldDiffs` | proven |
| Isolated historical dump reconciles | `docs/smartsheet-cutover.md` last rehearsal: 640 jobs / 1098 rounds / 0 remaining extras / checksum `cd20a1a31fac780a465db7014c3df01a92b23a25ea0fed3a44f79638745024f1`; `pnpm smartsheet:dump-report` | proven (isolated) |
| Re-enable Smartsheet remains possible until final acceptance | helpers never flip `SMARTSHEET_MODE`; `mayDisableReads` requires sign-off | proven |
| Production dump sign-off / disable reads | `SMARTSHEET_DUMP_SIGNED_OFF` | operational-unsigned |

## Phase 15 — Warehouse

| Exit | Evidence | Status |
| --- | --- | --- |
| Idempotent retry MERGE; no unlocked row in current view; unlock retracts | `publication-sql.test.ts` `applyLockedPublication` / `currentLockedShadowView` | proven |
| Magnus/API locked-only | `magnus-scope.test.ts`; API route + `runMagnusTurn` | proven |
| Disabling writes leaves local locks intact | `DATABRICKS_ALLOW_WRITE=false` kill switch; lock service outbox is async | proven |
| In-repo warehouse readiness (no host leak) | `pnpm warehouse:readiness` prints only booleans + write kill-switch; `scripts/probe-databricks.mjs` no longer prints `DATABRICKS_HOST` | proven |
| Live MERGE with `warehousePublication` on | `DATABRICKS_MERGE_SIGNED_OFF` | operational-unsigned |
| Power BI parity signed off | `POWERBI_PARITY_SIGNED_OFF`; candidate packet is in `lucy:frozen-report` | operational-unsigned |

## Phase 16 — Harden and cohort

| Exit | Evidence | Status |
| --- | --- | --- |
| `db:migrate:check`, `contract:check`, `security:check`, `perf:check`, `release:check`, `docs:check` | Re-run 2026-08-20 after N/A value-revision sidecar and configurable date-shift recipients: all passed. Full-dump timing 640 jobs in 4.9ms, latest-note join 11.4ms | proven |
| `verify:web`, real Postgres tests, `audit:ui`, `smoke:approval`, `verify:restore`, `verify:artifacts` | Re-run 2026-08-20: `verify:web` **129 files / 643 tests** + isolated smoke (Sarah/Brian chrome, Gantt job-id parity, lock path). Isolated Postgres `127.0.0.1:55432` same 129/643. Same day: `smoke:approval`, `audit:ui` (soft token findings, 0 console errors), `verify:restore`, `verify:artifacts`. | proven |
| `verify:expo`; `verify:ios` on default-branch push | Re-run 2026-08-20: `verify:expo` passed; `verify:ios` 18 native tests on iPhone 17 Pro / Xcode-beta | proven |
| Full-dump schedule timing | `pnpm perf:check` on 2026-08-20 with `.pglite/data-full`: 640 jobs projected in 4.9ms; latest-note join 11.4ms (`notesFound: 0` on dump import is expected) | proven |
| Aug 26 chrome/schedule canary | `docs/roundtable-cohort-rollout.md`; today is before that date | scheduled |
| Room pilot, 1 Oct freeze, November warehouse, Smartsheet-off | same checklist; flags stay off until cohort JSON | scheduled |
| Failed gate reduces cohort; does not waive | `docs/roundtable-cohort-rollout.md` | proven (policy) |

## Operational snapshot

`pnpm ops:signoff-status` is fail-closed. Unsigned unless the env value is
exactly `1`. Dump-report green does **not** authorize disabling Smartsheet
reads. Warehouse writes still need **both** `DATABRICKS_ALLOW_WRITE=true` and
`warehousePublication.enabled`.

Contract 4.6 (production Salesforce credentials) is an owner supply, not an
env flag in this repo.
