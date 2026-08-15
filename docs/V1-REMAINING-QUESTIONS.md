# V1 remaining questions — take these to the team

Open items after the demo-tight V1. None of these block showing the four-core loop. They are the decisions and access that still live with Precon leadership, Lucy, or Eric.

Source notes: vault `Project — Precon Bid Schedule and Estimate Metrics`, `2026-08-04 Precon priority alignment with Greg Russ Keller and Brian Meyers`, `2026-08-05 Precon Smartsheet data structure walkthrough`, `2026-08-05 Precon bid-schedule SME and admin workflow`, `2026-08-06 Contract review and Precon prototype with Innovation`.

---

## Brian Meyers

1. **Print column set.** The consolidated regional PDF now includes Job #, Name, Owner, Division, Phase, Drawings Due, Bid Review, Bid Date, Procurement, Lead, Status, Bid Amount. Confirm that is the Monday leadership packet, or send the current emailed PDF to match order/abbreviations.
2. **Yellow vs optional promotions.** Extra regional columns (Florida Advent Health, Carolinas self-perform fee, Central Concrete Frame, Texas aging) stay custom. Which of those, if any, should become enterprise yellow? Lucy already suspects over-collection.
3. **Distribution lists.** Who receives the emailed bid schedule today, and on what cadence? Outbox + PDF exist; live SMTP waits on IT.
4. **Outcome values.** The app uses Pending / Successful / Unsuccessful. Brian still re-ties one later field by hand (transcript: “MISTI”). Confirm those three values are enough, or if “advanced / moved” needs its own outcome.
5. **Follow-up document.** Brian offered another written packet after the Smartsheet walkthrough. Fold it in when it lands.

## Michael Keller

1. **SME group.** Ask who he endorses as the governing board. Proposed: Brian Meyers + Jay McDaniels + a high-volume form-filler (Kelsey or equivalent) + P&D (Lucy/Eva). Do not staff it only with people who never fill the yellow fields.
2. **November vs January.** Room already split this: November = web prototype ready; ~January 2027 = enterprise flip + 2026 load. Confirm he still wants that split, and that this demo is the November bar, not a Monday cutover.
3. **Regional extras.** Florida / Carolinas / Texas local columns stay local. Confirm he is fine leaving them out of V1 lock gates.

## Lucy Mikels

1. **Power BI parity.** Dual analytics stays: RPDs in this tool, DMs / fourth floor on Power BI, **same numbers**. After Eric has the Databricks feed, which headline metrics must match her current estimate-metrics sheet (fee %, successful volume, hit rate, fee per PM month)?
2. **Metrics capture formulas.** Admin → Migration reports which calculated columns reproduce from migrated data. Need her eyes on the corporate 2026 Estimate Metrics Capture sheet vs `src/lib/metrics.ts`.
3. **Admin packet recon.** Nashville Addison, Texas, Carolinas, Allison Crabtree, Lucy pre-fill. V1 still supports Destini CSV + human. Confirm we should not automate the hunt for yellow fields that are not in Destini.
4. **Business Strategy Values / Project Planning Precon Engagement.** Appear in Destini markup without a reliable list. App currently uses a short fallback list / free text. Need her definitions.

## Eric Nguyen / Jack Turner

1. **Salesforce in Databricks.** Shape of opportunity → job number, stage (prospect / tracking / active), join key to this app.
2. **Destini estimate-phase tag.** Analytics that sum every pricing round double-count. V1 dashboards default to **one latest/final round per job**. Long-term we still need a Destini dropdown (conceptual / final / …), not a free-text field.
3. **Smartsheet ↔ warehouse join key.** New in-app jobs can carry a field map. Existing rows do not magically join.
4. **Databricks write-back.** Feed is built and credential-gated. `DATABRICKS_ALLOW_WRITE` stays **false** until IT approves.
5. **DMR feed.** Greg wants DMR vs Precon side by side later. Do not treat the in-app DMR upload as the official feed.

## Innovation / Harrison (do not reopen in the demo)

1. **Official project start stays Salesforce.** In-app ROM (`TBD-…`, unlinked) is allowed. Free-create that later “reconciles by name” is rejected.
2. **Resource planning stays out of V1.** Magnet Workforce owns that path.
3. **Lowery Precon App is not this product.** Estimator side sheets, not post-bid collection.

## Not asking the room (already decided)

- Keep Smartsheet as system of record through 2026.
- V1 = bid schedule + post-bid yellow capture + company-systems story + visualization.
- Do not mint a second official project PK.
- Do not start Gantt / Magnet / Launch / SubDB / line-item Destini lake as Robert builds in this meeting.
