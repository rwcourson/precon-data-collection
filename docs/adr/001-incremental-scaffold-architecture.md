# ADR-001: Incremental scaffold architecture (no wholesale rewrite)

**Status:** Accepted  
**Date:** 2026-08-07  
**Update (2026-08-18):** the repo is now a pnpm workspace (root + `apps/mobile`) with Biome lint. Turborepo and tRPC remain deferred.  
**Context:** B&G Precon Data Collection prototype vs `bg-new-scaffold`

## Decision

Keep the current single-package Next.js app. Adopt the scaffold’s durable
boundaries **inside `src/`** as we ship roadmap features. Defer pnpm/Turborepo,
tRPC, Better Auth, Redis, and Vercel Blob until a concrete production need
appears.

## Current → future map

| Concern | Today | Near-term (this run) | Later (production) |
|---|---|---|---|
| App shell | `src/app` | unchanged | `apps/web` if a second host appears |
| Mutations | `src/actions` | thin wrappers over services | optional tRPC for agent/API surface |
| Domain | `src/lib/*` | `src/domain` + `src/services` + `src/repos` | `@bg/services` |
| Schema / DB | `src/db` + PGlite + `db:push` | additive schema; keep push for demo | Postgres/Neon + `drizzle-kit generate/migrate` |
| Auth | demo cookie + SSO headers | keep SSO seam | same; branded session user into services |
| Errors | `throw new Error` | `DomainError { what, why, solution }` | map at HTTP/tRPC boundary |
| Integrations | Connect / email / Databricks adapters | same port pattern | private storage adapter when attachments need it |
| Packages | npm single app | npm single app | pnpm + Turbo only when sharing packages |

## Dependency direction (enforced by convention)

```
UI / route handlers / server actions
        ↓
domain services (constructor DI, PortDeps)
        ↓
repository + integration adapters
        ↓
Drizzle / vendor SDKs
```

Rules:

1. Services never import React or UI components.
2. New public contracts use Zod (`src/domain/contracts.ts`).
3. Vendor SDKs stay behind adapters under `src/lib/integrations/*`.
4. Authorization decisions centralize over time in policy helpers/services —
   actions must not invent one-off role checks for new surfaces.

## Explicitly deferred

- Full monorepo migration
- Replacing server actions with tRPC for forms UI
- Better Auth / Passport as primary identity (B&G uses proxy SSO)
- Redis
- Object storage until report PDFs / snapshots need a private bucket

## Consequences

- Roadmap features can ship without a rewrite.
- Production cutover has a written path (Postgres + migrations + storage).
- Agent/Magnus API (roadmap C3) can sit on the same service layer later.
