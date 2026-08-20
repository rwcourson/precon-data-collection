# ADR-002: Post-bid finalize seam (historical interim decision)

**Status:** Superseded in part
**Date:** 2026-08-17
**Decision owner:** Wednesday meeting (Jay / Robert / Bryan)

**2026-08-19 update:** The shipped `finalizeRound()` lock-passthrough remains
the current implementation. The destination is no longer undecided:
[ADR-006](006-versioned-lock-revisions-and-publication-outbox.md) decides
versioned local lock revisions plus an asynchronous outbox, and
[ADR-007](007-locked-only-databricks-publication.md) decides locked-only
Databricks publication. Those behaviors are planned, not yet shipped.

## Context

Submitted efforts sit in post-bid until the everyone-must-fill required set is
complete, then RPD Approve & Lock. Where the record goes after that — lock as
the final store, a Databricks write-back, or something else — is explicitly
not decided in this run. This ADR records the open options and the seam that
keeps the codebase from hard-committing.

## Decision (interim)

Ship `finalizeRound(roundId, principal)` in `src/services/finalize-round.ts`.
The default implementation is a **lock-passthrough** to
`pursuitService.approveAndLock`. Web (`approveAndLock` action) and mobile
approve-lock routes call the seam. No new final-store schema.

## Options on the table

| Option | What changes at the seam | Schema impact |
|---|---|---|
| Lock-as-final | Keep the passthrough; locked rounds stay the system of record | None |
| Databricks write-back | `finalizeRound` writes the locked snapshot to Databricks, then locks (or locks then writes) | Adapter only; no local final table |
| Other store | Same function signature; new adapter behind it | TBD — still no schema in this repo until chosen |

## Integration points

- `src/services/finalize-round.ts` — the only flip function.
- `src/actions/post-bid.ts` `approveAndLock` — web button.
- `src/app/api/v1/mobile/rounds/[id]/approve-lock/route.ts` — mobile.
- Lock gate (`evaluateLockGate`) stays required-fields-only; region custom columns never block.

## Consequences

- Wednesday can pick an option without rewriting callers.
- Inventing a local final table now would prejudge the meeting.
