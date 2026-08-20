# Roundtable rollback

How to reverse a roundtable cohort without guessing.

1. **Disable the feature flag** in `app_settings.roundtableRollout` (or set `enabled: false` for that feature). High-risk features default off; the previous read/UI path remains.
2. **Restore the previous Vercel deployment** from the project deployment history. Do not force-push `master`.
3. **Leave additive schema in place.** Migrations `0018`–`0024` are nullable/backfill-safe. Do not drop columns or rewrite enums to roll back.
4. **Use Neon PITR only for a bad data migration**, not for a UI dislike. Preview must use a different database than Production (`PRODUCTION_DATABASE_URL` comparison on Preview).

   Rehearse PITR on a **throwaway Neon branch** before a production schema change that could corrupt data. Do not run PITR against Production from this repo.

   1. Confirm Preview `DATABASE_URL` is not Production (`pnpm run release:check` runs `scripts/preview-isolation-check.ts`).
   2. In the Neon console, note the restore window and a timestamp before the change.
   3. Create a branch from that PITR timestamp. Point a disposable env at the branch. Run `pnpm run db:migrate:check` there. If you run tests, use `TEST_DATABASE_URL` against that throwaway branch only — never against Production `DATABASE_URL`.
   4. Delete the throwaway branch after the rehearsal. Production stays on the live branch.
   5. UI rollback remains: disable the flag, restore the previous Vercel deployment, leave additive schema dormant.

5. **Keep Smartsheet readable** until a signed cutover report says otherwise.
6. **Keep `DATABRICKS_ALLOW_WRITE=false`** unless warehouse publication is explicitly accepted. Local lock still succeeds when writes are off.

Related: [github-and-vercel.md](github-and-vercel.md), [ADR-006](adr/006-versioned-lock-revisions-and-publication-outbox.md), [ADR-007](adr/007-locked-only-databricks-publication.md).
