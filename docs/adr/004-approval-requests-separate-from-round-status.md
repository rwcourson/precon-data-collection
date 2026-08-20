# ADR-004: Approval requests are separate from round status

**Status:** Accepted  
**Date:** 2026-08-19  
**Implementation:** In progress behind `approvalWorkflow`

## Context

The roundtable wants PCM creates and some edits to wait for RPD/SPD approval.
The shipped round status already describes the pricing lifecycle: Upcoming,
Active, Outstanding, Submitted, Post-Bid, and Locked. Adding “pending create”
or “pending edit” to that enum would mix governance with lifecycle, complicate
queues, and make a proposal look like published schedule data.

## Decision

Model governed creates and edits as versioned `approval_requests`, separate
from `round_status`.

An approval request records the proposal kind, target aggregate when one
exists, proposed payload/diff, submitter, governing group/policy, base version,
review state, reviewer, reason, and timestamps.

- Pending creates stay out of published job/round tables. The UI may show them
  in a clearly separated pending strip at the bottom of the schedule.
- Pending edits never change published values before approval.
- Approval applies the proposal transactionally. Edits compare the recorded
  base version/`updatedAt`; conflicts return a reviewable diff rather than
  overwriting newer work.
- Rejection and withdrawal retain an audit record.
- Duplicate checks include both published jobs and pending create requests.
- Authorization comes from the kernel and per-group direct-edit/proposal
  policy. Hiding controls is not authorization.

Round status remains exclusively the operational pricing/post-bid lifecycle.

## Consequences

- Schedule and post-bid queues do not acquire governance-only pseudo-statuses.
- Pending proposals can be filtered, counted, audited, and retried without
  appearing in official schedule exports or downstream publication.
- Approval events can seed “new since you last looked” behavior without
  coupling acknowledgement to lifecycle.
- Existing direct-create/edit behavior remains the shipped path until the
  Phase 9 rollout setting is enabled for a cohort.
