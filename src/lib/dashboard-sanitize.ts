import type { DashboardWidgetConfig } from "@/db/schema";
import type { CopilotPlan } from "@/lib/dashboard-copilot";

const ALLOWED_METRICS = new Set([
  "estimateValue",
  "feeExpected",
  "feeExpectedPct",
  "contingencyTotal",
  "roundCount",
  "winRate",
]);

const ALLOWED_GROUP_BY = new Set([
  "region",
  "preconDepartment",
  "marketSector",
  "estimatePhase",
  "bidYear",
  "status",
  "outcome",
  "sizeBucket",
]);

const ALLOWED_FILTER_FIELDS = new Set([
  "region",
  "preconDepartment",
  "marketSector",
  "estimatePhase",
  "bidYear",
  "status",
  "outcome",
]);

const STATUS_VALUES = new Set([
  "active",
  "upcoming",
  "outstanding",
  "submitted",
  "post_bid",
  "locked",
]);

const OUTCOME_VALUES = new Set(["pending", "successful", "unsuccessful"]);

const REGION_ALIASES: Record<string, string> = {
  florida: "Florida",
  fl: "Florida",
  georgia: "Georgia",
  ga: "Georgia",
  texas: "Texas",
  tx: "Texas",
  central: "Central",
  carolinas: "Carolinas",
  car: "Carolinas",
};

/** Map natural language / model mistakes onto real enum values. */
function normalizeFilterValue(field: string, value: string): string | null {
  const raw = value.trim();
  const lower = raw.toLowerCase();

  if (field === "outcome") {
    if (OUTCOME_VALUES.has(lower)) return lower;
    if (/(^won$|win|award|successful|success)/i.test(lower))
      return "successful";
    if (/(^lost$|lose|unsuccessful|fail)/i.test(lower)) return "unsuccessful";
    if (/pending|open|undecided/.test(lower)) return "pending";
    return null;
  }

  if (field === "status") {
    if (STATUS_VALUES.has(lower)) return lower;
    if (lower === "post-bid" || lower === "postbid") return "post_bid";
    if (/active|in.?flight|live/.test(lower)) return "active";
    if (/upcoming|future/.test(lower)) return "upcoming";
    if (/outstanding|late|overdue/.test(lower)) return "outstanding";
    if (/submitted|bid/.test(lower)) return "submitted";
    if (/locked|closed|complete/.test(lower)) return "locked";
    // "won" is an outcome, not a status
    if (/won|successful/.test(lower)) return null;
    return null;
  }

  if (field === "region") {
    return (
      REGION_ALIASES[lower] ??
      (/^[A-Z]/.test(raw) ? raw : raw.replace(/^./, (c) => c.toUpperCase()))
    );
  }

  if (field === "bidYear") {
    const y = raw.match(/20\d{2}/)?.[0];
    return y ?? null;
  }

  return raw || null;
}

function normalizeGroupBy(groupBy: string | null | undefined): string | null {
  if (!groupBy) return null;
  const g = groupBy.trim();
  if (ALLOWED_GROUP_BY.has(g)) return g;
  const lower = g.toLowerCase();
  if (/bucket|size|tier|band|value.?band/.test(lower)) return "sizeBucket";
  if (/region/.test(lower)) return "region";
  if (/department|division|precon/.test(lower)) return "preconDepartment";
  if (/sector|market/.test(lower)) return "marketSector";
  if (/phase/.test(lower)) return "estimatePhase";
  if (/year/.test(lower)) return "bidYear";
  if (/status|pipeline/.test(lower)) return "status";
  if (/outcome|win.?loss|result/.test(lower)) return "outcome";
  return "region";
}

function normalizeMetric(metric: string | null | undefined): string {
  if (metric && ALLOWED_METRICS.has(metric)) return metric;
  const lower = (metric ?? "").toLowerCase();
  if (/win/.test(lower)) return "winRate";
  if (/fee\s*%|percent/.test(lower)) return "feeExpectedPct";
  if (/fee/.test(lower)) return "feeExpected";
  if (/contingenc/.test(lower)) return "contingencyTotal";
  if (/count|round/.test(lower)) return "roundCount";
  return "estimateValue";
}

const METRIC_LABELS: Record<string, string> = {
  estimateValue: "Pursuit volume",
  feeExpected: "Expected fee",
  feeExpectedPct: "Fee percentage",
  contingencyTotal: "Contingency",
  roundCount: "Estimate rounds",
  winRate: "Win rate",
};

const GROUP_LABELS: Record<string, string> = {
  region: "Region",
  preconDepartment: "Precon department",
  marketSector: "Market sector",
  estimatePhase: "Estimate phase",
  bidYear: "Bid year",
  status: "Status",
  outcome: "Outcome",
  sizeBucket: "Pursuit size",
};

/** Rewrite camelCase / raw-key titles into human labels. */
function polishTitle(
  title: string,
  metricKey: string,
  groupBy: string | null,
  kind: string
): string {
  const trimmed = title.trim();
  const looksRaw =
    !trimmed ||
    /[a-z][A-Z]/.test(trimmed) ||
    /\b(estimateValue|feeExpected|roundCount|winRate|sizeBucket|marketSector|bidYear|preconDepartment)\b/.test(
      trimmed
    );
  if (!looksRaw) return trimmed;

  const metric = METRIC_LABELS[metricKey] ?? metricKey;
  const group = groupBy ? (GROUP_LABELS[groupBy] ?? groupBy) : null;
  switch (kind) {
    case "kpi":
      return metric;
    case "pie":
    case "donut":
      return group ? `${metric} mix by ${group}` : `${metric} mix`;
    case "line":
    case "area":
      return `${metric} over time`;
    case "combo":
      return "Volume & win rate by Bid year";
    case "waterfall":
      return "Pipeline bridge (won · pending · lost)";
    case "table":
      return group ? `${group} detail` : `${metric} detail`;
    case "projection":
      return "Volume projection";
    default:
      return group ? `${metric} by ${group}` : metric;
  }
}

export function sanitizeWidgetConfig(
  config: DashboardWidgetConfig
): DashboardWidgetConfig {
  const filters = (config.filters ?? [])
    .map((f) => {
      let field = f.field.trim();
      // Common model mistakes
      if (field === "won" || field === "win") field = "outcome";
      if (field === "bucket" || field === "sizeBucket") return null;
      if (!ALLOWED_FILTER_FIELDS.has(field)) return null;
      const value = normalizeFilterValue(field, f.value);
      if (value == null) return null;
      const op = ["eq", "contains", "gt", "lt", "gte", "lte"].includes(f.op)
        ? f.op
        : "eq";
      return { field, op, value };
    })
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  const metricKey = normalizeMetric(config.metricKey);
  const groupBy = normalizeGroupBy(config.groupBy);
  return {
    ...config,
    title: polishTitle(config.title, metricKey, groupBy, config.kind),
    metricKey,
    groupBy,
    filters: filters.length ? filters : undefined,
  };
}

export function sanitizePlan(plan: CopilotPlan): CopilotPlan {
  return {
    ...plan,
    widgets: plan.widgets.map(sanitizeWidgetConfig),
  };
}

/** Schema text injected into Magnus prompts so filters match Neon enums. */
export const MAGNUS_DATA_CONTRACT = `
Allowlisted metrics: estimateValue, feeExpected, feeExpectedPct, contingencyTotal, roundCount, winRate.
Allowlisted groupBy: region, preconDepartment, marketSector, estimatePhase, bidYear, status, outcome, sizeBucket.
Widget kinds: kpi, table, bar, horizontal_bar, stacked_bar, line, area, pie, donut, projection, reconciliation, combo, waterfall.
combo = volume bars + win-rate line by bid year. waterfall = won/pending/lost/total pipeline bridge.
sizeBucket = pursuit value bands (<$10M, $10–50M, $50–100M, $100–250M, $250M+).
status values ONLY: active | upcoming | outstanding | submitted | post_bid | locked.
outcome values ONLY: pending | successful | unsuccessful.
"Won" means outcome=successful. "Active" means status=active. Never filter status=won.
Filter fields ONLY: region, preconDepartment, marketSector, estimatePhase, bidYear, status, outcome.
Prefer fewer filters. If unsure, omit filters so widgets show data.
`.trim();
