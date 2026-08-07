# Final handoff — honest status (2026-08-07, re-audited)

**Verdict: not done. Not industry-leading. Not free of tech debt.**

The app is a strong **Bryan demo / prototype** with many roadmap surfaces present.
Trust, recovery, email distribution, and production adapters are incomplete or stubbed.
Earlier “all phases complete” language was overstated.

Verification now: `npm test` **61** pass · `tsc` / `lint` / `build` green (PGlite may abort
once during static generation and still finish).

---

## Honest roadmap status

| ID | Status | Reality |
|---|---|---|
| A1–A7 | **Mostly built** | Bid schedule buckets, group-by, ROM link history, multi-round — strongest area |
| B1–B4 | **Built** | Validation, lock, SPD label, one-DB outcome edits |
| B5 | **Partial** | Promote UI exists; Bryan still decides which columns |
| C1 | **Partial** | `policy.ts` + ACL tables exist; **not enforced** on main sheet/post-bid writes |
| C2 | **Partial** | Soft-delete helpers + `/trash` exist; **UI still hard-deletes** grid rows; trash rarely fills |
| C3 | **Partial** | Tokens + read API + challenge mint; **no mutating API that consumes the challenge** |
| C4 | **Built** | Audit log exists (not full version restore) |
| D1–D2 | **Built / needs UAT** | PDF engine + consolidated preset; Bryan column-set validation still needed |
| D3 | **Partial** | Distribution lists + outbox; **no real PDF bytes attached**; SMTP stub |
| D4, E1 | **Built** | Fixed dashboards + reports |
| E2–E3 | **Partial** | Studio works but is basic, not Power-BI-class |
| E4 | **Partial** | Forecast-only 3-slide PPTX, not full dashboard export |
| E5 | **Stub** | Keyword suggest-view, not LLM |
| F1–F2 | **Partial** | Mock inbox works; live SF + headless cron need work |
| F3 | **Partial** | API contract only; Magnus product wiring TBD |
| F4 | **External-blocked** | Code path ready; needs Databricks creds |
| F5 | **Built** | Destini CSV → round fields |
| G1 | **Built** | Forecast engine + page |
| G2 | **Partial** | CSV upload reconcile; live DMR feed needs Eric |
| G3 | **Principle followed** | in forecast/DMR |

---

## Critical in-code gaps (not “your” problems — product debt)

1. Soft-delete actions are **not wired** into normal delete UI; grid rows still `db.delete`.
2. Field/sheet ACL tables are mostly **unenforced** on primary mutation paths.
3. Email distribution queues **filename metadata**, not generated PDF attachments.
4. Salesforce / distribution **cron** paths call `getCurrentUser()` (broken headless).
5. Snapshots store **counts**, not restorable row payloads.
6. No version history/restore UI; grid rows not versioned.
7. DB runtime is still **PGlite-only** (cutover documented, not implemented).
8. Test suite is thin unit coverage — not a regression safety net.

---

## What you need to handle

### External / credentials / IT
1. **Salesforce / Connect** — API access, opportunity stages, `CONNECT_MODE=rest`.
2. **Email** — Resend/SMTP (`RESEND_API_KEY`, `EMAIL_FROM`) + Bryan’s real distribution lists/cadence.
3. **Databricks** — warehouse credentials (Eric/IT); confirm whether DMR is reachable.
4. **SSO** — IdP group → role/region map including SPD→RPD; cut over from demo cookie auth.
5. **Production Postgres** + backups/PITR + object storage for PDFs/snapshots.
6. **Deploy + cron** — host, `CRON_SECRET`, scheduled jobs for reminders/SF/distribution/snapshots.
7. **Destini** — one or more real export workbooks for mapping UAT.
8. **Magnus** — decide read-only vs write; product integration beyond the API contract.

### Bryan / precon decisions
9. Which region columns become company standard (B5).
10. Real PDF column set for print UAT (D1).
11. Forecast assumptions (win % / schedule slip) for leadership demos.
12. Metrics capture sheet confirmation; analytics team name (“FIATs”?).
13. Fold Bryan’s follow-up document into the roadmap when it lands.
14. Review Jay’s build for anything we still miss.
15. Send Bryan the app link before the next session.

### Repo / process
16. **First git commit** (repo still has none) — author must be `rwcourson`.
17. Decide whether to prioritize fixing the critical in-code gaps above before the next Bryan meeting.

---

## What is solid enough to demo today

- Bid schedule lifecycle + live group-by
- Manual TBD pursuits + Salesforce link (mock)
- Post-bid required/optional fields + RPD/SPD approve & lock + outcome edits
- Sheets, report builder, fixed dashboards, forecast curves
- Admin: promotions queue, SF inbox (manual), Destini paste-import, token minting (read path)
- Dark mode without next-themes console error

Do **not** demo trash/recovery, emailed PDFs, Magnus writes, or “production-ready ACL” as finished.
