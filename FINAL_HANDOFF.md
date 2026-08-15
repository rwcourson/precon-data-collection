# V1 handoff — demo-tight status (2026-08-15)

**Verdict:** The four-core V1 loop is the product. Extra surfaces (Sheets, Studio, Forecast, Magnus, iOS) still exist but are demoted so the leadership demo does not become a cathedral tour.

**Live:** https://precon.brasfieldgorrie.app · https://precon-data.magnus.brasfieldgorrie.app
**GitHub:** https://github.com/rwcourson/precon-data-collection
**DB:** Neon (`DATABASE_URL` on Vercel + local `.env.local`)

---

## V1 that should impress Greg / Keller / Brian

- Bid schedule shows **Owner**, **Drawings Due**, **Bid Review** from the Smartsheet parser (not blank after a representative export parse).
- Default user is **Brian Meyers** (Central RPD). Role switcher is “view as,” not “demo persona.”
- Status moves among upcoming / active / outstanding / submitted.
- Second estimate round on the same job.
- Yellow blanks block RPD lock and name the missing labels (`Fee – Expected $`, etc.). Owner is **not** a lock gate.
- Post-lock outcome change is persisted and audited.
- Dashboards default to **one latest/final round per job**; “All pricing rounds” is explicit.
- New Pursuit is Salesforce-first; **No job number yet (ROM)** stays unlinked as `TBD-…`.
- Consolidated regional export includes those operational columns.
- Nav: Overview, Bid Schedule, Post-Bid, Dashboards, Reports.

Open questions for the room: [docs/V1-REMAINING-QUESTIONS.md](docs/V1-REMAINING-QUESTIONS.md).

---

## Ops before you send the link

1. **Rotate the Neon password** — it was pasted into chat; treat as exposed.
2. **Vercel Deployment Protection** — invite Brian / Keller / Greg or relax for the demo.
3. Do **not** set `DATABRICKS_ALLOW_WRITE=true`.
4. Leave `AUTH_MODE=demo` for the room unless SSO is already mapped.
5. **Neon schema:** run `npm run db:migrate:deploy` so `estimate_rounds.owner` exists, then `npm run db:import-smartsheet` if you want the hosted dataset to carry Owner / Drawings Due / Bid Review. Parser is shipped; a full Neon rewrite is ops, not required for unit proof.

---

## Deliberately not V1

- Gantt / resource planning
- Lowery Precon App
- Live Salesforce, live email, Databricks write
- Magnus copilot as a first-class nav item
- Cleaning all ~1,058 imported rounds
- Changing the Obsidian vault

---

## Verify

```bash
npm test
npm run docs:check
npm run smoke:isolated
npm run verify:web
```
