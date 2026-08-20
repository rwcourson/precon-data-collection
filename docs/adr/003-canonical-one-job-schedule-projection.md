# ADR-003: Canonical one-job schedule projection

**Status:** Accepted  
**Date:** 2026-08-19  
**Implementation:** In progress behind `scheduleProjection` / `scheduleUx` / `scheduleModes`

## Context

The shipped bid schedule renders one row per estimate round. The roundtable
requires one compact row per job while retaining every pricing effort, and it
requires table, card, Gantt, queues, and current-view exports to show the same
job set. Independent client-side grouping would create inconsistent counts and
different “current” efforts across surfaces.

## Decision

Create one server-side schedule projection with:

- one row identity per visible job;
- one deterministic focal round for the selected lifecycle section/queue;
- every other visible estimate round attached as sibling efforts;
- explicit job and focal-round links; and
- one normalized view contract for section, hierarchy, queue, grouping, sort,
  density, mode, and columns.

Focal-round selection must be a total, tested ordering. It first honors the
selected section/queue, then chooses the next actionable effort using the
available operational dates, and finally uses round number and stable ID as
tie-breakers. The projection must expose why a round was selected rather than
letting each consumer infer a different answer.

Table, cards, Gantt, queue previews, and one-click XLSX consume this projection.
The projection is a read model; it does not collapse or replace the existing
`jobs → estimate_rounds` persistence model. Job number/name opens the parent
job, while an explicit effort affordance opens the focal round.

Personal view preferences remain personal. A shared view is an explicit object
and cannot become another user's default implicitly.

## Consequences

- The same filter URL produces the same job IDs and job count in every mode.
- Multi-round jobs stay compact without losing effort history or edit targets.
- Projection parity and performance must be characterized before replacing the
  shipped per-round board.
- Latest-note loading is batched for displayed focal rounds and stays off
  unrelated hot paths.
