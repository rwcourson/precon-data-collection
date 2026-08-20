# Roadmap — shipped V1 baseline and current direction

The Aug. 4 leadership ask established the shipped V1 baseline: preserve the
working Smartsheet process, move it to a web tool, reduce entry friction, and
prepare summary data for Databricks.

The [RPD Roundtable product contract](docs/rpd-roundtable-product-contract.md)
is the canonical direction after 2026-08-19. It supersedes old V1 scope
exclusions where they conflict. Same-data schedule Gantt, lock revisions, and
locked-only Databricks publication software are **in the tree behind rollout
flags**. Lucy frozen-fixture, Production Smartsheet dump, live warehouse MERGE,
and Power BI parity remain **unsigned owner gates**. Lowery's separate staffing,
equipment, crew, and rates application is still a different product.

Statuses below describe the V1 baseline only: **Built** (in the V1 demo) ·
**Partial** · **Later**. They are historical. New work follows
[docs/rpd-roundtable-product-contract.md](docs/rpd-roundtable-product-contract.md)
and the phased checklists in
[docs/checklists/roundtable-phases.md](docs/checklists/roundtable-phases.md).

---

## V1 — what this demo must do

| # | Requirement | Status |
|---|---|---|
| A1 | Three buckets (upcoming / active / outstanding); instant status move | **Built** |
| A2 | Owner, Drawings Due, Bid Review on import and on the live schedule | **Built** |
| A3 | Group / sort the live schedule (sector, phase, bid date, division) | **Built** |
| A4 | ROM with no job number (`TBD-…`, unlinked); Salesforce lookup first | **Built** |
| A5 | Multiple estimate rounds per job | **Built** |
| B1 | Yellow required fields block RPD lock and name the labels | **Built** |
| B2 | Optional / region custom columns do not block lock | **Built** |
| B3 | Post-lock **outcome** update + audit | **Built** |
| D1 | Consolidated regional bid-schedule PDF with those operational columns | **Built** |
| E1 | Leadership dashboards default to **one latest/final round per job** | **Built** |
| E2 | Dual fee (back page vs expected); Power BI stays for DMs | **Built** |
| F1 | Default identity: Central RPD **Brian Meyers** | **Built** |

Jay McDaniel follow-ups are **Built** (see below) and documented in
[docs/jay-mcdaniel-upgrades.md](docs/jay-mcdaniel-upgrades.md). Post-bid
finalizes through the
[ADR-002 seam](docs/adr/002-post-bid-finalize-seam.md). Versioned lock revisions
and the publication outbox are implemented behind `lockRevisions` /
`warehousePublication` ([ADR-006](docs/adr/006-versioned-lock-revisions-and-publication-outbox.md),
[ADR-007](docs/adr/007-locked-only-databricks-publication.md)); live MERGE and
Power BI parity stay fail-closed until signed. Hosting:
[docs/github-and-vercel.md](docs/github-and-vercel.md). Docs index:
[docs/README.md](docs/README.md).

**V1 demo nav (historical):** Overview, Bid Schedule, Post-Bid, Dashboards,
Reports. Roundtable chrome (`roleChrome`) trims PCM/lead to Overview, Bid
Schedule, and Post-Bid. Do not restore Dashboards/Reports/Copilot into PCM
primary nav.

### Jay McDaniel add-now (2026-08-14) — Built

| # | Requirement | Status |
|---|---|---|
| J1 | Kernel-only authorization + new capabilities | **Built** |
| J2 | Multi-region job visibility + person pins | **Built** |
| J3 | Regions editor + duplicate warn-and-adopt | **Built** |
| J4 | Hierarchical region → `preconDepartment` filter | **Built** |
| J5 | Effort notes + attachments (no project-level, no private) | **Built** |
| J6 | `@[userId]` mentions + in-app notifications | **Built** |
| J7 | Explicit team-assigned + Needs staffing queue | **Built** |
| J8 | Print wrap + latest-note column | **Built** |
| J9 | Post-bid queue chips + region custom tab + `finalizeRound()` | **Built** |
| J10 | Server per-user columns; named view wins | **Built** |
| J11 | Standard dashboards + owner report schedules | **Built** |
| J12 | Eve copilot at `/copilot` (Magnus fallback) | **Built** |

---

## Historical V1 exclusions

These statements describe what is not in the **shipped V1 baseline**. They are
not permanent product exclusions; the canonical roundtable contract governs
future work.

- Same-data Gantt is implemented in Phase 5 (`scheduleModes`); requirement 14.9
  also preserves a resource-management date seam. Automatic people/resource
  sliding is not planned.
- Lowery Precon App (staffing Gantt, equipment, crew, rates)
- Post-bid *checklist* (Egnyte, BuildingConnected soft awards, retrospectives)
- Live Salesforce / Connect credentials remain an operational dependency;
  suggestion-first Salesforce software is in the tree (`salesforceSuggestions`).
  Locked-only Databricks publication software is in the tree; live MERGE is
  unsigned.
- Live SMTP remains an operational integration, with the outbox as the current
  fallback.
- Destini unique conceptual-vs-final tag (dashboard default is the V1 mitigation)
- Promoting or deleting enterprise yellow fields (Brian / Lucy decision)
- iOS / Expo as a demo surface
- Official project create (Salesforce remains the PK)

---

## After the demo (still open)

See [docs/V1-REMAINING-QUESTIONS.md](docs/V1-REMAINING-QUESTIONS.md).

1. Brian: print column order, yellow promotions, distribution lists, outcome vocabulary.
2. Keller: SME group, November vs January flip.
3. Lucy: Power BI parity metrics, Destini list definitions.
4. Eric / Jack: Salesforce-in-Databricks, Destini phase dropdown, join key, DMR feed.
5. IT: SSO Preview-env parity, SMTP/Resend, rotate tokens that were pasted in chat, Vercel guest access for the demo URL. Blob for attachments is provisioned (2026-08-20). See [docs/github-and-vercel.md](docs/github-and-vercel.md).

---

## Later waves (do not grow the demo)

This is the historical V1 follow-up list. Phase assignments and deferred
decisions now live in the
[RPD Roundtable product contract](docs/rpd-roundtable-product-contract.md).

- Soft-delete / trash wired on every grid (tables exist; not the demo path)
- Live Connect REST + 24h Salesforce sweep
- Trusted Destini file preview/confirm is implemented behind `sourceIngestion`;
  live SQL/API versus next-day transport remains deferred.
- Locked-only Databricks publication software is implemented behind
  `warehousePublication`. Live MERGE and Power BI parity stay unsigned
  (`pnpm ops:signoff-status`).
- Email distribution with real PDF bytes + Resend (schedules enqueue the outbox today)
- Self-service dashboard studio / forecast / DMR upload (already built, demoted)
- Durable Eve host on Vercel (production `/copilot` uses Magnus until then)
- Preview-env SSO parity (Production has Entra; Preview does not — see github-and-vercel.md)

---

## Verify

```bash
pnpm test
pnpm run docs:check
pnpm run db:migrate:check
pnpm run smoke:isolated
pnpm run verify:web
```
