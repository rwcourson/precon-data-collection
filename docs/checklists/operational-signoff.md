# Roundtable operational sign-off

Software exits for Phases 13–16 can be green while these owner gates stay
unsigned. Every flag is **fail-closed**: unset or any value other than `1`
means not accepted. CI does not fail on unsigned gates.

| Gate | Env | Phase | What must be true before setting `=1` |
| --- | --- | --- | --- |
| Lucy frozen fixture | `LUCY_FROZEN_FIXTURE_SIGNED_OFF` | 13 | Lucy accepts `fixtures/roundtable-locked-frozen.json`. Production hit-rate stays on the current count definition until then. |
| Power BI parity | `POWERBI_PARITY_SIGNED_OFF` | 15 | Shadow table row counts and metrics match the frozen locked fixture. |
| Smartsheet dump | `SMARTSHEET_DUMP_SIGNED_OFF` | 14 | Isolated `pnpm smartsheet:dump-report` of dump-counts vs live-counts is green **and** an owner signs this gate against Production cutover. Parser self-check and isolated PGlite import are not Production sign-off. The helper never flips `SMARTSHEET_MODE`. |
| Databricks MERGE | `DATABRICKS_MERGE_SIGNED_OFF` | 15 | A live locked MERGE ran with `warehousePublication` on. `DATABRICKS_ALLOW_WRITE=false` remains the kill switch until this gate is signed. |
| Salesforce production read (contract 4.6) | none | 7 | B&G supplies production Salesforce credentials. Mock/REST adapters and tests stay the software path until that access exists. Do not invent a sign-off env in this repo. |

Print current status (always exits 0):

```bash
pnpm ops:signoff-status
pnpm lucy:frozen-report
pnpm warehouse:readiness
```

`pnpm warehouse:readiness` prints only configuration booleans and the write
kill-switch. It never prints `DATABRICKS_HOST` and never flips
`DATABRICKS_ALLOW_WRITE`.

`pnpm ops:signoff-status` now reports whether the isolated dump-vs-live files reconcile (`dumpReportGreen`) and still refuses `mayDisableSmartsheetReads` until `SMARTSHEET_DUMP_SIGNED_OFF=1`. It never flips `SMARTSHEET_MODE` or `DATABRICKS_ALLOW_WRITE`.

Do not set `DATABRICKS_ALLOW_WRITE=true` or disable Smartsheet reads from this
checklist. Reads stay on until the dump report is green **and**
`SMARTSHEET_DUMP_SIGNED_OFF=1`. Warehouse writes need **both**
`DATABRICKS_ALLOW_WRITE=true` **and** `warehousePublication.enabled`.
