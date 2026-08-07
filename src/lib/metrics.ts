import type { EstimateRound } from "@/db/schema";

/**
 * Server-side calculated metrics (the Project Estimate Summary formula set).
 * Always derived from stored fields — never entered or stored separately — so
 * they reconcile with source values (BRD Sections 8-9, 13).
 */

export type MetricFormat = "percent" | "dollars" | "number" | "ratio";

export type MetricGroup =
  | "Fee"
  | "Contingency & Risk"
  | "General Conditions & Requirements"
  | "Labor"
  | "Staffing & Productivity"
  | "Self-Perform"
  | "Precon & Design"
  | "Cost Composition"
  | "Project Attributes"
  | "Schedule"
  | "Market Engagement";

export type MetricDef = {
  key: string;
  label: string;
  format: MetricFormat;
  group: MetricGroup;
  note?: string;
  /** Surfaced in compact metric strips / default report presets. */
  headline?: boolean;
  calc: (r: EstimateRound) => number | null;
};

const div = (a: number | null, b: number | null): number | null =>
  a == null || b == null || b === 0 ? null : a / b;

/** Sums only when at least one operand is present, so all-blank stays null. */
const addSome = (...xs: (number | null)[]): number | null =>
  xs.every((x) => x == null) ? null : xs.reduce<number>((s, x) => s + (x ?? 0), 0);

const diff = (a: number | null, b: number | null): number | null =>
  a == null && b == null ? null : (a ?? 0) - (b ?? 0);

/** Estimate value net of stated fee and contingency — the underlying cost of work. */
const directCost = (r: EstimateRound): number | null =>
  r.estimateValue == null
    ? null
    : r.estimateValue - (r.feeBackPage ?? 0) - (r.contingencyTotal ?? 0);

const craftLaborTotal = (r: EstimateRound): number | null =>
  addSome(r.craftLaborBase, r.craftLaborBurden);

const gcGrBgSort = (r: EstimateRound): number | null => addSome(r.gcBgSort, r.grBgSort);

const gcGrOwnerSov = (r: EstimateRound): number | null =>
  addSome(r.gcProposedOwnerSov, r.grProposedOwnerSov);

export const METRIC_DEFS: MetricDef[] = [
  // ---- Fee ----
  {
    key: "feeBackPagePct",
    label: "Fee % (Back Page)",
    format: "percent",
    group: "Fee",
    headline: true,
    calc: (r) => div(r.feeBackPage, r.estimateValue),
  },
  {
    key: "feeExpectedPct",
    label: "Fee % (Expected)",
    format: "percent",
    group: "Fee",
    headline: true,
    calc: (r) => div(r.feeExpected, r.estimateValue),
  },
  {
    key: "feeUpliftDollars",
    label: "Fee Uplift $ (Expected − Back Page)",
    format: "dollars",
    group: "Fee",
    note: "Fee earned beyond the back page (rates, self-perform, etc.)",
    calc: (r) => diff(r.feeExpected, r.feeBackPage),
  },
  {
    key: "feeUpliftPct",
    label: "Fee Uplift % of Estimate",
    format: "percent",
    group: "Fee",
    calc: (r) => div(diff(r.feeExpected, r.feeBackPage), r.estimateValue),
  },
  {
    key: "feeUpliftRatio",
    label: "Expected Fee / Back Page Fee",
    format: "ratio",
    group: "Fee",
    calc: (r) => div(r.feeExpected, r.feeBackPage),
  },
  {
    key: "feeOnDirectCostPct",
    label: "Fee % of Direct Cost",
    format: "percent",
    group: "Fee",
    note: "Back page fee / (Estimate − fee − contingency)",
    calc: (r) => div(r.feeBackPage, directCost(r)),
  },
  {
    key: "feePerGsf",
    label: "Fee $ per GSF",
    format: "dollars",
    group: "Fee",
    calc: (r) => div(r.feeExpected, r.gsf),
  },
  {
    key: "feePerScheduleMonth",
    label: "Fee per Schedule Month",
    format: "dollars",
    group: "Fee",
    calc: (r) => div(r.feeExpected, r.projectScheduleDuration),
  },

  // ---- Contingency & Risk ----
  {
    key: "contingencyPct",
    label: "Contingency %",
    format: "percent",
    group: "Contingency & Risk",
    headline: true,
    calc: (r) => div(r.contingencyTotal, r.estimateValue),
  },
  {
    key: "contingencyOnDirectCostPct",
    label: "Contingency % of Direct Cost",
    format: "percent",
    group: "Contingency & Risk",
    calc: (r) => div(r.contingencyTotal, directCost(r)),
  },
  {
    key: "feePlusContingencyPct",
    label: "Fee + Contingency % of Estimate",
    format: "percent",
    group: "Contingency & Risk",
    note: "Combined margin and risk carried in the estimate",
    calc: (r) => div(addSome(r.feeBackPage, r.contingencyTotal), r.estimateValue),
  },
  {
    key: "contingencyToFeeRatio",
    label: "Contingency / Fee Ratio",
    format: "ratio",
    group: "Contingency & Risk",
    calc: (r) => div(r.contingencyTotal, r.feeBackPage),
  },

  // ---- General Conditions & Requirements ----
  {
    key: "gcPct",
    label: "GC % of Estimate",
    format: "percent",
    group: "General Conditions & Requirements",
    headline: true,
    calc: (r) => div(r.gcBgSort, r.estimateValue),
  },
  {
    key: "grPct",
    label: "GR % of Estimate",
    format: "percent",
    group: "General Conditions & Requirements",
    calc: (r) => div(r.grBgSort, r.estimateValue),
  },
  {
    key: "gcGrCombinedPct",
    label: "GC+GR % of Estimate",
    format: "percent",
    group: "General Conditions & Requirements",
    headline: true,
    calc: (r) => div(gcGrBgSort(r), r.estimateValue),
  },
  {
    key: "gcGrCombinedDollars",
    label: "GC+GR $ (B&G Sort)",
    format: "dollars",
    group: "General Conditions & Requirements",
    calc: (r) => gcGrBgSort(r),
  },
  {
    key: "gcOwnerSovPct",
    label: "GC % of Estimate (Owner SOV)",
    format: "percent",
    group: "General Conditions & Requirements",
    calc: (r) => div(r.gcProposedOwnerSov, r.estimateValue),
  },
  {
    key: "grOwnerSovPct",
    label: "GR % of Estimate (Owner SOV)",
    format: "percent",
    group: "General Conditions & Requirements",
    calc: (r) => div(r.grProposedOwnerSov, r.estimateValue),
  },
  {
    key: "gcGrOwnerSovPct",
    label: "GC+GR % of Estimate (Owner SOV)",
    format: "percent",
    group: "General Conditions & Requirements",
    calc: (r) => div(gcGrOwnerSov(r), r.estimateValue),
  },
  {
    key: "gcSortVsSovVariance",
    label: "GC Variance $ (B&G Sort − Owner SOV)",
    format: "dollars",
    group: "General Conditions & Requirements",
    note: "Positive means B&G carries more GC than the Owner sees",
    calc: (r) =>
      r.gcBgSort == null && r.gcProposedOwnerSov == null
        ? null
        : diff(r.gcBgSort, r.gcProposedOwnerSov),
  },
  {
    key: "grSortVsSovVariance",
    label: "GR Variance $ (B&G Sort − Owner SOV)",
    format: "dollars",
    group: "General Conditions & Requirements",
    calc: (r) =>
      r.grBgSort == null && r.grProposedOwnerSov == null
        ? null
        : diff(r.grBgSort, r.grProposedOwnerSov),
  },
  {
    key: "gcGrPerScheduleMonth",
    label: "GC+GR per Schedule Month",
    format: "dollars",
    group: "General Conditions & Requirements",
    calc: (r) => div(gcGrBgSort(r), r.projectScheduleDuration),
  },
  {
    key: "gcGrPerGsf",
    label: "GC+GR $ per GSF",
    format: "dollars",
    group: "General Conditions & Requirements",
    calc: (r) => div(gcGrBgSort(r), r.gsf),
  },

  // ---- Labor ----
  {
    key: "craftLaborTotal",
    label: "Craft Labor Total $ (Base + Burden)",
    format: "dollars",
    group: "Labor",
    calc: (r) => craftLaborTotal(r),
  },
  {
    key: "laborBurdenPct",
    label: "Craft Labor Burden %",
    format: "percent",
    group: "Labor",
    note: "Burden / Base",
    calc: (r) => div(r.craftLaborBurden, r.craftLaborBase),
  },
  {
    key: "craftLaborPctOfEstimate",
    label: "Craft Labor % of Estimate",
    format: "percent",
    group: "Labor",
    calc: (r) => div(craftLaborTotal(r), r.estimateValue),
  },
  {
    key: "laborCostPerManHour",
    label: "Craft Labor $ per Man Hour",
    format: "dollars",
    group: "Labor",
    headline: true,
    calc: (r) => div(craftLaborTotal(r), r.craftLaborManHours),
  },
  {
    key: "laborBaseRatePerManHour",
    label: "Craft Labor Base $ per Man Hour",
    format: "dollars",
    group: "Labor",
    calc: (r) => div(r.craftLaborBase, r.craftLaborManHours),
  },
  {
    key: "manHoursPerMillion",
    label: "Man Hours per $1M Estimate",
    format: "number",
    group: "Labor",
    calc: (r) =>
      r.estimateValue == null || r.estimateValue === 0
        ? null
        : div(r.craftLaborManHours, r.estimateValue / 1_000_000),
  },
  {
    key: "manHoursPerGsf",
    label: "Man Hours per GSF",
    format: "ratio",
    group: "Labor",
    calc: (r) => div(r.craftLaborManHours, r.gsf),
  },
  {
    key: "manHoursPerScheduleMonth",
    label: "Man Hours per Schedule Month",
    format: "number",
    group: "Labor",
    calc: (r) => div(r.craftLaborManHours, r.projectScheduleDuration),
  },

  // ---- Staffing & Productivity ----
  {
    key: "feePerPmMonth",
    label: "Fee per PM Month",
    format: "dollars",
    group: "Staffing & Productivity",
    headline: true,
    calc: (r) => div(r.feeExpected, r.pmMonths),
  },
  {
    key: "feePerSupervisionMonth",
    label: "Fee per Field Supervision Month",
    format: "dollars",
    group: "Staffing & Productivity",
    calc: (r) => div(r.feeExpected, r.fieldSupervisionMonths),
  },
  {
    key: "feePerStaffMonth",
    label: "Fee per Total Staff Month",
    format: "dollars",
    group: "Staffing & Productivity",
    note: "PM months + field supervision months",
    calc: (r) => div(r.feeExpected, addSome(r.pmMonths, r.fieldSupervisionMonths)),
  },
  {
    key: "revenuePerPmYear",
    label: "Revenue per PM Year",
    format: "dollars",
    group: "Staffing & Productivity",
    headline: true,
    note: "Estimate Value / (PM Months / 12)",
    calc: (r) =>
      r.pmMonths == null || r.pmMonths === 0 ? null : div(r.estimateValue, r.pmMonths / 12),
  },
  {
    key: "revenuePerPmMonth",
    label: "Revenue per PM Month",
    format: "dollars",
    group: "Staffing & Productivity",
    calc: (r) => div(r.estimateValue, r.pmMonths),
  },
  {
    key: "revenuePerSupervisionYear",
    label: "Revenue per Field Supervision Year",
    format: "dollars",
    group: "Staffing & Productivity",
    calc: (r) =>
      r.fieldSupervisionMonths == null || r.fieldSupervisionMonths === 0
        ? null
        : div(r.estimateValue, r.fieldSupervisionMonths / 12),
  },
  {
    key: "pmMonthsPerTenMillion",
    label: "PM Months per $10M",
    format: "number",
    group: "Staffing & Productivity",
    calc: (r) =>
      r.estimateValue == null || r.estimateValue === 0
        ? null
        : div(r.pmMonths, r.estimateValue / 10_000_000),
  },
  {
    key: "supervisionToPmRatio",
    label: "Field Supervision / PM Month Ratio",
    format: "ratio",
    group: "Staffing & Productivity",
    calc: (r) => div(r.fieldSupervisionMonths, r.pmMonths),
  },
  {
    key: "pmMonthsVsScheduleRatio",
    label: "PM Months / Schedule Month",
    format: "ratio",
    group: "Staffing & Productivity",
    note: "Approximate concurrent PM staffing level",
    calc: (r) => div(r.pmMonths, r.projectScheduleDuration),
  },
  {
    key: "afmMonthsPctOfSupervision",
    label: "AFM Months % of Supervision",
    format: "percent",
    group: "Staffing & Productivity",
    calc: (r) => div(r.afmMonths, r.fieldSupervisionMonths),
  },
  {
    key: "revenuePerPeakHeadcount",
    label: "Revenue per Peak Headcount",
    format: "dollars",
    group: "Staffing & Productivity",
    calc: (r) => div(r.estimateValue, r.peakManpowerHeadcount),
  },

  // ---- Self-Perform ----
  {
    key: "selfPerformPricedPct",
    label: "Self-Perform % Priced",
    format: "percent",
    group: "Self-Perform",
    calc: (r) => div(r.selfPerformPriced, r.estimateValue),
  },
  {
    key: "selfPerformProposedPct",
    label: "Self-Perform % Proposed",
    format: "percent",
    group: "Self-Perform",
    headline: true,
    calc: (r) => div(r.selfPerformProposed, r.estimateValue),
  },
  {
    key: "selfPerformCapture",
    label: "Self-Perform Capture Ratio",
    format: "ratio",
    group: "Self-Perform",
    note: "Proposed / Priced",
    calc: (r) => div(r.selfPerformProposed, r.selfPerformPriced),
  },
  {
    key: "selfPerformNotProposed",
    label: "Self-Perform $ Not Proposed",
    format: "dollars",
    group: "Self-Perform",
    calc: (r) =>
      r.selfPerformPriced == null && r.selfPerformProposed == null
        ? null
        : diff(r.selfPerformPriced, r.selfPerformProposed),
  },

  // ---- Precon & Design ----
  {
    key: "preconCostPct",
    label: "Precon Cost % of Estimate",
    format: "percent",
    group: "Precon & Design",
    calc: (r) => div(r.preconCost, r.estimateValue),
  },
  {
    key: "designCostPct",
    label: "Design Cost % of Estimate",
    format: "percent",
    group: "Precon & Design",
    calc: (r) => div(r.designCost, r.estimateValue),
  },
  {
    key: "preconPlusDesignPct",
    label: "Precon + Design % of Estimate",
    format: "percent",
    group: "Precon & Design",
    calc: (r) => div(addSome(r.preconCost, r.designCost), r.estimateValue),
  },
  {
    key: "preconCostPerGsf",
    label: "Precon Cost $ per GSF",
    format: "dollars",
    group: "Precon & Design",
    calc: (r) => div(r.preconCost, r.gsf),
  },
  {
    key: "preconCostToFeeRatio",
    label: "Precon Cost / Expected Fee",
    format: "ratio",
    group: "Precon & Design",
    calc: (r) => div(r.preconCost, r.feeExpected),
  },

  // ---- Cost Composition ----
  {
    key: "directCostDollars",
    label: "Direct Cost $ (Est − Fee − Contingency)",
    format: "dollars",
    group: "Cost Composition",
    calc: (r) => directCost(r),
  },
  {
    key: "directCostPct",
    label: "Direct Cost % of Estimate",
    format: "percent",
    group: "Cost Composition",
    calc: (r) => div(directCost(r), r.estimateValue),
  },
  {
    key: "subcontractedPct",
    label: "Subcontracted % of Estimate",
    format: "percent",
    group: "Cost Composition",
    headline: true,
    calc: (r) => div(r.subcontracted, r.estimateValue),
  },
  {
    key: "materialsPct",
    label: "Materials % of Estimate",
    format: "percent",
    group: "Cost Composition",
    calc: (r) => div(r.materials, r.estimateValue),
  },
  {
    key: "equipmentPct",
    label: "Equipment % of Estimate",
    format: "percent",
    group: "Cost Composition",
    calc: (r) => div(r.equipment, r.estimateValue),
  },
  {
    key: "suppliesPct",
    label: "Supplies % of Estimate",
    format: "percent",
    group: "Cost Composition",
    calc: (r) => div(r.supplies, r.estimateValue),
  },
  {
    key: "buyoutExposurePct",
    label: "Buyout Exposure % (Sub + Material + Equip)",
    format: "percent",
    group: "Cost Composition",
    note: "Share of the estimate carried by purchased scope",
    calc: (r) => div(addSome(r.subcontracted, r.materials, r.equipment), r.estimateValue),
  },
  {
    key: "selfPerformToSubRatio",
    label: "Self-Perform / Subcontracted Ratio",
    format: "ratio",
    group: "Cost Composition",
    calc: (r) => div(r.selfPerformProposed, r.subcontracted),
  },

  // ---- Project Attributes ----
  {
    key: "costPerGsf",
    label: "Estimate $ per GSF",
    format: "dollars",
    group: "Project Attributes",
    headline: true,
    calc: (r) => div(r.estimateValue, r.gsf),
  },
  {
    key: "directCostPerGsf",
    label: "Direct Cost $ per GSF",
    format: "dollars",
    group: "Project Attributes",
    calc: (r) => div(directCost(r), r.gsf),
  },
  {
    key: "costPerUnit",
    label: "Estimate $ per Key / Unit / Bed",
    format: "dollars",
    group: "Project Attributes",
    calc: (r) => div(r.estimateValue, r.hotelKeysUnits),
  },
  {
    key: "gsfPerUnit",
    label: "GSF per Key / Unit / Bed",
    format: "number",
    group: "Project Attributes",
    calc: (r) => div(r.gsf, r.hotelKeysUnits),
  },

  // ---- Schedule ----
  {
    key: "revenuePerScheduleMonth",
    label: "Revenue per Schedule Month",
    format: "dollars",
    group: "Schedule",
    headline: true,
    calc: (r) => div(r.estimateValue, r.projectScheduleDuration),
  },
  {
    key: "gsfPerScheduleMonth",
    label: "GSF per Schedule Month",
    format: "number",
    group: "Schedule",
    calc: (r) => div(r.gsf, r.projectScheduleDuration),
  },
  {
    key: "scheduleMonthsPerTenMillion",
    label: "Schedule Months per $10M",
    format: "number",
    group: "Schedule",
    calc: (r) =>
      r.estimateValue == null || r.estimateValue === 0
        ? null
        : div(r.projectScheduleDuration, r.estimateValue / 10_000_000),
  },

  // ---- Market Engagement ----
  {
    key: "mwdbeQuotePct",
    label: "MWDBE % of Sub Quotes Received",
    format: "percent",
    group: "Market Engagement",
    calc: (r) => div(r.mwdbeSubQuotesReceived, r.subQuotesReceived),
  },
  {
    key: "mwdbePluggedPct",
    label: "MWDBE Plugged % of Estimate",
    format: "percent",
    group: "Market Engagement",
    calc: (r) => div(r.mwdbeSubsPlugged, r.estimateValue),
  },
  {
    key: "mwdbePluggedPctOfSub",
    label: "MWDBE Plugged % of Subcontracted",
    format: "percent",
    group: "Market Engagement",
    calc: (r) => div(r.mwdbeSubsPlugged, r.subcontracted),
  },
  {
    key: "subQuotesPerMillion",
    label: "Sub Quotes per $1M Estimate",
    format: "ratio",
    group: "Market Engagement",
    calc: (r) =>
      r.estimateValue == null || r.estimateValue === 0
        ? null
        : div(r.subQuotesReceived, r.estimateValue / 1_000_000),
  },
  {
    key: "feeOnCostOfWorkBasisPct",
    label: "Fee % of Cost of Work Basis (Rates Only)",
    format: "percent",
    group: "Market Engagement",
    note: "Applies to Rate Only pricing rounds",
    calc: (r) => div(r.feeExpected, r.costOfWorkBasis),
  },
];

export const METRIC_MAP: Record<string, MetricDef> = Object.fromEntries(
  METRIC_DEFS.map((m) => [m.key, m]),
);

export const METRIC_GROUPS: MetricGroup[] = [
  ...new Set(METRIC_DEFS.map((m) => m.group)),
];

export const HEADLINE_METRIC_KEYS = METRIC_DEFS.filter((m) => m.headline).map((m) => m.key);

export function formatMetricValue(value: number | null, format: MetricFormat): string {
  if (value == null || !isFinite(value)) return "—";
  switch (format) {
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "dollars":
      return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });
    case "ratio":
      return value.toFixed(2);
    default:
      return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
}
