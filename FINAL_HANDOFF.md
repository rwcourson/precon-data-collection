# Final handoff — honest status (2026-08-07)

**Verdict: not industry-leading / not debt-free.** Neon is wired for persistence.
Demo is live; several roadmap trust/distribution paths remain incomplete.

**Live:** https://precon.brasfieldgorrie.app · https://precon-data.magnus.brasfieldgorrie.app  
**GitHub:** https://github.com/rwcourson/precon-data-collection  
**DB:** Neon (`DATABASE_URL` on Vercel + local `.env.local`)

---

## Done for Neon / deploy

- [x] App uses Neon when `DATABASE_URL` is set (`postgres.js`, `prepare: false`)
- [x] Schema migrated + demo seed (6 users, 108 rounds)
- [x] Env vars on Vercel (Neon integration + refreshed URLs)
- [x] Local `.env.local` (gitignored)

---

## What still needs to be done

### You (ops / IT / Bryan)

1. **Rotate the Neon password** — it was pasted into chat; treat as exposed.
2. **Vercel Deployment Protection / SSO** — `precon.brasfieldgorrie.app` may require Vercel login; invite Bryan or relax protection for the demo.
3. **SMTP / Resend** — `RESEND_API_KEY`, `EMAIL_FROM`, Bryan’s distribution lists.
4. **Salesforce / Connect** — API access, stages, `CONNECT_MODE=rest` + `CONNECT_API_URL`.
5. **Databricks** — warehouse creds; confirm DMR feed vs CSV-only.
6. **SSO cutover** — `AUTH_MODE=sso`, IdP headers, SPD→RPD group map (leave demo cookie for now).
7. **Cron** — set `CRON_SECRET` and schedule reminders / SF sync / distribution / snapshots.
8. **Object storage** — PDFs/snapshots (today local/stub).
9. **Bryan decisions** — columns to promote, PDF column set, forecast defaults, metrics sheet, analytics team name.
10. **Share link** with Bryan; fold his follow-up doc; review Jay’s build.
11. **Optional:** transfer GitHub repo to `BG-Innovation` when you have create rights.

### Product debt (code — not “done”)

1. Wire soft-delete into normal delete UI (Trash is mostly empty today; grid still hard-deletes).
2. Enforce field/sheet ACL policy on main write paths (tables exist, mostly unused).
3. Real PDF bytes on email distribution (currently filename metadata + stub SMTP).
4. Headless cron without `getCurrentUser()` cookie.
5. Restorable snapshots (today count-only manifests).
6. Version history UI / grid-row versions.
7. Destructive API that consumes the challenge token.
8. Broader PPTX (full dashboard) and real AI suggest (not keyword stub).
9. Thin test suite — not a production safety net.

### Deliberately deferred

- Gantt / resource planning  
- Full Magnus product wiring beyond the scoped read API  

---

## Solid enough to demo now

Bid schedule + group-by, post-bid lock/SPD, reports/dashboards/forecast, Destini import, mock SF inbox (manual), Neon-backed persistence across deploys.
