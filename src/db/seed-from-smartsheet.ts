/**
 * Import downloaded Smartsheet JSON from data/smartsheet/json into PGlite,
 * replacing demo jobs / estimate rounds. Keeps demo personas for the role switcher.
 *
 * Run (server stopped): npm run db:import-smartsheet
 */
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  appSettings,
  auditLog,
  customColumnValues,
  customColumns,
  dataQualityFlags,
  emailOutbox,
  estimateRounds,
  jobs,
  notifications,
  referenceListValues,
  referenceLists,
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
import { REFERENCE_LISTS } from "../lib/reference-data";
import { IMPORT_SOURCE_KEY } from "../lib/migration-source";
import { syncDataQualityFlags } from "../lib/data-quality-sync";
import { seedSheetsFromExport } from "./seed-sheets";

const DATA_DIR = path.join(process.cwd(), "data/smartsheet/json");

type CellMap = Record<string, string | number | boolean | null>;

function rowToObj(sheet: {
  columns?: { id: number; title: string }[];
  rows?: { cells?: { columnId: number; value?: unknown; displayValue?: string }[] }[];
}, row: { cells?: { columnId: number; value?: unknown; displayValue?: string }[] }): CellMap {
  const byId = Object.fromEntries((sheet.columns ?? []).map((c) => [c.id, c.title]));
  const o: CellMap = {};
  for (const c of row.cells ?? []) {
    const title = byId[c.columnId];
    if (!title) continue;
    const raw = c.displayValue ?? c.value ?? null;
    if (raw && typeof raw === "object") continue;
    o[title] = raw as string | number | boolean | null;
  }
  return o;
}

function g(row: CellMap, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v == null || v === "") continue;
    return String(v).trim();
  }
  // case-insensitive / fuzzy
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v == null || v === "") continue;
    return String(v).trim();
  }
  return null;
}

function money(v: string | null): number | null {
  if (v == null || v === "" || v === "—" || v === "-") return null;
  const n = Number(String(v).replace(/[$,\s]/g, "").replace(/\((.*)\)/, "-$1"));
  return Number.isFinite(n) ? n : null;
}

function num(v: string | null): number | null {
  if (v == null || v === "" || v === "—" || v === "-") return null;
  const n = Number(String(v).replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function dateStr(v: string | null): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Legacy sheets carry no submitted timestamp. Dating these rows from the bid
 * due date (or mid-bid-year as a fallback) keeps the reminder cadence honest —
 * stamping them with the import time would make every migrated round look like
 * it was submitted today.
 */
function submittedStamp(bidDueDate: string | null, bidYear: number): Date {
  const now = new Date();
  const from = bidDueDate ? new Date(`${bidDueDate}T15:00:00`) : new Date(`${bidYear}-06-30T15:00:00`);
  if (Number.isNaN(from.getTime()) || from > now) return now;
  return from;
}

function regionFromPath(file: string, rowRegion: string | null): string {
  if (rowRegion) {
    const r = rowRegion.replace(/ Region$/i, "").trim();
    if (/carolina/i.test(r)) return "Carolinas";
    if (/central/i.test(r)) return "Central";
    if (/florida|fl\b/i.test(r)) return "Florida";
    if (/georgia|ga\b/i.test(r)) return "Georgia";
    if (/texas|tx\b/i.test(r)) return "Texas";
    return r;
  }
  if (file.includes("CAR_")) return "Carolinas";
  if (file.includes("CEN_")) return "Central";
  if (file.includes("FL_")) return "Florida";
  if (file.includes("GA_")) return "Georgia";
  if (file.includes("TX_")) return "Texas";
  return "Central";
}

function mapStatus(
  statusRaw: string | null,
  file: string,
  outcomeRaw: string | null,
): { status: "active" | "upcoming" | "outstanding" | "submitted" | "post_bid" | "locked"; outcome: "pending" | "successful" | "unsuccessful" } {
  const s = (statusRaw ?? "").toLowerCase();
  const o = (outcomeRaw ?? "").toLowerCase();

  if (o === "successful" || s === "successful") return { status: "locked", outcome: "successful" };
  if (o === "unsuccessful" || s === "unsuccessful") return { status: "locked", outcome: "unsuccessful" };
  if (o === "advanced" || o === "pending" || o.includes("award")) {
    // Metrics capture rows are post-pricing historical — treat as locked pending unless win/loss known
    if (file.includes("Estimate_Metrics")) return { status: "locked", outcome: "pending" };
  }
  if (s === "submitted") return { status: "submitted", outcome: "pending" };
  if (s === "active") return { status: "active", outcome: "pending" };
  if (file.includes("Outstanding")) return { status: "outstanding", outcome: "pending" };
  if (file.includes("Upcoming")) return { status: "upcoming", outcome: "pending" };
  if (file.includes("Post_Bid_Data_Collection")) return { status: "post_bid", outcome: "pending" };
  if (file.includes("Active")) return { status: "active", outcome: "pending" };
  if (file.includes("Estimate_Metrics")) return { status: "locked", outcome: "pending" };
  return { status: "upcoming", outcome: "pending" };
}

function isDataRow(row: CellMap): boolean {
  const jobNo = g(row, "Job #", "Primary Column", "Job Number");
  const jobName = g(row, "Job Name");
  if (!jobName || !jobNo) return false;
  if (!/^\d/.test(jobNo) && !/^TBD/i.test(jobNo)) return false;
  if (/region|pursuits|total|active pursuits|upcoming|outstanding/i.test(jobName)) return false;
  return true;
}

type RoundDraft = {
  key: string;
  jobNumber: string;
  jobName: string;
  region: string;
  preconDepartment: string;
  estimatePhase: string;
  bidYear: number;
  bidDueDate: string | null;
  projectStartDate: string | null;
  city: string | null;
  state: string | null;
  estimateLeadName: string | null;
  mlt: string | null;
  marketSector: string | null;
  contractType: string | null;
  procurement: string | null;
  designContract: string | null;
  statusAtPricing: string | null;
  internalJointVenture: string | null;
  awardability: string | null;
  estimateValue: number | null;
  feeBackPage: number | null;
  feeExpected: number | null;
  contingencyTotal: number | null;
  craftLaborBase: number | null;
  craftLaborBurden: number | null;
  craftLaborManHours: number | null;
  gcBgSort: number | null;
  grBgSort: number | null;
  gcProposedOwnerSov: number | null;
  grProposedOwnerSov: number | null;
  pmMonths: number | null;
  fieldSupervisionMonths: number | null;
  preconCost: number | null;
  designCost: number | null;
  selfPerformPriced: number | null;
  selfPerformProposed: number | null;
  selfPerformWorkType: string | null;
  projectScheduleDuration: number | null;
  projectPlanningPreconEngagement: string | null;
  status: "active" | "upcoming" | "outstanding" | "submitted" | "post_bid" | "locked";
  outcome: "pending" | "successful" | "unsuccessful";
  source: string;
};

function draftKey(jobNumber: string, phase: string, jobName: string) {
  return `${jobNumber}||${phase}||${jobName}`.toLowerCase();
}

function parseRound(row: CellMap, file: string): RoundDraft | null {
  if (!isDataRow(row)) return null;
  const jobNumber = g(row, "Job #", "Primary Column", "Job Number")!;
  const jobName = g(row, "Job Name")!;
  const estimatePhase = g(row, "Estimate Phase") ?? "Budget – Concept";
  const region = regionFromPath(file, g(row, "Region"));
  const preconDepartment =
    g(row, "Precon Dept", "Division") ?? region;
  const bidYear =
    num(g(row, "Bid Year")) ??
    (dateStr(g(row, "Bid Date", "Bid Due Date"))
      ? Number(dateStr(g(row, "Bid Date", "Bid Due Date"))!.slice(0, 4))
      : 2026);
  const { status, outcome } = mapStatus(
    g(row, "Status"),
    file,
    g(row, "Outcome"),
  );

  return {
    key: draftKey(jobNumber, estimatePhase, jobName),
    jobNumber,
    jobName,
    region,
    preconDepartment,
    estimatePhase,
    bidYear: bidYear || 2026,
    bidDueDate: dateStr(g(row, "Bid Date", "Bid Due Date")),
    projectStartDate: dateStr(g(row, "Project Start Date")),
    city: g(row, "City"),
    state: g(row, "State"),
    estimateLeadName: g(row, "Lead Precon Manager", "Assigned resource"),
    mlt: g(row, "Market Leadership Team (MLT)", "MLT"),
    marketSector: g(row, "Market Sector"),
    contractType: g(row, "Contract Type"),
    procurement: g(row, "Procurement Method", "Procurement"),
    designContract: g(row, "Design Delivery", "Design/Contract", "Design Contract"),
    statusAtPricing: g(row, "Contract Status (at time of pricing)", "Status"),
    internalJointVenture: g(row, "Internal Joint Venture?"),
    awardability: g(row, "Awardability"),
    estimateValue: money(g(row, "Estimate Value $", "Bid Amount")),
    feeBackPage: money(g(row, "Fee - Back Page $", "Fee – Back Page $")),
    feeExpected: money(g(row, "Fee - Expected $", "Fee – Expected $")),
    contingencyTotal: money(g(row, "Contingency - Total $", "Contingency – Total $")),
    craftLaborBase: money(g(row, "Craft Labor Base $")),
    craftLaborBurden: money(g(row, "Craft Labor Burden $")),
    craftLaborManHours: num(g(row, "Craft Labor Man Hours")),
    gcBgSort: money(g(row, "GC $ - B&G Sort", "GC $ – B&G Sort")),
    grBgSort: money(g(row, "GR $ - B&G Sort", "GR $ – B&G Sort")),
    gcProposedOwnerSov: money(g(row, "GC $ Proposed - Owner SOV", "GC $ Proposed – Owner SOV")),
    grProposedOwnerSov: money(g(row, "GR $ Proposed - Owner SOV", "GR $ Proposed – Owner SOV")),
    pmMonths: num(g(row, "PM Months (APM to PD)")),
    fieldSupervisionMonths: num(g(row, "Field Supervision Months (AFM to GS)")),
    preconCost: money(g(row, "Precon Cost $ (included in estimate)")),
    designCost: money(g(row, "Design Cost $ (included in estimate)")),
    selfPerformPriced: money(g(row, "Self-Perform $ Priced")),
    selfPerformProposed: money(g(row, "Self-Perform $ Proposed")),
    selfPerformWorkType: g(row, "Self-Perform Work Type"),
    projectScheduleDuration: num(g(row, "Project Schedule Duration (MO)", "Project Duration (Months)")),
    projectPlanningPreconEngagement: g(row, "Project Planning Precon Engagement"),
    status,
    outcome,
    source: file,
  };
}

function mergeDraft(a: RoundDraft, b: RoundDraft): RoundDraft {
  const aMetrics = /Estimate_Metrics/i.test(a.source);
  const bMetrics = /Estimate_Metrics/i.test(b.source);
  // Prefer metrics-capture values for economics; otherwise first non-null.
  const pick = <T,>(x: T, y: T, preferB = false): T => {
    if (preferB) return y != null && y !== "" ? y : x;
    return x != null && x !== "" ? x : y;
  };
  const econPreferB = bMetrics && !aMetrics;
  const statusRank = {
    active: 1,
    upcoming: 1,
    outstanding: 2,
    submitted: 3,
    post_bid: 4,
    locked: 5,
  } as const;
  const useBStatus = statusRank[b.status] >= statusRank[a.status];
  return {
    ...a,
    jobName: a.jobName || b.jobName,
    region: a.region || b.region,
    preconDepartment: a.preconDepartment || b.preconDepartment,
    bidDueDate: pick(a.bidDueDate, b.bidDueDate),
    projectStartDate: pick(a.projectStartDate, b.projectStartDate, econPreferB),
    city: pick(a.city, b.city),
    state: pick(a.state, b.state),
    estimateLeadName: pick(a.estimateLeadName, b.estimateLeadName),
    mlt: pick(a.mlt, b.mlt, econPreferB),
    marketSector: pick(a.marketSector, b.marketSector, econPreferB),
    contractType: pick(a.contractType, b.contractType, econPreferB),
    procurement: pick(a.procurement, b.procurement),
    designContract: pick(a.designContract, b.designContract),
    statusAtPricing: pick(a.statusAtPricing, b.statusAtPricing, econPreferB),
    internalJointVenture: pick(a.internalJointVenture, b.internalJointVenture, econPreferB),
    awardability: pick(a.awardability, b.awardability, econPreferB),
    estimateValue: pick(a.estimateValue, b.estimateValue, econPreferB),
    feeBackPage: pick(a.feeBackPage, b.feeBackPage, econPreferB),
    feeExpected: pick(a.feeExpected, b.feeExpected, econPreferB),
    contingencyTotal: pick(a.contingencyTotal, b.contingencyTotal, econPreferB),
    craftLaborBase: pick(a.craftLaborBase, b.craftLaborBase, econPreferB),
    craftLaborBurden: pick(a.craftLaborBurden, b.craftLaborBurden, econPreferB),
    craftLaborManHours: pick(a.craftLaborManHours, b.craftLaborManHours, econPreferB),
    gcBgSort: pick(a.gcBgSort, b.gcBgSort, econPreferB),
    grBgSort: pick(a.grBgSort, b.grBgSort, econPreferB),
    gcProposedOwnerSov: pick(a.gcProposedOwnerSov, b.gcProposedOwnerSov, econPreferB),
    grProposedOwnerSov: pick(a.grProposedOwnerSov, b.grProposedOwnerSov, econPreferB),
    pmMonths: pick(a.pmMonths, b.pmMonths, econPreferB),
    fieldSupervisionMonths: pick(a.fieldSupervisionMonths, b.fieldSupervisionMonths, econPreferB),
    preconCost: pick(a.preconCost, b.preconCost, econPreferB),
    designCost: pick(a.designCost, b.designCost, econPreferB),
    selfPerformPriced: pick(a.selfPerformPriced, b.selfPerformPriced, econPreferB),
    selfPerformProposed: pick(a.selfPerformProposed, b.selfPerformProposed, econPreferB),
    selfPerformWorkType: pick(a.selfPerformWorkType, b.selfPerformWorkType, econPreferB),
    projectScheduleDuration: pick(a.projectScheduleDuration, b.projectScheduleDuration, econPreferB),
    projectPlanningPreconEngagement: pick(
      a.projectPlanningPreconEngagement,
      b.projectPlanningPreconEngagement,
      econPreferB,
    ),
    status: useBStatus ? b.status : a.status,
    outcome: a.outcome !== "pending" ? a.outcome : b.outcome,
    source: `${a.source}|${b.source}`,
  };
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
    await db.insert(referenceListValues).values(
      list.values.map((value, i) => ({ listKey: key, value, sortOrder: i })),
    );
  }

  const userRows = await db
    .insert(users)
    .values([
      { name: "Sarah Chen", title: "Preconstruction Manager", role: "pcm", region: "Central", preconDepartment: "Central Building Group", email: "schen@brasfieldgorrie.com" },
      { name: "Marcus Webb", title: "Senior Estimate Lead", role: "estimate_lead", region: "Central", preconDepartment: "Central Building Group", email: "mwebb@brasfieldgorrie.com" },
      { name: "Dana Ortiz", title: "Job Site Administrator", role: "admin_jsa", region: "Central", preconDepartment: "Central Building Group", email: "dortiz@brasfieldgorrie.com" },
      { name: "Bryan Myers", title: "Regional Preconstruction Director", role: "rpd", region: "Central", preconDepartment: "Central Building Group", email: "bmyers@brasfieldgorrie.com" },
      { name: "Patricia Lawson", title: "Division President", role: "leadership", region: "Central", preconDepartment: null, email: "plawson@brasfieldgorrie.com" },
      { name: "Tom Reeves", title: "Corporate Precon Admin", role: "corporate_admin", region: null, preconDepartment: null, email: "treeves@brasfieldgorrie.com" },
    ])
    .returning();
  const pcm = userRows.find((u) => u.role === "pcm")!;
  const estimateLead = userRows.find((u) => u.role === "estimate_lead")!;

  const allFiles = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const files = allFiles.filter(
    (f) =>
      /Bid_Schedule|Post_Bid_Data_Collection|Estimate_Metrics_Capture/i.test(f) &&
      !/Self_Perform_Estimate_Metrics|Checklist|Backup|Roster|Consolidated|Dashboard|Scoreboard|Cost_Tracking/i.test(
        f,
      ),
  );
  const skipped = allFiles.filter((f) => !files.includes(f));

  console.log(`Parsing ${files.length} Smartsheet files…`);
  const byKey = new Map<string, RoundDraft>();

  for (const file of files) {
    const sheet = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
    for (const row of sheet.rows ?? []) {
      const draft = parseRound(rowToObj(sheet, row), file);
      if (!draft) continue;
      const existing = byKey.get(draft.key);
      byKey.set(draft.key, existing ? mergeDraft(existing, draft) : draft);
    }
  }

  console.log(`Merged ${byKey.size} unique estimate rounds. Inserting…`);

  const jobMap = new Map<string, number>();
  const leadCache = new Map<string, number>();
  const roundNoByJob = new Map<string, number>();
  let roundCount = 0;

  const drafts = [...byKey.values()].sort((a, b) =>
    a.jobNumber.localeCompare(b.jobNumber) || a.estimatePhase.localeCompare(b.estimatePhase),
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
        projectStartDate: draft.projectStartDate,
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
          draft.status === "locked" ? submittedStamp(draft.bidDueDate, draft.bidYear) : null,
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

  console.log("Rebuilding the workspace sheet tree…");
  const tree = await seedSheetsFromExport(DATA_DIR);

  console.log(
    `Done. Imported ${jobMap.size} jobs / ${roundCount} estimate rounds from Smartsheet.`,
  );
  console.log(
    `Needs-review queue built: ${scan.open.toLocaleString()} values need a decision.`,
  );
  console.log(
    `Workspace rebuilt: ${tree.views} pursuit views + ${tree.grids} standalone sheets (${tree.rows.toLocaleString()} rows).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
