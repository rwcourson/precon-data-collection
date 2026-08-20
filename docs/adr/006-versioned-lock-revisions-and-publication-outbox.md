# ADR-006: Versioned lock revisions and asynchronous publication outbox

**Status:** Accepted  
**Date:** 2026-08-19  
**Implementation:** In progress behind `lockRevisions`

## Context

The roundtable requires a formal unlock, edit, and re-lock cycle with an obvious
change log. It also requires RPD lock to gate downstream publication. A mutable
locked row cannot prove which values were approved, while a synchronous
Databricks call would make the user-facing lock depend on an external service.

The shipped implementation locks the mutable round through `finalizeRound()`;
Databricks writes are disabled.

## Decision

Keep `finalizeRound()` as the sole lock seam and add immutable, monotonically
versioned lock revisions.

Each successful lock transaction:

1. validates the current lock policy and authority;
2. stores an immutable snapshot with round ID, revision number, actor, reason,
   policy version, and timestamp;
3. marks that revision as the current local locked revision; and
4. appends a publication-outbox event in the same database transaction.

The local transaction completes without contacting Databricks. An asynchronous
worker delivers outbox events with an idempotency key composed from destination,
round ID, and lock revision. It records attempts, success, and terminal/operator
attention state without mutating the approved snapshot.

Unlock requires authorized actor, timestamp, and reason. It marks the current
revision superseded/retracted, reopens the round for edits, and appends the
corresponding outbox event. Re-lock creates a new revision; it never edits the
previous snapshot in place. Existing locked rows remain valid legacy locks and
must not receive fabricated history.

## Consequences

- RPD lock succeeds locally during a warehouse outage.
- Approved values and later corrections are reconstructable and auditable.
- Delivery retries are safe and do not duplicate a revision.
- Under the new lifecycle flag, mutable locked fields cannot be edited until
  unlock; the current shipped behavior remains until Phase 10 migration and
  cohort verification are complete.
- Destination-specific eligibility is defined separately in ADR-007.
