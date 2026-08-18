/**
 * Smartsheet bid-schedule / post-bid / metrics row mapping.
 * Shared by the import CLI and unit tests so the shipped parse is the one
 * that lands Owner, Drawings Due, and Bid Review on estimate rounds.
 */

export type CellMap = Record<string, string | number | boolean | null>;

export type SmartsheetRoundDraft = {
  key: string;
  jobNumber: string;
  jobName: string;
  owner: string | null;
  region: string;
  preconDepartment: string;
  estimatePhase: string;
  bidYear: number;
  bidDueDate: string | null;
  drawingsDueDate: string | null;
  bidReviewDate: string | null;
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

export function smartsheetRowToCells(sheet: {
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

/**
 * Booleans map explicitly: an unchecked checkbox (false) is the same as blank —
 * stringifying it would turn e.g. `internalJointVenture` into the truthy text
 * "false" and mis-flag the round as an Internal Joint Venture.
 */
function normalizeCell(v: string | number | boolean | null | undefined): string | null {
  if (v == null || v === "" || v === false) return null;
  if (v === true) return "true";
  return String(v).trim();
}

export function cellValue(row: CellMap, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = normalizeCell(row[k]);
    if (v == null || v === "") continue;
    return v;
  }
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const k of keys) {
    const v = normalizeCell(lower[k.toLowerCase()]);
    if (v == null || v === "") continue;
    return v;
  }
  return null;
}

export function parseMoney(v: string | null): number | null {
  if (v == null || v === "" || v === "—" || v === "-") return null;
  const n = Number(String(v).replace(/[$,\s]/g, "").replace(/\((.*)\)/, "-$1"));
  return Number.isFinite(n) ? n : null;
}

export function parseNumber(v: string | null): number | null {
  if (v == null || v === "" || v === "—" || v === "-") return null;
  const n = Number(String(v).replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Calendar date as YYYY-MM-DD. Prefers ISO, then M/D/YYYY, then Date parse. */
export function parseSheetDate(v: string | null): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function regionFromPath(file: string, rowRegion: string | null): string {
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

export function mapSheetStatus(
  statusRaw: string | null,
  file: string,
  outcomeRaw: string | null,
): {
  status: SmartsheetRoundDraft["status"];
  outcome: SmartsheetRoundDraft["outcome"];
} {
  const s = (statusRaw ?? "").toLowerCase();
  const o = (outcomeRaw ?? "").toLowerCase();

  if (o === "successful" || s === "successful") return { status: "locked", outcome: "successful" };
  if (o === "unsuccessful" || s === "unsuccessful") return { status: "locked", outcome: "unsuccessful" };
  if (o === "advanced" || o === "pending" || o.includes("award")) {
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

export function isSmartsheetDataRow(row: CellMap): boolean {
  const jobNo = cellValue(row, "Job #", "Primary Column", "Job Number");
  const jobName = cellValue(row, "Job Name");
  if (!jobName || !jobNo) return false;
  if (!/^\d/.test(jobNo) && !/^TBD/i.test(jobNo)) return false;
  if (/region|pursuits|total|active pursuits|upcoming|outstanding/i.test(jobName)) return false;
  return true;
}

export function draftKey(jobNumber: string, phase: string, jobName: string) {
  return `${jobNumber}||${phase}||${jobName}`.toLowerCase();
}

export function parseSmartsheetRound(row: CellMap, file: string): SmartsheetRoundDraft | null {
  if (!isSmartsheetDataRow(row)) return null;
  const jobNumber = cellValue(row, "Job #", "Primary Column", "Job Number")!;
  const jobName = cellValue(row, "Job Name")!;
  const estimatePhase = cellValue(row, "Estimate Phase") ?? "Budget – Concept";
  const region = regionFromPath(file, cellValue(row, "Region"));
  const preconDepartment = cellValue(row, "Precon Dept", "Division") ?? region;
  const bidYear =
    parseNumber(cellValue(row, "Bid Year")) ??
    (parseSheetDate(cellValue(row, "Bid Date", "Bid Due Date"))
      ? Number(parseSheetDate(cellValue(row, "Bid Date", "Bid Due Date"))!.slice(0, 4))
      : 2026);
  const { status, outcome } = mapSheetStatus(
    cellValue(row, "Status"),
    file,
    cellValue(row, "Outcome"),
  );

  return {
    key: draftKey(jobNumber, estimatePhase, jobName),
    jobNumber,
    jobName,
    owner: cellValue(row, "Owner"),
    region,
    preconDepartment,
    estimatePhase,
    bidYear: bidYear || 2026,
    bidDueDate: parseSheetDate(cellValue(row, "Bid Date", "Bid Due Date")),
    drawingsDueDate: parseSheetDate(cellValue(row, "Drawings Due Date", "Drawings Due")),
    bidReviewDate: parseSheetDate(cellValue(row, "Bid Review Date", "Bid Review")),
    projectStartDate: parseSheetDate(cellValue(row, "Project Start Date")),
    city: cellValue(row, "City"),
    state: cellValue(row, "State"),
    estimateLeadName: cellValue(row, "Lead Precon Manager", "Assigned resource"),
    mlt: cellValue(row, "Market Leadership Team (MLT)", "MLT"),
    marketSector: cellValue(row, "Market Sector"),
    contractType: cellValue(row, "Contract Type"),
    procurement: cellValue(row, "Procurement Method", "Procurement"),
    designContract: cellValue(row, "Design Delivery", "Design/Contract", "Design Contract"),
    // No "Status" fallback: the lifecycle Status column (Active/Submitted/…) is
    // a different concept from the contract status at time of pricing.
    statusAtPricing: cellValue(row, "Contract Status (at time of pricing)"),
    internalJointVenture: cellValue(row, "Internal Joint Venture?"),
    awardability: cellValue(row, "Awardability"),
    estimateValue: parseMoney(cellValue(row, "Estimate Value $", "Bid Amount")),
    feeBackPage: parseMoney(cellValue(row, "Fee - Back Page $", "Fee – Back Page $")),
    feeExpected: parseMoney(cellValue(row, "Fee - Expected $", "Fee – Expected $")),
    contingencyTotal: parseMoney(cellValue(row, "Contingency - Total $", "Contingency – Total $")),
    craftLaborBase: parseMoney(cellValue(row, "Craft Labor Base $")),
    craftLaborBurden: parseMoney(cellValue(row, "Craft Labor Burden $")),
    craftLaborManHours: parseNumber(cellValue(row, "Craft Labor Man Hours")),
    gcBgSort: parseMoney(cellValue(row, "GC $ - B&G Sort", "GC $ – B&G Sort")),
    grBgSort: parseMoney(cellValue(row, "GR $ - B&G Sort", "GR $ – B&G Sort")),
    gcProposedOwnerSov: parseMoney(cellValue(row, "GC $ Proposed - Owner SOV", "GC $ Proposed – Owner SOV")),
    grProposedOwnerSov: parseMoney(cellValue(row, "GR $ Proposed - Owner SOV", "GR $ Proposed – Owner SOV")),
    pmMonths: parseNumber(cellValue(row, "PM Months (APM to PD)")),
    fieldSupervisionMonths: parseNumber(cellValue(row, "Field Supervision Months (AFM to GS)")),
    preconCost: parseMoney(cellValue(row, "Precon Cost $ (included in estimate)")),
    designCost: parseMoney(cellValue(row, "Design Cost $ (included in estimate)")),
    selfPerformPriced: parseMoney(cellValue(row, "Self-Perform $ Priced")),
    selfPerformProposed: parseMoney(cellValue(row, "Self-Perform $ Proposed")),
    selfPerformWorkType: cellValue(row, "Self-Perform Work Type"),
    projectScheduleDuration: parseNumber(
      cellValue(row, "Project Schedule Duration (MO)", "Project Duration (Months)"),
    ),
    projectPlanningPreconEngagement: cellValue(row, "Project Planning Precon Engagement"),
    status,
    outcome,
    source: file,
  };
}

export function mergeSmartsheetDrafts(
  a: SmartsheetRoundDraft,
  b: SmartsheetRoundDraft,
): SmartsheetRoundDraft {
  const aMetrics = /Estimate_Metrics/i.test(a.source);
  const bMetrics = /Estimate_Metrics/i.test(b.source);
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
    owner: pick(a.owner, b.owner),
    region: a.region || b.region,
    preconDepartment: a.preconDepartment || b.preconDepartment,
    bidDueDate: pick(a.bidDueDate, b.bidDueDate),
    drawingsDueDate: pick(a.drawingsDueDate, b.drawingsDueDate),
    bidReviewDate: pick(a.bidReviewDate, b.bidReviewDate),
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
