import { generateObject } from "ai";
import { z } from "zod";
import type { DashboardWidgetConfig } from "@/db/schema";
import { AI_MODEL_ID, AI_MODEL_LABEL, gatewayZdrOptions, getZdrModel, isAiConfigured } from "@/lib/ai/gateway";
import { dashboardCreateSchema, widgetConfigSchema } from "@/lib/dashboard-domain";
import { MAGNUS_DATA_CONTRACT, sanitizePlan } from "@/lib/dashboard-sanitize";

export type CopilotPlan = {
  name: string;
  description: string;
  scope: "personal" | "region" | "corporate";
  widgets: DashboardWidgetConfig[];
  rationale: string[];
  engine: "rules" | "opus5-zdr";
};

export { AI_MODEL_LABEL };

const REGION_WORDS = [
  "central",
  "carolinas",
  "florida",
  "georgia",
  "texas",
  "southeast",
  "mid-atlantic",
];

function detectGroupBy(prompt: string): string {
  if (/department|division|precon dept/i.test(prompt)) return "preconDepartment";
  if (/sector|market/i.test(prompt)) return "marketSector";
  if (/phase/i.test(prompt)) return "estimatePhase";
  if (/year|trend|over time|timeline|history/i.test(prompt)) return "bidYear";
  if (/status|pipeline/i.test(prompt)) return "status";
  if (/outcome|win.?loss|award/i.test(prompt)) return "outcome";
  if (/region/i.test(prompt)) return "region";
  return "region";
}

function detectMetric(prompt: string): string {
  if (/win.?rate|hit rate|success rate/i.test(prompt)) return "winRate";
  if (/fee\s*%|fee percent|margin/i.test(prompt)) return "feeExpectedPct";
  if (/fee|stipulated fee/i.test(prompt)) return "feeExpected";
  if (/contingenc/i.test(prompt)) return "contingencyTotal";
  if (/count|how many|number of|# of|rounds/i.test(prompt)) return "roundCount";
  return "estimateValue";
}

function detectRegionFilter(prompt: string): DashboardWidgetConfig["filters"] | undefined {
  for (const r of REGION_WORDS) {
    if (prompt.toLowerCase().includes(r)) {
      const label =
        r === "carolinas"
          ? "Carolinas"
          : r === "central"
            ? "Central"
            : r === "florida"
              ? "Florida"
              : r === "georgia"
                ? "Georgia"
                : r === "texas"
                  ? "Texas"
                  : r;
      // Only apply when it looks like a real region name we store.
      if (["Central", "Carolinas", "Florida", "Georgia", "Texas"].includes(label)) {
        return [{ field: "region", op: "eq", value: label }];
      }
    }
  }
  return undefined;
}

function titleCaseMetric(metric: string): string {
  return (
    {
      estimateValue: "Pursuit volume",
      feeExpected: "Expected fee",
      feeExpectedPct: "Fee percentage",
      contingencyTotal: "Contingency dollars",
      roundCount: "Estimate rounds",
      winRate: "Win rate",
    }[metric] ?? metric
  );
}

function titleCaseGroup(groupBy: string): string {
  return (
    {
      region: "Region",
      preconDepartment: "Precon department",
      marketSector: "Market sector",
      estimatePhase: "Estimate phase",
      bidYear: "Bid year",
      status: "Status",
      outcome: "Outcome",
      sizeBucket: "Size bucket",
    }[groupBy] ?? groupBy
  );
}

function humanWidgetTitle(
  kind: string,
  metric: string,
  groupBy?: string,
): string {
  const m = titleCaseMetric(metric);
  const g = groupBy ? titleCaseGroup(groupBy) : null;
  switch (kind) {
    case "kpi":
      return m;
    case "pie":
      return `${m} share by ${g ?? "group"}`;
    case "donut":
      return `${m} mix by ${g ?? "group"}`;
    case "horizontal_bar":
      return `${m} ranking by ${g ?? "group"}`;
    case "bar":
      return `${m} by ${g ?? "group"}`;
    case "stacked_bar":
      return `${m} stacked by ${g ?? "Bid year"}`;
    case "line":
      return g === "Bid year" ? `${m} trend by Bid year` : `${m} over time`;
    case "area":
      return `${m} trend`;
    case "table":
      return g ? `Top pursuits by ${g.toLowerCase()}` : "Pursuit detail table";
    case "projection":
      return "Volume projection";
    default:
      return g ? `${m} · ${g}` : m;
  }
}

function planWonActiveBuckets(prompt: string): CopilotPlan {
  const widgets: DashboardWidgetConfig[] = [
    {
      title: "Won pursuit volume",
      kind: "kpi",
      metricKey: "estimateValue",
      filters: [{ field: "outcome", op: "eq", value: "successful" }],
      layout: { w: 3, h: 2, x: 0, y: 0 },
    },
    {
      title: "Active pipeline volume",
      kind: "kpi",
      metricKey: "estimateValue",
      filters: [{ field: "status", op: "eq", value: "active" }],
      layout: { w: 3, h: 2, x: 3, y: 0 },
    },
    {
      title: "Won bid count",
      kind: "kpi",
      metricKey: "roundCount",
      filters: [{ field: "outcome", op: "eq", value: "successful" }],
      layout: { w: 3, h: 2, x: 6, y: 0 },
    },
    {
      title: "Active bid count",
      kind: "kpi",
      metricKey: "roundCount",
      filters: [{ field: "status", op: "eq", value: "active" }],
      layout: { w: 3, h: 2, x: 9, y: 0 },
    },
    {
      title: "Pursuit volume by size bucket",
      kind: "bar",
      metricKey: "estimateValue",
      groupBy: "sizeBucket",
      layout: { w: 7, h: 4, x: 0, y: 2 },
    },
    {
      title: "Won versus pending versus lost",
      kind: "donut",
      metricKey: "estimateValue",
      groupBy: "outcome",
      layout: { w: 5, h: 4, x: 7, y: 2 },
    },
    {
      title: "Size bucket detail table",
      kind: "table",
      metricKey: "estimateValue",
      groupBy: "sizeBucket",
      layout: { w: 12, h: 4, x: 0, y: 6 },
    },
  ];
  return sanitizePlan({
    name: "Won & active bid buckets",
    description: `Bucketed pursuit value for won and active bids — from “${prompt.trim()}”`,
    scope: "personal",
    widgets,
    rationale: [
      "Won = outcome successful; Active = status active.",
      "Size buckets use estimate value bands.",
    ],
    engine: "rules",
  });
}

/** Rule-based multi-widget dashboard planner (no network). */
export function planDashboardFromPrompt(prompt: string): CopilotPlan {
  const trimmed = prompt.trim();
  if (/bucket/i.test(trimmed) && /(won|active|win)/i.test(trimmed)) {
    return planWonActiveBuckets(trimmed);
  }

  const groupBy = /bucket|size.?tier|value.?band/i.test(trimmed)
    ? "sizeBucket"
    : detectGroupBy(trimmed);
  const metric = detectMetric(trimmed);
  const filters = detectRegionFilter(trimmed);
  const wantsMix = /mix|share|composition|breakdown|pie|donut|distribution/i.test(trimmed);
  const wantsTrend = /trend|over time|timeline|history|year|forecast|project/i.test(trimmed);
  const wantsTable = /table|grid|list|detail/i.test(trimmed);
  const wantsExec =
    /executive|overview|summary|full|dashboard|scorecard|kpi/i.test(trimmed) ||
    trimmed.split(/\s+/).length < 6;

  const widgets: DashboardWidgetConfig[] = [];
  const rationale: string[] = [];

  // Always lead with a KPI for the primary metric.
  widgets.push({
    title: titleCaseMetric(metric),
    kind: "kpi",
    metricKey: metric,
    filters,
    layout: { w: 3, h: 2, x: 0, y: 0 },
  });
  widgets.push({
    title: "Estimate rounds",
    kind: "kpi",
    metricKey: "roundCount",
    filters,
    layout: { w: 3, h: 2, x: 3, y: 0 },
  });
  widgets.push({
    title: "Win rate",
    kind: "kpi",
    metricKey: "winRate",
    filters,
    format: "percent",
    layout: { w: 3, h: 2, x: 6, y: 0 },
  });
  widgets.push({
    title: "Fee expected",
    kind: "kpi",
    metricKey: "feeExpected",
    filters,
    layout: { w: 3, h: 2, x: 9, y: 0 },
  });
  rationale.push("Four KPI tiles for volume, activity, win rate, and fee.");

  if (wantsMix || wantsExec) {
    const kind = wantsMix && /donut/i.test(trimmed) ? "donut" : "pie";
    widgets.push({
      title: humanWidgetTitle(kind, metric, groupBy),
      kind,
      metricKey: metric,
      groupBy,
      filters,
      layout: { w: 4, h: 4, x: 0, y: 2 },
    });
    rationale.push(`Composition chart (${wantsMix ? "requested" : "default"}) by ${groupBy}.`);
  }

  {
    const kind = groupBy === "bidYear" ? "bar" : "horizontal_bar";
    widgets.push({
      title: humanWidgetTitle(kind, metric, groupBy),
      kind,
      metricKey: metric,
      groupBy,
      filters,
      layout: { w: wantsMix || wantsExec ? 8 : 12, h: 4, x: wantsMix || wantsExec ? 4 : 0, y: 2 },
    });
    rationale.push(`Ranked ${groupBy === "bidYear" ? "vertical" : "horizontal"} bars for comparison.`);
  }

  if (wantsTrend || wantsExec) {
    const trendKind = /area|fill/i.test(trimmed) ? "area" : "line";
    widgets.push({
      title: humanWidgetTitle(trendKind, metric, "bidYear"),
      kind: trendKind,
      metricKey: metric,
      groupBy: "bidYear",
      filters,
      layout: { w: 8, h: 4, x: 0, y: 6 },
    });
    const stackGroup = groupBy === "bidYear" ? "region" : groupBy;
    widgets.push({
      title: humanWidgetTitle("stacked_bar", "estimateValue", stackGroup),
      kind: "stacked_bar",
      metricKey: "estimateValue",
      groupBy: stackGroup,
      filters,
      layout: { w: 4, h: 4, x: 8, y: 6 },
    });
    rationale.push("Time series + stacked year composition for trajectory.");
  }

  if (wantsTable || wantsExec) {
    widgets.push({
      title: humanWidgetTitle("table", metric, groupBy),
      kind: "table",
      metricKey: metric,
      groupBy,
      filters,
      layout: { w: 12, h: 4, x: 0, y: 10 },
    });
    rationale.push("Detail table for exportable numbers.");
  }

  if (/forecast|projection|pipeline/i.test(trimmed)) {
    widgets.push({
      title: humanWidgetTitle("projection", "estimateValue", "bidYear"),
      kind: "projection",
      metricKey: "estimateValue",
      groupBy: "bidYear",
      filters,
      layout: { w: 12, h: 4, x: 0, y: 14 },
    });
    rationale.push("Projection widget for forward-looking volume.");
  }

  // Deduplicate titles while keeping order.
  const seen = new Set<string>();
  const unique = widgets.filter((w) => {
    const key = `${w.kind}:${w.title}:${w.metricKey}:${w.groupBy}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const regionBit = filters?.[0]?.value ? `${filters[0].value} ` : "";
  const planName = wantsExec
    ? `${regionBit}Executive precon scorecard`.trim()
    : `${regionBit}${titleCaseMetric(metric)} by ${titleCaseGroup(groupBy)}`.trim();

  const plan = sanitizePlan({
    name: planName,
    description: `Custom view for: ${trimmed}`,
    scope: "personal",
    widgets: unique.slice(0, 12),
    rationale,
    engine: "rules",
  });

  // Validate against create schema bounds.
  dashboardCreateSchema.parse({
    name: plan.name,
    description: plan.description,
    scope: plan.scope,
    widgets: plan.widgets,
  });

  return plan;
}

const llmPlanSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  rationale: z.array(z.string().max(200)).max(8),
  widgets: z.array(widgetConfigSchema).min(1).max(10),
});

/**
 * Claude Opus 5 via Vercel AI Gateway with ZDR forced.
 * Falls back to the deterministic rules planner only if the gateway key is missing
 * or the model call fails — never routes to OpenAI or non-ZDR models.
 */
export async function planDashboardWithOptionalLlm(prompt: string): Promise<CopilotPlan> {
  const base = planDashboardFromPrompt(prompt);
  if (!isAiConfigured()) return base;

  try {
    const { object } = await generateObject({
      model: getZdrModel(),
      ...gatewayZdrOptions(),
      schema: llmPlanSchema,
      system: `You are a senior Preconstruction analytics designer (Power BI caliber) for B&G.
Design personal dashboards from allowlisted metrics and viz kinds only.

Craft rules:
- Lead with 3–4 KPIs that frame the story (volume, rounds, win rate, fee) when building scorecards.
- Ranking → horizontal_bar; ordered categories (year/size) → bar; mix → one donut/pie max; trajectory → line/area; export → table.
- Never put winRate or feeExpectedPct on a currency chart; keep those as percent metrics.
- Widget titles: short, human, specific — never camelCase or raw field keys.
  Good: "Pursuit volume ranking by Region", "Win rate by Market sector", "Pipeline mix by Status".
  Bad: "estimateValue by region", "feeExpectedPct", "Group".
- Dashboard name: 3–7 words, title case (e.g. "Florida Pursuit Scorecard").
- Prefer 6–8 widgets; max 10. Balanced 12-column layout with {w,h,x,y}.
- Include a table only when the user asks for detail/breakdown/table OR an executive scorecard needs a bottom grid.
- For size bands / bucketized asks use groupBy=sizeBucket.
- If the user names a region, filter to it.
- Thin asks ("dashboard", "scorecard", "overview") still get a full executive page, not one chart.

${MAGNUS_DATA_CONTRACT}
Model: ${AI_MODEL_LABEL} (${AI_MODEL_ID}).`,
      prompt: `User request:\n${prompt}\n\nReturn a senior-analytics dashboard plan with polished names, smart chart kinds, and valid filters only.`,
    });

    const sanitized = sanitizePlan({
      name: object.name,
      description: object.description,
      scope: "personal",
      widgets: object.widgets,
      rationale: object.rationale,
      engine: "opus5-zdr",
    });

    const validated = dashboardCreateSchema.parse({
      name: sanitized.name,
      description: sanitized.description,
      scope: "personal",
      widgets: sanitized.widgets,
    });

    return {
      name: validated.name,
      description: validated.description ?? base.description,
      scope: "personal",
      widgets: validated.widgets,
      rationale: [AI_MODEL_LABEL, ...sanitized.rationale],
      engine: "opus5-zdr",
    };
  } catch {
    return {
      ...base,
      rationale: [
        `${AI_MODEL_LABEL} unavailable — used local rules planner. Ensure AI_GATEWAY_API_KEY is set.`,
        ...base.rationale,
      ],
    };
  }
}
