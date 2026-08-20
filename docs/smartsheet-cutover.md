# Smartsheet cutover rehearsal

Do not disable Smartsheet reads until this report is green and signed.

1. Stage one complete history dump; store the raw artifact and checksum.
2. Reconcile job count, round count, duplicates, and required-field flags against the dump.
3. Rehearse rollback: re-enable Smartsheet reads, leave additive schema, restore the previous deploy if needed.
4. Keep job number, job ID, round ID, lock revision, and date grain stable for a future time-card join. Do not add a time-card screen. Keys are listed in `src/lib/time-card-join.ts` and published on the locked warehouse feed.

Until sign-off, `SMARTSHEET_MODE` may stay `api` or `disabled` independently of Destini file import. Software reconciliation lives in `src/lib/smartsheet-dump.ts`; operational sign-off is still required before reads go off.

```bash
pnpm smartsheet:pull
pnpm smartsheet:dump-counts
pnpm db:bootstrap:smartsheet
pnpm smartsheet:live-counts
pnpm smartsheet:dump-report data/smartsheet/dump-counts.json data/smartsheet/live-counts.json
pnpm ops:signoff-status
```

`pnpm smartsheet:pull` writes gitignored JSON under `data/smartsheet/`. `pnpm smartsheet:dump-counts` parses those files with the same filter and merge as import, writes `data/smartsheet/dump-counts.json`, and replays the parser to prove checksum identity. `pnpm db:bootstrap:smartsheet` imports into isolated PGlite at `.pglite/data-full` (never Production). `pnpm smartsheet:live-counts` recounts that isolated database. None of these scripts change `SMARTSHEET_MODE`.

`mayDisableReads` is true only when the dump-report is green **and** `SMARTSHEET_DUMP_SIGNED_OFF=1`.

Dump-required flags (complete-status drafts/rounds only): region, precon department, estimate phase, bid due date, awardability, estimate value, fee back-page, fee expected, and estimate lead. Upcoming/active/outstanding rows are allowed to be incomplete.

A staged historical dump lives in gitignored `data/smartsheet/` after `pnpm smartsheet:pull`. Isolated dump-vs-live reconciliation uses `.pglite/data-full`, not Production. `SMARTSHEET_DUMP_SIGNED_OFF=1` remains an owner gate even when that isolated report is green. The helper never imports into Production and never flips `SMARTSHEET_MODE`.

Last isolated rehearsal on this machine (2026-08-20): 640 jobs, 1098 rounds, 0 remaining identity extras after merge, 396 complete-status required-field flags, dump checksum `cd20a1a31fac780a465db7014c3df01a92b23a25ea0fed3a44f79638745024f1`, parser replay matched. Canonical projection of that isolated database: 640 job rows in 5.5ms; latest-note DISTINCT ON for those focal rounds in 10.5ms (`pnpm perf:check` when `.pglite/data-full` exists). `mayDisableReads` stayed false because `SMARTSHEET_DUMP_SIGNED_OFF` is unset. Re-run the commands above to refresh those counts; do not treat this paragraph as Production sign-off.

Software rehearsal (not a historical dump):

```bash
pnpm smartsheet:dump-report fixtures/smartsheet-dump-rehearsal.json fixtures/smartsheet-dump-rehearsal.json
```
