# Documentation

Canonical guides for the B&G Precon data-collection app. Start here; do not treat chat transcripts as source of truth.

## Product

| Doc | What it is |
| --- | --- |
| [../README.md](../README.md) | What the app is, quick start, demo script, stack |
| [../ROADMAP.md](../ROADMAP.md) | V1 requirements vs later waves |
| [jay-mcdaniel-upgrades.md](jay-mcdaniel-upgrades.md) | Visibility, notes, staffing, reports, copilot — shipped after the 2026-08-14 meeting |
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
| [mobile-api.md](mobile-api.md) | `/api/v1/mobile` contract |

## Architecture decisions

| Doc | What it is |
| --- | --- |
| [adr/001-incremental-scaffold-architecture.md](adr/001-incremental-scaffold-architecture.md) | Incremental scaffold |
| [adr/002-post-bid-finalize-seam.md](adr/002-post-bid-finalize-seam.md) | `finalizeRound()` — lock vs Databricks still open |

## Design

| Doc | What it is |
| --- | --- |
| [color-system.md](color-system.md) | Shared chart / UI tokens |

`npm run docs:check` fails the tree if required scripts or this index’s companion files are missing.
