# RPD Roundtable product contract

**Status:** Canonical approved direction  
**Source date:** 2026-08-19  
**Applies to:** Product work after the shipped V1/Jay McDaniel baseline

## Authority and interpretation

The 2026-08-19 Think Tank RPD roundtable change list is the product source of
truth for this roadmap. It **supersedes stale V1 exclusions** wherever they
conflict. In particular, the same-data schedule Gantt, a resource-management
date integration seam, trusted Destini ingestion, and locked-only Databricks
publication are no longer permanently out of scope.

This document is a traceability and decision contract, not a claim that planned
behavior has shipped. Existing behavior is described as **preserve**; all other
dispositions remain planned until their phase is implemented and verified.
Lowery's separate staffing/equipment/rates application and a native PCM rollout
are still not part of this product release.

Each source requirement has exactly one disposition and one primary roadmap
phase:

- **preserve** — already-good behavior that future work must not regress.
- **implement** — approved product behavior to build in the named phase.
- **stop** — an existing requirement, default, or workflow to remove or stop
  enforcing; historical data is retained unless an ADR says otherwise.
- **operational** — a non-product dependency that must be supplied or approved
  by an operational owner.
- **deferred** — no production policy is approved. Phase 0 keeps the item in the
  decision register; implementation requires an updated contract and ADR.

## Phase and ownership register

| Phase | Name | Accountable workstream |
| --- | --- | --- |
| 0 | Lock the product contract | Product + architecture |
| 1 | Rollout and verification safety | Platform + release |
| 2 | Role-aware chrome | Product UI + authorization |
| 3 | Canonical schedule projection | Schedule + data |
| 4 | Week-one schedule UX | Product UI |
| 5 | Table, card, and Gantt modes | Schedule UI |
| 6 | Phase-aware round entry | Product UI + domain |
| 7 | Suggestion-first Salesforce | Integrations |
| 8 | Groups, sub-jobs, staffing, and SP intent | Domain + authorization |
| 9 | Create/edit approvals and lead queues | Domain + authorization |
| 10 | Lock revisions and history | Lifecycle + data |
| 11 | Required-field and numeric policy | Domain + analytics |
| 12 | Change awareness and notifications | Platform + product UI |
| 13 | Awardable money and reporting | Analytics + domain |
| 14 | Destini ingestion and Smartsheet cutover | Integrations + data |
| 15 | Locked warehouse publication | Data platform |
| 16 | Hardening and cohort release | Release + security |

The phase workstream is the owner for every requirement assigned to that phase.
Deferred Phase 0 entries remain owned by Product + architecture until a decision
promotes them into an executable phase.

## Requirement traceability

### 1. Navigation and change management

| ID | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 1.1 | implement | 2 | PCM/lead chrome contains Overview, Bid Schedule, and Post-Bid only. |
| 1.2 | implement | 2 | Remove Tools/More from PCM/lead navigation without weakening route authorization. |
| 1.3 | implement | 2 | Role-aware experiences use a fail-closed title/reporting-chain mapping with explicit overrides. |
| 1.4 | implement | 2 | Hide Copilot from PCM/lead day-one chrome. |
| 1.5 | implement | 5 | Table, card, and Gantt are modes over one canonical schedule dataset, not separate modules. |
| 1.6 | implement | 0 | Use temporary label “B&G Precon — Pursuits & Data”; final naming is a Phase 16 outside-pilot gate. |
| 1.7 | preserve | 16 | Web/iPad is the rollout path; keep native clients compatible but do not demo them as PCM day one. |

### 2. Bid schedule — layout and interaction

| ID | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 2.1 | implement | 3 | Project one compact board row per job with all estimate-round siblings attached. |
| 2.2 | implement | 3 | Job number/name opens the job; the focal effort remains directly reachable. |
| 2.3 | implement | 8 | Model acyclic parent/child jobs for TI/sub-jobs without duplicate board rows. |
| 2.4 | implement | 4 | Label the grouping control and retain “No grouping.” |
| 2.5 | implement | 4 | Add lead-estimator grouping. |
| 2.6 | implement | 4 | Group bid due dates by month. |
| 2.7 | implement | 3 | Keep columns/grouping personal by default; sharing is explicit and cannot replace another user's default. |
| 2.8 | preserve | 3 | Grouping remains optional; division is not a permanent default. |
| 2.9 | preserve | 3 | Preserve summary/detail density. |
| 2.10 | implement | 6 | Show only schedule-core fields before submit and the full grouped card after submit. |
| 2.11 | implement | 5 | Add a Gantt mode over the exact same filtered, sorted job set. |
| 2.12 | implement | 4 | One click downloads the current visible schedule as XLSX without a configuration popup. |
| 2.13 | preserve | 4 | Keep saved PDF templates as the separate Monday-packet workflow. |
| 2.14 | preserve | 4 | Keep wrapped latest notes in print/export. |
| 2.15 | preserve | 7 | Keep two-second ROM creation and do not add required create fields. |
| 2.16 | implement | 4 | Render stored `TBD-*` identities as “Pending job number” or equivalent, not as a real number. |
| 2.17 | preserve | 16 | Preserve the web/iPad-first product target. |

### 3. Queues, aging, and highlights

| ID | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 3.1 | preserve | 4 | Preserve all five Overview action queues. |
| 3.2 | implement | 4 | Make every queue preview row deep-link to its job/round while the card still opens the filtered queue. |
| 3.3 | implement | 4 | Add labeled drawings/bid-date aging and confirmation nudges; do not auto-move lifecycle status. |
| 3.4 | implement | 12 | Highlight changes per user since acknowledgement. |
| 3.5 | implement | 12 | Emit idempotent date-shift notifications. |
| 3.6 | preserve | 3 | Preserve Upcoming, Active, and Outstanding and their transitions. |
| 3.7 | implement | 4 | Add a combined Upcoming + Active view without forcing division grouping. |
| 3.8 | implement | 6 | Preserve explicit team assignment and add a clear “bid date unclear” schedule state. |

### 4. Salesforce — suggest, do not chain

| ID | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 4.1 | implement | 7 | Offer Salesforce matches as typeahead suggestions while typing. |
| 4.2 | implement | 7 | Local text may override/unlink a suggestion; retain visible source-shadow values and an undo path. |
| 4.3 | implement | 7 | Treat Salesforce job number as authoritative; all other source fields remain explicitly accepted suggestions. |
| 4.4 | preserve | 7 | Later Salesforce updates never silently overwrite local choices. |
| 4.5 | preserve | 7 | Preserve daily candidate matching with human accept/reject. |
| 4.6 | operational | 7 | B&G must provide production Salesforce read access and credentials. |
| 4.7 | implement | 7 | Add auditable HPP/go-no-go/IJV board flags; value may suggest HPP but never auto-set it. |

### 5. Create and approve onto the board

| ID | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 5.1 | implement | 9 | PCM creates a pending proposal shown separately at the bottom until RPD/SPD approval publishes it. |
| 5.2 | implement | 9 | Add the short lead post-bid handoff and RPD review motion. |
| 5.3 | implement | 9 | Estimate leads default to their own owed post-bid queue. |
| 5.4 | implement | 9 | Support per-group proposal/direct-edit policy without reducing visibility. |
| 5.5 | implement | 9 | Govern proposed edits through conflict-safe approval requests. |
| 5.6 | implement | 9 | Explain “Who can edit this?” in-product from real authorization policy. |

### 6. One job, many groups

| ID | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 6.1 | preserve | 8 | Preserve one job instance across regions and people; never mint office-specific duplicates. |
| 6.2 | implement | 8 | Add multi-group memberships separate from region visibility. |
| 6.3 | implement | 8 | Allow all-Georgia plus slice memberships so every participating director can filter the same job. |
| 6.4 | implement | 8 | Share the same job with BDC/other groups or pinned people without duplication. |
| 6.5 | implement | 8 | Replace binary IJV meaning with participating groups, ops/precon roles, and a lead group. |

### 7. Team lives on the round

| ID | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 7.1 | implement | 8 | Keep staffing on round/stage assignments and relabel job Access as “Who can see this.” |
| 7.2 | implement | 8 | Add lightweight self-perform intent to upcoming/active rounds and filters. |
| 7.3 | preserve | 4 | Preserve Needs staffing = upcoming + no team assigned; add direct preview-row links under 3.2. |

### 8. Notes

| ID | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 8.1 | preserve | 3 | Preserve timestamped, attributed round-note history and latest-note reporting. |
| 8.2 | preserve | 3 | Notes remain on the pricing effort, not the job. |
| 8.3 | implement | 4 | Add an optional live latest-note column with effort context and a direct Notes link. |

### 9. Post-bid — one place, lock, and unlock

| ID | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 9.1 | implement | 10 | Make In queue, Ready for RPD, and Locked first-class views in one module. |
| 9.2 | preserve | 10 | Do not create a second Metrics sheet; use filters and calculated views. |
| 9.3 | implement | 10 | Unlock with reason, edit, and re-lock as a new immutable revision with visible diffs. |
| 9.4 | preserve | 10 | RPD/SPD remains the lock authority; chiefs/seniors do not lock. |
| 9.5 | implement | 15 | Warehouse/external consumers receive locked revisions only; Phase 10 also defaults leadership views to locked data. |
| 9.6 | preserve | 6 | Preserve the grouped post-bid card and regional extras tab. |
| 9.7 | preserve | 10 | Queue rows continue to open the round card. |
| 9.8 | implement | 9 | Make the admin-keyed/RPD-blessed handoff explicit as “Posted for RPD review.” |
| 9.9 | implement | 10 | Later outcome/start/awardability changes use the formal unlock/re-lock history. |

### 10. Required fields and numeric semantics

| ID | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 10.1 | implement | 11 | Version the required-field policy by estimate-phase band. |
| 10.2 | implement | 11 | Scale requirements by awardability where policy approves it. |
| 10.3 | stop | 11 | Stop accepting silent zero as a real required value or N/A; preserve historical zeros. |
| 10.4 | implement | 11 | Add explicit, auditable N/A that passes policy and is excluded from metric denominators. |
| 10.5 | implement | 11 | Add range warnings with explicit acknowledgement. |
| 10.6 | implement | 11 | Complete field help and visible required markers from policy. |
| 10.7 | implement | 6 | Use the agreed schedule cores, real start-month grain, contract time, and a distinct interview date; bid review stays optional/reporting. |
| 10.8 | implement | 11 | Add Miami and Jacksonville to governed department reference data. |

### 11. Field-list votes

The source section is intentionally unnumbered. The keys below are traceability
labels only; they do not invent new source requirement IDs.

#### Keep

| Key | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 11.K1 | preserve | 6 | Keep job number/name, region, precon department, and estimate phase. |
| 11.K2 | preserve | 11 | Keep estimate value. |
| 11.K3 | preserve | 11 | Keep both fee back-page and fee expected. |
| 11.K4 | preserve | 11 | Keep total contingency only. |
| 11.K5 | preserve | 11 | Keep PM months. |
| 11.K6 | preserve | 11 | Keep craft labor dollars and man hours. |
| 11.K7 | preserve | 11 | Keep awardability. |
| 11.K8 | implement | 11 | Keep granular market sector and derive MLT instead of keying both. |
| 11.K9 | implement | 6 | Keep drawings due/interview/bid dates, adding a distinct interview date. |

#### Stop requiring or keep optional

| Key | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 11.S1 | preserve | 11 | Keep total contingency only; do not add stated/extra layers. |
| 11.S2 | stop | 11 | Remove GC/GR Owner SOV from the lock gate without deleting history. |
| 11.S3 | stop | 11 | Stop requiring manual GC/GR B&G sort until trusted Destini automation exists. |
| 11.S4 | stop | 11 | Remove precon cost from the lock gate; retain it as optional. |
| 11.S5 | stop | 11 | Remove utilized support services from the lock gate. |
| 11.S6 | preserve | 11 | Keep GSF, keys, and unused alternatives optional. |
| 11.S7 | deferred | 0 | Business Strategy Values and Project Planning Precon Engagement remain unchanged pending a decision. |
| 11.S8 | deferred | 0 | Do not replace self-perform scalars until the nested-card policy is approved; see section 12. |

#### Still discuss

| Key | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 11.D1 | deferred | 0 | Bid year entry versus derivation remains undecided. |
| 11.D2 | deferred | 0 | Prospective/Committed/WUC entry versus DMR source remains undecided. |
| 11.D3 | deferred | 0 | Equipment-dollar definition remains undecided. |
| 11.D4 | deferred | 0 | Field-supervision-month requirement remains undecided. |
| 11.D5 | deferred | 0 | Live Destini SQL/API versus next-day Databricks transport remains undecided. |
| 11.D6 | deferred | 0 | Early-release awardable aggregation and job-number policy remains undecided. |
| 11.D7 | deferred | 0 | Nested self-perform versus Destini child estimates remains undecided. |

### 12. Nested self-perform card

The group requested a mock before implementation. No nested-line schema or
production policy belongs in Phases 0–16 until the deferred decisions are
approved.

| ID | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 12.1 | deferred | 0 | Mock dynamic work-type rows; do not add schema yet. |
| 12.2 | deferred | 0 | Decide the two-tier generic/specific taxonomy with downstream consumers. |
| 12.3 | deferred | 0 | Decide per-type dollars, optional hours, and success/outcome semantics in the mock. |
| 12.4 | deferred | 0 | Decide inclusive-versus-additional behavior and warnings in the mock. |
| 12.5 | preserve | 0 | Fee remains on the parent pricing effort; do not add child fee. |
| 12.6 | deferred | 0 | Optional self-perform start/end dates await card approval. |
| 12.7 | stop | 0 | Dual priced/proposed scalars are the approved direction to stop only when an accepted nested replacement ships; do not remove them early. |
| 12.8 | deferred | 0 | “Macro good enough at GMP” is a future card design constraint, not current behavior. |
| 12.9 | deferred | 0 | Production/non-production hours stay out of the first implementation decision. |
| 12.10 | deferred | 0 | Preserve work-type granularity for BDC/scheduling consumers in any future design. |

### 13. Awardable money, early release, and hit rate

| ID | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 13.1 | implement | 13 | Add nullable awardable amount with provenance; do not infer it from estimate value. |
| 13.2 | implement | 13 | Add signed contract amount for conversion reporting. |
| 13.3 | implement | 13 | Separate awardability from success and shadow-test awardable-dollar hit rate; do not switch production math until deferred early-release aggregation is approved. |
| 13.4 | implement | 13 | Add locked-only throughput, hit-rate, efficiency, and lift reporting with explicit grain and coverage. |

### 14. Automation and systems

| ID | Disposition | Phase | Contract |
| --- | --- | --- | --- |
| 14.1 | implement | 14 | Fill trusted source-owned fields from accepted Salesforce/Destini data without re-asking identity fields. |
| 14.2 | deferred | 0 | Keep live Destini API/SQL versus next-day transport behind an adapter until the latency/source decision is approved. |
| 14.3 | implement | 14 | Add per-round Destini file preview/confirm using the existing import-diff path. |
| 14.4 | preserve | 11 | Preserve server-calculated metrics and fix zero/N/A semantics underneath them. |
| 14.5 | implement | 14 | Reconcile one complete Smartsheet history dump, then disable ongoing reads only after signed cutover evidence. |
| 14.6 | implement | 15 | Publish an idempotent snapshot only after RPD lock; local lock never waits on Databricks. |
| 14.7 | implement | 15 | External Magnus/Copilot answers use current locked revisions only; operator reads remain separately authorized. |
| 14.8 | implement | 14 | Preserve stable join keys/date grain for future time cards; do not add a time-card screen. |
| 14.9 | implement | 5 | One canonical schedule date drives table/card/Gantt and emits a future RM integration event; never auto-slide people. |

## Architecture decisions

- [ADR-003](adr/003-canonical-one-job-schedule-projection.md) — one job row
  with a deterministic focal effort and attached siblings.
- [ADR-004](adr/004-approval-requests-separate-from-round-status.md) —
  versioned create/edit proposals do not expand round lifecycle status.
- [ADR-005](adr/005-organization-membership-vs-region-visibility.md) —
  organization membership, visibility, staffing, and permissions remain
  separate.
- [ADR-006](adr/006-versioned-lock-revisions-and-publication-outbox.md) —
  immutable lock revisions and a transactional asynchronous outbox.
- [ADR-007](adr/007-locked-only-databricks-publication.md) — only current locked
  revisions are published to the warehouse/external analytics.

## Phase 0 characterization evidence

No new production behavior is introduced by this contract. Existing focused
tests already pin the useful “Already good” invariants without adding a
duplicative characterization file:

- `src/lib/bid-schedule.test.ts` — lifecycle sections, optional grouping,
  stable sorting, personal view URLs, and urgency.
- `src/lib/authorization/visibility.characterization.test.ts` — role/workspace
  visibility boundaries.
- `src/lib/rollup.test.ts` — one latest/final round per job for leadership
  rollups and exports.
- `src/lib/validation.test.ts` — named lock-gate labels and current required
  fields.
- `src/lib/outcome.test.ts` — authorized post-lock outcome correction and audit.

These tests characterize the shipped baseline. Later phases must update or add
tests only when the approved contract intentionally changes that baseline.
