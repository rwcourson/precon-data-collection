/**
 * Import downloaded Smartsheet JSON from data/smartsheet/json into PGlite,
 * replacing demo jobs / estimate rounds. Default identity is Brian Meyers (Central RPD).
 *
 * Run (server stopped): pnpm run db:import-smartsheet
 */

import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { syncDataQualityFlags } from "../lib/data-quality-sync";
import { DEFAULT_DEMO_RPD } from "../lib/demo-identity";
import {
  mergeSmartsheetDrafts,
  parseSmartsheetRound,
  type SmartsheetRoundDraft,
  smartsheetRowToCells,
} from "../lib/integrations/smartsheet/parse";
import { IMPORT_SOURCE_KEY } from "../lib/migration-source";
import { REFERENCE_LISTS } from "../lib/reference-data";
import {
  consolidatedRegionalReportInsert,
  upcomingBidScheduleReportInsert,
} from "../lib/report-presets";
import { db } from "./index";
import {
  appSettings,
  auditLog,
  customColumns,
  customColumnValues,
  dataQualityFlags,
  emailOutbox,
  estimateRounds,
  jobs,
  notifications,
  referenceLists,
  referenceListValues,
  reportTemplates,
  roundMultiValues,
  salesforceJobs,
  savedReports,
  sheetColumns,
  sheetPins,
  sheetRows,
  sheets,
  statusTransitions,
  users,
} from "./schema";
import { seedSheetsFromExport } from "./seed-sheets";

const DATA_DIR = path.join(process.cwd(), "data/smartsheet/json");

/**
 * Legacy sheets carry no submitted timestamp. Dating these rows from the bid
 * due date (or mid-bid-year as a fallback) keeps the reminder cadence honest —
 * stamping them with the import time would make every migrated round look like
 * it was submitted today.
 */
function submittedStamp(bidDueDate: string | null, bidYear: number): Date {
  const now = new Date();
  const from = bidDueDate
    ? new Date(`${bidDueDate}T15:00:00`)
    : new Date(`${bidYear}-06-30T15:00:00`);
  if (Number.isNaN(from.getTime()) || from > now) return now;
  return from;
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`Missing ${DATA_DIR}. Download Smartsheet export first.`);
  }

  console.log("Clearing existing app data…");
  // Sheets reference users, so they have to go before the personas are replaced.
  await db.delete(sheetPins);
  await db.delete(sheetRows);
  await db.delete(sheetColumns);
  await db.delete(sheets);
  await db.delete(dataQualityFlags);
  await db.delete(emailOutbox);
  await db.delete(appSettings).where(eq(appSettings.key, IMPORT_SOURCE_KEY));
  await db.delete(customColumnValues);
  await db.delete(customColumns);
  await db.delete(roundMultiValues);
  await db.delete(statusTransitions);
  await db.delete(auditLog);
  await db.delete(notifications);
  await db.delete(reportTemplates);
  await db.delete(savedReports);
  await db.delete(estimateRounds);
  await db.delete(jobs);
  await db.delete(salesforceJobs);
  await db.delete(referenceListValues);
  await db.delete(referenceLists);
  await db.delete(users);

  console.log("Seeding reference lists + demo personas…");
  for (const [key, list] of Object.entries(REFERENCE_LISTS)) {
    await db.insert(referenceLists).values({ key, label: list.label });
    await db
      .insert(referenceListValues)
      .values(
        list.values.map((value, i) => ({ listKey: key, value, sortOrder: i }))
      );
  }

  const userRows = await db
    .insert(users)
    .values([
      {
        name: DEFAULT_DEMO_RPD.name,
        title: DEFAULT_DEMO_RPD.title,
        role: "rpd",
        region: "Central",
        preconDepartment: "Central Building Group",
        email: DEFAULT_DEMO_RPD.email,
      },
      {
        name: "Sarah Chen",
        title: "Preconstruction Manager",
        role: "pcm",
        region: "Central",
        preconDepartment: "Central Building Group",
        email: "schen@brasfieldgorrie.com",
      },
      {
        name: "Marcus Webb",
        title: "Senior Estimate Lead",
        role: "estimate_lead",
        region: "Central",
        preconDepartment: "Central Building Group",
        email: "mwebb@brasfieldgorrie.com",
      },
      {
        name: "Dana Ortiz",
        title: "Job Site Administrator",
        role: "admin_jsa",
        region: "Central",
        preconDepartment: "Central Building Group",
        email: "dortiz@brasfieldgorrie.com",
      },
      {
        name: "Patricia Lawson",
        title: "Division President",
        role: "leadership",
        region: "Central",
        preconDepartment: null,
        email: "plawson@brasfieldgorrie.com",
      },
      {
        name: "Tom Reeves",
        title: "Corporate Precon Admin",
        role: "corporate_admin",
        region: null,
        preconDepartment: null,
        email: "treeves@brasfieldgorrie.com",
      },
    ])
    .returning();
  const pcm = userRows.find((u) => u.role === "pcm")!;
  const estimateLead = userRows.find((u) => u.role === "estimate_lead")!;
  const rpd = userRows.find((u) => u.role === "rpd")!;

  const allFiles = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const files = allFiles.filter(
    (f) =>
      /Bid_Schedule|Post_Bid_Data_Collection|Estimate_Metrics_Capture/i.test(
        f
      ) &&
      !/Self_Perform_Estimate_Metrics|Checklist|Backup|Roster|Consolidated|Dashboard|Scoreboard|Cost_Tracking/i.test(
        f
      )
  );
  const skipped = allFiles.filter((f) => !files.includes(f));

  console.log(`Parsing ${files.length} Smartsheet files…`);
  const byKey = new Map<string, SmartsheetRoundDraft>();

  for (const file of files) {
    const sheet = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, file), "utf8")
    );
    for (const row of sheet.rows ?? []) {
      const draft = parseSmartsheetRound(
        smartsheetRowToCells(sheet, row),
        file
      );
      if (!draft) continue;
      const existing = byKey.get(draft.key);
      byKey.set(
        draft.key,
        existing ? mergeSmartsheetDrafts(existing, draft) : draft
      );
    }
  }

  console.log(`Merged ${byKey.size} unique estimate rounds. Inserting…`);

  const jobMap = new Map<string, number>();
  const leadCache = new Map<string, number>();
  const roundNoByJob = new Map<string, number>();
  let roundCount = 0;

  const drafts = [...byKey.values()].sort(
    (a, b) =>
      a.jobNumber.localeCompare(b.jobNumber) ||
      a.estimatePhase.localeCompare(b.estimatePhase)
  );

  for (const draft of drafts) {
    let jobId = jobMap.get(draft.jobNumber);
    if (!jobId) {
      const linked = /^\d/.test(draft.jobNumber);
      if (linked) {
        await db.insert(salesforceJobs).values({
          sfId: `SS-${draft.jobNumber}`,
          jobNumber: draft.jobNumber,
          jobName: draft.jobName,
          region: draft.region,
          marketSector: draft.marketSector,
          city: draft.city,
          state: draft.state,
        });
      }
      const [job] = await db
        .insert(jobs)
        .values({
          jobNumber: draft.jobNumber,
          jobName: draft.jobName,
          region: draft.region,
          preconDepartment: draft.preconDepartment,
          salesforceId: linked ? `SS-${draft.jobNumber}` : null,
          isLinked: linked,
          createdById: pcm.id,
        })
        .returning();
      jobId = job.id;
      jobMap.set(draft.jobNumber, jobId);
    }

    let leadId: number | null = null;
    if (draft.estimateLeadName) {
      if (!leadCache.has(draft.estimateLeadName)) {
        if (leadCache.size < 80) {
          const [u] = await db
            .insert(users)
            .values({
              name: draft.estimateLeadName,
              title: "Estimate Lead",
              role: "estimate_lead",
              region: draft.region,
              preconDepartment: draft.preconDepartment,
              email: `${draft.estimateLeadName.toLowerCase().replace(/[^a-z]+/g, ".")}.${leadCache.size}@brasfieldgorrie.com`,
            })
            .returning();
          leadCache.set(draft.estimateLeadName, u.id);
        } else {
          leadCache.set(draft.estimateLeadName, estimateLead.id);
        }
      }
      leadId = leadCache.get(draft.estimateLeadName) ?? null;
    }

    const roundNumber = (roundNoByJob.get(draft.jobNumber) ?? 0) + 1;
    roundNoByJob.set(draft.jobNumber, roundNumber);

    const [inserted] = await db
      .insert(estimateRounds)
      .values({
        jobId,
        roundNumber,
        status: draft.status,
        outcome: draft.outcome,
        region: draft.region,
        preconDepartment: draft.preconDepartment,
        estimatePhase: draft.estimatePhase,
        bidYear: draft.bidYear,
        bidDueDate: draft.bidDueDate,
        drawingsDueDate: draft.drawingsDueDate,
        bidReviewDate: draft.bidReviewDate,
        projectStartDate: draft.projectStartDate,
        owner: draft.owner,
        city: draft.city,
        state: draft.state,
        estimateLeadId: leadId,
        mlt: draft.mlt,
        marketSector: draft.marketSector,
        contractType: draft.contractType,
        procurement: draft.procurement,
        designContract: draft.designContract,
        statusAtPricing: draft.statusAtPricing,
        internalJointVenture: draft.internalJointVenture,
        awardability: draft.awardability,
        estimateValue: draft.estimateValue,
        feeBackPage: draft.feeBackPage,
        feeExpected: draft.feeExpected,
        contingencyTotal: draft.contingencyTotal,
        craftLaborBase: draft.craftLaborBase,
        craftLaborBurden: draft.craftLaborBurden,
        craftLaborManHours: draft.craftLaborManHours,
        gcBgSort: draft.gcBgSort,
        grBgSort: draft.grBgSort,
        gcProposedOwnerSov: draft.gcProposedOwnerSov,
        grProposedOwnerSov: draft.grProposedOwnerSov,
        pmMonths: draft.pmMonths,
        fieldSupervisionMonths: draft.fieldSupervisionMonths,
        preconCost: draft.preconCost,
        designCost: draft.designCost,
        selfPerformPriced: draft.selfPerformPriced,
        selfPerformProposed: draft.selfPerformProposed,
        projectScheduleDuration: draft.projectScheduleDuration,
        projectPlanningPreconEngagement: draft.projectPlanningPreconEngagement,
        submittedAt: ["submitted", "post_bid", "locked"].includes(draft.status)
          ? submittedStamp(draft.bidDueDate, draft.bidYear)
          : null,
        lockedAt:
          draft.status === "locked"
            ? submittedStamp(draft.bidDueDate, draft.bidYear)
            : null,
        createdById: pcm.id,
      })
      .returning();

    if (draft.selfPerformWorkType) {
      const parts = draft.selfPerformWorkType
        .split(/[,;|]/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const value of parts.slice(0, 8)) {
        await db.insert(roundMultiValues).values({
          roundId: inserted.id,
          field: "selfPerformWorkType",
          value,
        });
      }
    }

    roundCount += 1;
  }

  // Recorded so the Migration tab can state which sheets the numbers came
  // from — otherwise a missing year looks like a bug rather than a gap in the
  // export B&G supplied.
  await db.insert(appSettings).values({
    key: IMPORT_SOURCE_KEY,
    value: {
      importedAt: new Date().toISOString(),
      directory: DATA_DIR,
      filesUsed: files.sort(),
      filesSkipped: skipped.sort(),
      jobs: jobMap.size,
      rounds: roundCount,
    },
  });

  const scan = await syncDataQualityFlags();

  await db
    .insert(savedReports)
    .values(consolidatedRegionalReportInsert(rpd.id));
  await db.insert(savedReports).values(upcomingBidScheduleReportInsert(rpd.id));

  console.log("Rebuilding the workspace sheet tree…");
  const tree = await seedSheetsFromExport(DATA_DIR);

  console.log(
    `Done. Imported ${jobMap.size} jobs / ${roundCount} estimate rounds from Smartsheet.`
  );
  console.log(
    `Needs-review queue built: ${scan.open.toLocaleString()} values need a decision.`
  );
  console.log(
    `Workspace rebuilt: ${tree.views} pursuit views + ${tree.grids} standalone sheets (${tree.rows.toLocaleString()} rows).`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
