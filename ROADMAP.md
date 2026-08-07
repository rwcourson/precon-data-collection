# Roadmap — B&G Precon Data Collection

Source: working session with **Bryan Meyers** (RPD, Central Region — running point on this
project), **Aug 7, 2026**. Bryan walked through the live Smartsheet system end to end. This
document extracts every requirement, nice-to-have, and open question from that meeting,
marks each against what is already built in this app, and orders the gaps into waves.

Statuses: **Built** (exists, validate with Bryan) · **Partial** (exists but misses part of
the ask) · **Missing** (not started).

---

## 1. How Bryan's system actually works (context worth keeping)

- **Regional ownership, corporate aggregation.** Each region controls its own data; approved
  data rolls up to a corporate database that a small group administers. Bryan's principle,
  verbatim: *"expose data to more people, but move it to the back end to be managed by a
  smaller group of people — and then give people the ability to report on that data."*
- **Three bid-schedule buckets:** **Upcoming** (planning, possibly partial info) → **Active**
  (being priced now; also the team-assignment view for his ~25 people) → **Outstanding**
  (submitted, awaiting outcome). The bid schedule is an assignment-level management tool,
  not a resource-management tool.
- **Job lifecycle vs Salesforce:** every job starts as a Salesforce opportunity
  (*prospect → tracking → active*); the job number only exists at *active*. Precon often
  prices work **before** a job number exists (ROMs on prospects) and needs that history
  stitched together once the number arrives: *"we want that history."*
- **Multiple estimate rounds per job number** at different design phases; one construction
  project per job number.
- **Field tiers on post-bid data:** *yellow* = enterprise-wide required, blocks advancement;
  *light blue* = agreed-optional (~50% fill); *custom* = region-added for local initiatives
  (e.g. "who won", QC marks). Column names and dropdowns are vetted and consistent across
  all regions.
- **Approval flow:** lead estimator (or their admin, often from a **Destini** export) fills
  post-bid data → RPD/SPD checks a "data is done" box → data lands in the regional metrics
  sheet **and** the corporate database in parallel. Lucy ingests corporate data into
  Power BI.
- **Why this data matters:** the DMR (division managers' report) is the conservative
  *bottom end* — managers hedge because they're scored on their prediction. Precon data is
  the objective *top end*. Bryan's static comparison showed the two differ by **hundreds of
  millions of dollars**. The company needs both curves.

---

## 2. Requirements from the meeting

### A. Bid schedule & workflow

| # | Requirement | Status | Notes |
|---|---|---|---|
| A1 | Three buckets (upcoming/active/outstanding) visible as groups; Active consolidated so it isn't "1,000 jobs" | **Built** | Status enum + sectioned bid schedule already match. Validate layout with Bryan. |
| A2 | Status change moves the job to the right bucket **automatically, instantly, placed correctly** — in Smartsheet it takes a refresh plus a manual cut-and-paste | **Built** | `transitionStatus` re-sections immediately. Confirm within-section ordering matches how he files rows. |
| A3 | Group and sort the **live** bid schedule by arbitrary fields — market sector, estimate phase, bid date, not just division | **Built** | Bid Schedule URL `groupBy` control + grouped section headers. |
| A4 | Manually add a job that has no job number yet (holding ground for jobs 6 months out), link to Salesforce later | **Built** | Manual pursuits get a `TBD-####` placeholder; link flow exists on the job page. |
| A5 | Multiple pricing rounds per job at different estimate phases; Excel-like flexibility to add a line | **Built** | `estimateRounds` 1→N per job with add-round dialog. |
| A6 | Track ROM-level pricing on prospects with no job number and **no charge code**, so "we priced a $10M job" is captured; keep the full history when the job number arrives | **Built** | ROM phase + link preserves job/round IDs (history). |
| A7 | Agreed minimum columns everywhere, with freedom to add more per region | **Built** | Global field defs + region custom columns (EAV) already work this way. |

### B. Post-bid collection & governance

| # | Requirement | Status | Notes |
|---|---|---|---|
| B1 | Required (yellow) fields block advancement; typed validation ("you can't put zero in for the bid date — you have to put a date in") | **Built** | Lock gate + typed field validation exist. |
| B2 | Optional (light blue) tier and region custom columns | **Built** | Matches Bryan's model: only the required tier gates the lock. |
| B3 | RPD/SPD approval step that promotes data to regional rollup + corporate | **Built** | Approve & Lock + SPD label/SSO alias. |
| B4 | Edits should never need making in two places; the **outcome** (won/lost, moved forward) changes a month or two after submission and today must be manually re-keyed into corporate | **Built** (by architecture) | One database, so a fix lands everywhere. Validate the post-lock outcome-update flow with Bryan — it's the single edit he makes most. |
| B5 | Decide which of the corporate sheet's "gaps and trash" columns (inconsistent region-collected fields) become standard — balance value vs. the cost of asking 100 data points per job | **Partial** | Promote affordance built (Admin → Promotions). Which columns to promote remains a Bryan/precon-group decision. |

### C. Permissions, safety, and trust (explicit gaps in Smartsheet)

| # | Requirement | Status | Notes |
|---|---|---|---|
| C1 | Real permission levels instead of "mostly through discipline" — scoped access (admin / edit / view), and Bryan alone on the corporate sheet | **Built** | Field write policy + sheet ACL (`src/lib/policy.ts`). |
| C2 | Recover deleted data — Smartsheet has nothing beyond undo; a deleted sheet is gone. "The more people we get into this, the higher the risk" | **Built** | Soft delete, `/trash`, entity versions, checksummed snapshots. |
| C3 | Safe surface for AI/agent access — Bryan's fear: tools (incl. Magnus) reading/writing Smartsheet directly, "oops, I accidentally deleted that." "How do you provision the data?" is a blind spot today | **Built** | Scoped API tokens, destructive challenges, audit; see `docs/magnus-api.md`. |
| C4 | Audit trail of who changed what | **Built** | Status transitions + post-lock field diffs + admin audit tab. |

### D. Reporting & communication (the loudest pain in the meeting)

| # | Requirement | Status | Notes |
|---|---|---|---|
| D1 | Print-first PDF reports: pick columns, group, sort, and get a legible one-page-per-section PDF — in Smartsheet he abbreviates division names and hides columns just to make print fit, and reports "don't like to sort and group" | **Built / validate** | Engine ready; Bryan UAT on real column set still needed. |
| D2 | Consolidated cross-sheet report — e.g. one Central-region list combining the four division bid schedules | **Built** | Seeded `consolidated_regional_bid_schedule` preset. |
| D3 | **Email distribution** of the bid schedule / reports as PDF — "not everybody that needs this information is coming to my app to find it. I don't have an external communication tool" | **Built** | Distribution lists + one-click/weekly cron; stub until SMTP. |
| D4 | Both output modes matter: visual dashboards **and** "traditional written summary" lists of job names | **Built** | Dashboards + report builder cover the split. |

### E. Dashboards & visualization

| # | Requirement | Status | Notes |
|---|---|---|---|
| E1 | Corporate-standard dashboards everyone sees (today's Power BI role) | **Built** | Corporate/Region/Division dashboards exist. |
| E2 | **Self-service dashboards** — "I can make it myself and I don't need an expert." Each region is a big business and needs its own visualizations, with a place to host them | **Built** | `/dashboards/studio` personal/region/corporate. |
| E3 | Consistent graphics suitable for communicating upward | **Built** | Shared chart components + studio widgets. |
| E4 | **Slide export** — today he screenshots charts into PowerPoint. Asked if export-to-slides would help: *"that would be excellent"* | **Built** | `/api/export/pptx` 16:9 forecast deck. |
| E5 | "AI is UI" — generated views/dashboards from the clean schema (the Power BI-replacement idea) | **Built (stub)** | Suggest-view API; human must review/save. |

### F. Integrations & data flow

| # | Requirement | Status | Notes |
|---|---|---|---|
| F1 | **Salesforce inbound**: pull opportunities/jobs so names and numbers are consistent, but keep the ability to flex (manual adds must survive). Today "there is no funnel coming in" | **Partial** | Sync loop + mock provider built; live REST still needs IT. |
| F2 | **Match inbox**: every ~24h, sweep Salesforce, propose links/discrepancies, and let a human go "yes / no / link" — the Chambliss King pattern discussed and agreed as a good option | **Built** | Admin → Salesforce Inbox (approve/reject/dismiss). |
| F3 | **Magnus integration** — ask questions of this data from Magnus chat, or push a report into Magnus | **Partial** | Scoped API + contract (`docs/magnus-api.md`); product wiring with Magnus TBD. |
| F4 | **Databricks outbound** so the analytics team can compare precon data to other business data (per Greg) | **Built** (credential-gated) | Feed + cron + admin panel exist; blocked on credentials from Eric/IT. |
| F5 | Estimating-software imports — post-bid values often arrive as a Destini (or other) Excel export handed to an admin | **Built** | Destini CSV → round field mapping in Admin. |

### G. Analytics & forecasting (corporate value)

| # | Requirement | Status | Notes |
|---|---|---|---|
| G1 | Projection curves: precon volume over time at 100%-win ("blue curve") vs risk-adjusted ("green curve" — start-date slip, win probability) | **Built** | `/dashboards/forecast` + PPTX export. |
| G2 | DMR reconciliation: line up DMR vs precon by job number and show the delta (today a static plug-in; the gap is hundreds of $M) | **Built** | Upload path at `/dashboards/reconciliation`; live Databricks DMR still needs Eric. |
| G3 | Capture both the objective number and the adjusted number (Bryan's time-cards analogy: don't train people to enter the wrong data) | **Principle** | Keep raw entries and derived/adjusted metrics separate in anything we add. |

### H. Explicitly discussed, deliberately deferred

- **Gantt / resource planning / scenario templates** — "that's a little bit what Smartsheet
  can do, it's just clunky." Not asked for; the bid schedule is assignment-level only.
  Revisit only if Bryan raises it.
- **Company sheet templates** — none exist beyond the system sheets themselves; our seeded
  workspace already plays that role. Ability to create new sheets (exists) is sufficient.

---

## 3. Roadmap

### Wave 1 — before the next Bryan meeting (~2 weeks): demo-critical

1. **Group-by on the live bid schedule** (A3): market sector, estimate phase, bid date,
   division — reusing the Sheets grouping machinery.
2. **"Consolidated regional bid schedule" report preset + print validation** (D1, D2):
   prove the grouped, legible PDF with Bryan's real columns; no abbreviation gymnastics.
3. **Email a report/PDF to a distribution list** (D3): one-click send + optional weekly
   schedule; outbox-stubbed until SMTP creds arrive.
4. **Salesforce match inbox** (F2): 24-hour sweep, propose/approve/reject/link queue,
   discrepancy flags as opportunities evolve — mock provider is fine for the demo.
5. **SPD title + outcome-update validation** (B3, B4): small, but they're the exact edits
   Bryan makes weekly.
6. **ROM/prospect history check** (A6): confirm phase values and that linking preserves
   round history.

### Wave 2 — trust & safety (the adoption blockers vs. Smartsheet)

7. **Soft delete + trash/restore everywhere; version history on rounds and grid rows;
   scheduled snapshots** (C2).
8. **Field-level write permissions and per-sheet access scoping** (C1) — corporate sheet
   locked to its administrators.
9. **Scoped API access for agents/integrations** (C3): read-only default tokens,
   destructive-op guardrails, API writes in the audit log. Prerequisite for Magnus.

### Wave 3 — self-service analytics (the Power BI replacement)

10. **Dashboard builder** (E2): saved dashboards at personal/region/corporate scope,
    widgets driven by saved reports.
11. **Slide export** (E4): dashboard → PPTX / 16:9 chart images.
12. **Projection curves** (G1): 100%-win vs risk-adjusted volume over time.

### Wave 4 — corporate intelligence & external systems

13. **DMR reconciliation module** (G2) — after Eric confirms the DMR feed.
14. **Live Databricks + Salesforce credentials** (F4, F1) — IT-dependent; code paths ready.
15. **Destini post-bid import mapping** (F5).
16. **Magnus query/report integration** (F3); explore "AI is UI" generated views (E5).

---

## 4. Nice-to-haves (as Bryan reacted to them)

- **Slide/PPT export** — "that would be excellent" (scheduled: Wave 3).
- **Magnus chat access to this data** — "yeah, something like that" (Wave 4).
- Auto-placement niceties when a job changes bucket — "is it a big deal? No, but it
  certainly could be automated" (already ours by default).

## 5. Open questions for Bryan

1. **Salesforce access & shape** — Bryan is checking how Salesforce is set up; we need API
   access and the opportunity-stage field mapping (prospect/tracking/active).
2. **DMR data source** — talk to **Eric** (Databricks) about ingesting the DMR for G2, and
   about warehouse credentials for F4.
3. **Which optional/custom columns get promoted to standard** (B5) — a precon-group
   decision; our needs-review data can inform it.
4. **Report distribution lists** — who receives the emailed bid schedule today, and on what
   cadence? (Also settles the open notification-cadence question from the sponsor doc.)
5. **Metrics capture sheet** — still to confirm with Bryan (carried over from the sponsor
   open-questions list).
6. **Analytics team name** — transcript reads "FIATs team"; confirm (FP&A?) before it
   appears in any deliverable.

## 6. Follow-ups from the meeting

- Bryan is **sending an additional document** — fold it into this roadmap when it lands.
- Review **Jay's build** for anything it covers that this app doesn't; take the best parts.
- Send Bryan a **link to this app** so he can click through before the next session.
- Next working session in **~2 weeks**, with a wider group ("what about this from me or
  somebody else").
