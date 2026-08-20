# Documentation

Canonical guides for the B&G Precon data-collection app. Start here; do not treat chat transcripts as source of truth.

## Product

| Doc | What it is |
| --- | --- |
| [rpd-roundtable-product-contract.md](rpd-roundtable-product-contract.md) | **Canonical post–Aug. 19 product contract**: source precedence, requirement dispositions, and Phases 0–16 |
| [checklists/roundtable-phases.md](checklists/roundtable-phases.md) | Per-phase flags, evidence, and rollback |
| [checklists/roundtable-exit-audit.md](checklists/roundtable-exit-audit.md) | Requirement-by-requirement plan-exit evidence (software vs unsigned owner gates) |
| [checklists/operational-signoff.md](checklists/operational-signoff.md) | Lucy / Power BI / Smartsheet / Databricks fail-closed owner gates |
| [mocks/nested-self-perform.md](mocks/nested-self-perform.md) | Nested self-perform card mock only — no schema |
| [roundtable-rollback.md](roundtable-rollback.md) | Flag, deploy, schema, PITR, and warehouse kill-switch |
| [../README.md](../README.md) | What the app is, quick start, demo script, stack |
| [../ROADMAP.md](../ROADMAP.md) | Shipped V1 baseline and pointers to the current roundtable direction |
| [jay-mcdaniel-upgrades.md](jay-mcdaniel-upgrades.md) | Shipped 2026-08-14 visibility, notes, staffing, reports, and copilot baseline |
| [V1-REMAINING-QUESTIONS.md](V1-REMAINING-QUESTIONS.md) | Open decisions for Brian, Keller, Lucy, Eric |

## Operations

| Doc | What it is |
| --- | --- |
| [github-and-vercel.md](github-and-vercel.md) | GitHub repo + Actions, Vercel project, env matrix, crons, preview vs production |
| [postgres-cutover.md](postgres-cutover.md) | Neon vs PGlite, migrate vs seed |
| [security/sso.md](security/sso.md) | Microsoft Entra + Better Auth |
| [security/sso-proxy-trust.md](security/sso-proxy-trust.md) | Legacy proxy headers (not the production path) |

## Authorization

| Doc | What it is |
| --- | --- |
| [security/role-capability-matrix.md](security/role-capability-matrix.md) | Role × capability (human-readable) |
| [security/legacy-authorization-inventory.md](security/legacy-authorization-inventory.md) | Kernel-only path + justified direct-ID loaders |

## APIs and AI

| Doc | What it is |
| --- | --- |
| [magnus-api.md](magnus-api.md) | Bearer tokens, Magnus stream, Eve copilot tools |
| [mcp.md](mcp.md) | Remote MCP server, OAuth scopes, admin runbook, client setup |
| [mobile-api.md](mobile-api.md) | `/api/v1/mobile` contract |

## Architecture decisions

| Doc | What it is |
| --- | --- |
| [data-connections.md](data-connections.md) | Mermaid map of every inbound / outbound system and the RPD-lock warehouse gate |
| [data-flows/index.html](data-flows/index.html) | Branded HTML explainer of the same map — open in a browser |
| [adr/001-incremental-scaffold-architecture.md](adr/001-incremental-scaffold-architecture.md) | Incremental scaffold |
| [adr/002-post-bid-finalize-seam.md](adr/002-post-bid-finalize-seam.md) | Current `finalizeRound()` lock-passthrough seam |
| [adr/003-canonical-one-job-schedule-projection.md](adr/003-canonical-one-job-schedule-projection.md) | Canonical one-job schedule read model |
| [adr/004-approval-requests-separate-from-round-status.md](adr/004-approval-requests-separate-from-round-status.md) | Create/edit proposals separate from lifecycle |
| [adr/005-organization-membership-vs-region-visibility.md](adr/005-organization-membership-vs-region-visibility.md) | Participation, access, staffing, and permission stay separate |
| [adr/006-versioned-lock-revisions-and-publication-outbox.md](adr/006-versioned-lock-revisions-and-publication-outbox.md) | Immutable lock revisions and asynchronous publication |
| [adr/007-locked-only-databricks-publication.md](adr/007-locked-only-databricks-publication.md) | Locked-only Databricks/external analytics boundary |

## Roundtable operations

| Doc | What it is |
| --- | --- |
| [roundtable-rollback.md](roundtable-rollback.md) | Flag off, previous deploy, dormant schema, Neon PITR, Smartsheet, warehouse kill switch |
| [roundtable-cohort-rollout.md](roundtable-cohort-rollout.md) | Canary, room pilot, schema freeze, warehouse, Smartsheet-off gates |
| [checklists/operational-signoff.md](checklists/operational-signoff.md) | Fail-closed owner gates; unsigned stays unsigned |
| [destini-adapter.md](destini-adapter.md) | File preview/confirm adapter; live SQL still deferred |
| [smartsheet-cutover.md](smartsheet-cutover.md) | Dump, checksum, reconcile, rollback rehearsal |
| [security/roundtable-review.md](security/roundtable-review.md) | Approvals, IDOR, imports, warehouse, external AI |

## Design

| Doc | What it is |
| --- | --- |
| [color-system.md](color-system.md) | Shared chart / UI tokens |
| [generated-documents.md](generated-documents.md) | B&G 2026 kit for PPTX and later Word/PDF |
| [../brand/README-SLIDESHOW.md](../brand/README-SLIDESHOW.md) | Slideshow brand kit (tokens, logos, fonts, guides) |

`pnpm run docs:check` fails the tree if required scripts or this index’s companion files are missing.
