# Roadmap — B&G Precon Data Collection V1

Leadership ask (Greg / Michael Keller / Brian Meyers, 2026-08-04): preserve the working Smartsheet, move it to a web tool, reduce entry friction, get summary data to Databricks. V1 is **schedule + post-bid capture + company systems + visualization**. Resource planning, Jay’s Gantt, and Lowery’s Precon App are not this product.

Statuses: **Built** (in the V1 demo) · **Partial** · **Later**.

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

Primary nav is Overview, Bid Schedule, Post-Bid, Dashboards, Reports. Sheets / Studio / Forecast / DMR / Copilot are under **More**.

Jay McDaniel follow-ups are **Built** (see below) and documented in [docs/jay-mcdaniel-upgrades.md](docs/jay-mcdaniel-upgrades.md). Post-bid finalize stays a seam: [docs/adr/002-post-bid-finalize-seam.md](docs/adr/002-post-bid-finalize-seam.md). Hosting: [docs/github-and-vercel.md](docs/github-and-vercel.md). Docs index: [docs/README.md](docs/README.md).

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

## Explicitly out of V1

- Gantt / resource planning (Magnet Workforce)
- Lowery Precon App (staffing Gantt, equipment, crew, rates)
- Post-bid *checklist* (Egnyte, BuildingConnected soft awards, retrospectives)
- Live Salesforce / Connect, live SMTP, Databricks write-back
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
5. IT: SSO Preview-env parity, SMTP/Resend, Blob for attachments, rotate tokens that were pasted in chat, Vercel guest access for the demo URL. See [docs/github-and-vercel.md](docs/github-and-vercel.md).

---

## Later waves (do not grow the demo)

- Soft-delete / trash wired on every grid (tables exist; not the demo path)
- Live Connect REST + 24h Salesforce sweep
- Destini CSV mapping polish + required estimate-phase dropdown in Destini
- Databricks outbound once Eric approves write
- Email distribution with real PDF bytes + Resend (schedules enqueue the outbox today)
- Self-service dashboard studio / forecast / DMR upload (already built, demoted)
- Durable Eve host on Vercel (production `/copilot` uses Magnus until then)
- Preview-env SSO parity (Production has Entra; Preview does not — see github-and-vercel.md)

---

## Verify

```bash
npm test
npm run docs:check
npm run db:migrate:check
npm run smoke:isolated
npm run verify:web
```
