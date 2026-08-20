# ADR-007: Publish locked revisions only to Databricks

**Status:** Accepted  
**Date:** 2026-08-19  
**Implementation:** In progress behind `warehousePublication`

## Context

Lucy’s Power BI and external analytics need a replacement for the current sheet,
but the roundtable made RPD approval the warehouse gate. The existing
Databricks adapter is write-disabled and its all-rounds replacement shape does
not provide the required approval boundary. Draft, pending, submitted, post-bid,
or unlocked values must not appear authoritative downstream.

## Decision

Publish only immutable lock revisions produced by ADR-006.

- The Databricks target is a shadow table keyed by round ID and lock revision.
- Delivery uses idempotent merge/upsert semantics; retries cannot create a
  second copy.
- A current analytics view includes only each round’s current, non-retracted
  locked revision.
- Unlock/supersede events retract the prior revision from the current view
  without destroying its audit history.
- No mutable round row or unlocked lifecycle status is eligible for
  publication.
- External Magnus/Copilot analytics use the same current-locked boundary.
  Authorized in-product operator reads remain a separate path.
- `DATABRICKS_ALLOW_WRITE=false` remains the immediate kill switch, and the
  service principal receives only the minimum Unity Catalog target privileges.

Power BI switches only after frozen-fixture metric parity and row-count
reconciliation are signed off. Disabling publication never rolls back or
invalidates a local lock.

This decision supersedes the unresolved destination portion of
[ADR-002](002-post-bid-finalize-seam.md). ADR-002’s `finalizeRound()` seam and
current lock-passthrough description remain truthful until Phases 10 and 15
ship.

## Consequences

- Fourth-floor reporting cannot accidentally consume in-flight work.
- Warehouse outages and kill-switch use do not block local post-bid approval.
- Unlock behavior is explicit: history remains, while the current downstream
  view no longer presents the superseded revision.
- The old all-rounds TRUNCATE/INSERT path cannot be the production publication
  strategy.
