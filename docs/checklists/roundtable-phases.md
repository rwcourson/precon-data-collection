# Roundtable phase release checklists

Each phase is a reviewable unit. Disable the named flag to restore the previous
read/UI path. Additive schema stays dormant. Do not drop columns or rewrite
enums to roll back.

| Phase | Flag | Evidence | Rollback |
| --- | --- | --- | --- |
| 0 Contract | none | `docs/rpd-roundtable-product-contract.md`, ADRs 003–007, `PRODUCT_NAME` | Docs only |
| 1 Safety | `roundtableRollout` | `src/lib/rollout.test.ts`, `src/lib/preview-isolation.test.ts`, `docs/roundtable-rollback.md`, Admin Access pilot configuration | Disable cohort JSON |
| 2 Chrome | `roleChrome` | `src/lib/navigation.test.ts`, `src/lib/route-access.test.ts`, Sarah/Brian smoke | Set `roleChrome.enabled=false` |
| 3 Projection | `scheduleProjection` | `src/lib/schedule-projection.test.ts` | Flag off restores one-row-per-round callers |
| 4 Schedule UX | `scheduleUx` | `src/lib/bid-schedule.test.ts`, one-click Excel, pending job number, `scripts/smoke.mjs` labels/modes | Flag off hides new grouping labels only when wired |
| 5 Modes | `scheduleModes` | Table/cards/Gantt on `/bid-schedule`, lazy Gantt, smoke job-id parity, conflict-safe date edit | Flag off keeps table |
| 6 Phase form | `phaseAwareForm` | Schedule vs post-bid on `/rounds/[id]` | Flag off shows the full grouped card |
| 7 Salesforce | `salesforceSuggestions` | `src/lib/salesforce-link.test.ts`, `src/lib/integrations/connect/normalize.test.ts`, `src/lib/integrations/connect/fallback.test.ts`, IJV board flag | Flag off keeps ROM create; unlink remains |
| 8 Groups | `organizationGroups` | `src/lib/organization-visibility.test.ts`; round **Team** on `/rounds/[id]` is always on (not this flag) | Hide membership editors; visibility and round Team unchanged |
| 9 Approvals | `approvalWorkflow` | `src/lib/approval.integration.test.ts`, group edit policy on Admin Access | PCM writes publish immediately |
| 10 Lock revisions | `lockRevisions` | `src/lib/lock-lifecycle.integration.test.ts`, `src/lib/lock-revisions.test.ts` | Locked RPD in-place edits return |
| 11 Field policy | `fieldPolicy` | `src/lib/field-policy.test.ts`, `src/lib/metrics.test.ts` N/A denominators, post-bid historical-zeros queue | Lock gate uses the previous required list |
| 12 Change awareness | `changeAwareness` | `src/lib/change-watermarks.test.ts`, `src/lib/change-awareness.integration.test.ts`, configurable date-shift recipients on Admin notifications | Highlights and date-shift events stop |
| 13 Awardable | `awardableReporting` | `src/lib/awardable-reporting.test.ts`, `pnpm lucy:frozen-report`, Overview/reports/Magnus shadow KPIs gated | Shadow KPIs hide; production hit-rate unchanged |
| 14 Ingestion | `sourceIngestion` | Destini preview/confirm, checksum short-circuit (`src/lib/destini-import.test.ts`), `pnpm smartsheet:dump-counts`, isolated `pnpm smartsheet:live-counts`, `pnpm smartsheet:dump-report` | Hide Destini card; Smartsheet stays readable |
| 15 Warehouse | `warehousePublication` | `src/lib/integrations/databricks/publication-sql.test.ts`, `src/lib/integrations/databricks/feed.test.ts`, `pnpm warehouse:readiness`, `DATABRICKS_ALLOW_WRITE=false` | Local lock still succeeds |
| 16 Harden | all of the above | `pnpm run db:migrate:check contract:check security:check perf:check release:check docs:check`, `verify:web`, isolated Postgres `TEST_DATABASE_URL` (CI `web-postgres`; local `127.0.0.1:55432` only), `smoke:approval` (isolated), `audit:ui`, `verify:restore`, `verify:artifacts`, `verify:expo`, full-dump schedule timing when `.pglite/data-full` exists, `pnpm roundtable:phase-status`, [exit audit](roundtable-exit-audit.md) | Reduce cohort; never waive a failed gate |

Pilot configuration is an `app_settings` row keyed `roundtableRollout`. High-risk flags stay off until an explicit `{ "enabled": true }` cohort is saved.
