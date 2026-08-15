import { describe, expect, it } from "vitest";
import type { EstimateRound } from "@/db/schema";
import { createMagnusTools } from "@/lib/ai/magnus-tools";
import { planDashboardFromPrompt } from "@/lib/dashboard-copilot";
import { sanitizePlan } from "@/lib/dashboard-sanitize";
import { fmtDollars, fmtPercent } from "@/lib/format";
import { computeStats, rollup } from "@/lib/rollup";

function round(partial: Partial<EstimateRound> & { id: number }): EstimateRound {
  return {
    jobId: 1,
    roundNumber: 1,
    region: "Florida",
    preconDepartment: "Building",
    marketSector: "Healthcare",
    estimatePhase: "Schematic",
    bidYear: 2026,
    status: "active",
    outcome: "pending",
    estimateValue: 50_000_000,
    feeExpected: 2_000_000,
    contingencyTotal: 1_000_000,
    ...partial,
  } as EstimateRound;
}

const toolOpts = {
  toolCallId: "test",
  messages: [],
  abortSignal: new AbortController().signal,
};

// AI SDK tool.execute may type as T | AsyncIterable<T>; our tools always return T.
async function runTool<T>(
  execute: unknown,
  input: unknown,
): Promise<T> {
  if (typeof execute !== "function") throw new Error("missing execute");
  return (await execute(input, toolOpts)) as T;
}

describe("magnus tools", () => {
  const rounds = [
    round({
      id: 1,
      region: "Florida",
      outcome: "successful",
      estimateValue: 80_000_000,
    }),
    round({
      id: 2,
      region: "Florida",
      outcome: "unsuccessful",
      estimateValue: 20_000_000,
    }),
    round({ id: 3, region: "Texas", outcome: "pending", estimateValue: 40_000_000 }),
  ];

  it("get_portfolio_brief returns scoped brief", async () => {
    const tools = createMagnusTools({ rounds });
    const florida = rounds.filter((r) => r.region === "Florida");
    const totals = computeStats("Florida", florida);
    const byRegion = rollup(florida, (r) => r.region || "Unclassified");
    const result = await runTool<{
      region: string | null;
      roundCount: number;
      brief: string;
    }>(tools.get_portfolio_brief.execute, { region: "Florida" });
    expect(result.region).toBe("Florida");
    expect(result.roundCount).toBe(totals.rounds);
    expect(result.brief).toContain(fmtDollars(totals.volume, true));
    expect(result.brief).toContain(fmtPercent(totals.winRate));
    expect(result.brief).toContain(fmtDollars(totals.totalFee, true));
    expect(result.brief).toContain(byRegion[0]!.key);
  });

  it("answer_metric formats win rate", async () => {
    const tools = createMagnusTools({ rounds });
    const florida = rounds.filter((r) => r.region === "Florida");
    const totals = computeStats("Florida", florida);
    const result = await runTool<{
      metric: string;
      raw: number;
      formatted: string;
    }>(tools.answer_metric.execute, { metric: "winRate", region: "Florida" });
    expect(result.metric).toBe("winRate");
    expect(result.raw).toBe(totals.winRate);
    expect(result.formatted).toBe(fmtPercent(totals.winRate));
  });

  it("plan_dashboard_rules returns resolved widgets with allowlisted metrics", async () => {
    const tools = createMagnusTools({ rounds });
    const result = await runTool<{
      plan: { widgets: { metricKey?: string | null; groupBy?: string | null; filters?: { field: string }[] }[] };
      widgets: unknown[];
    }>(tools.plan_dashboard_rules.execute, { intent: "Build a region scorecard" });
    expect(result.plan.widgets.length).toBeGreaterThan(0);
    expect(result.widgets.length).toBe(result.plan.widgets.length);
    const allowedMetrics = new Set([
      "estimateValue",
      "feeExpected",
      "feeExpectedPct",
      "contingencyTotal",
      "roundCount",
      "winRate",
    ]);
    const allowedGroup = new Set([
      "region",
      "preconDepartment",
      "marketSector",
      "estimatePhase",
      "bidYear",
      "status",
      "outcome",
      "sizeBucket",
    ]);
    const allowedFilters = new Set([
      "region",
      "preconDepartment",
      "marketSector",
      "estimatePhase",
      "bidYear",
      "status",
      "outcome",
    ]);
    for (const w of result.plan.widgets) {
      if (w.metricKey) expect(allowedMetrics.has(w.metricKey)).toBe(true);
      if (w.groupBy) expect(allowedGroup.has(w.groupBy)).toBe(true);
      for (const f of w.filters ?? []) expect(allowedFilters.has(f.field)).toBe(true);
    }
  });

  it("refine_dashboard sanitizes off-list metrics and filter fields", async () => {
    const tools = createMagnusTools({ rounds });
    const dirty = sanitizePlan({
      name: "Dirty",
      description: "off list",
      scope: "personal",
      widgets: [
        {
          title: "Secret",
          kind: "kpi",
          metricKey: "ssn",
          groupBy: "email",
          filters: [{ field: "password", op: "eq", value: "x" }],
          layout: { w: 3, h: 2, x: 0, y: 0 },
        },
      ],
      rationale: [],
      engine: "rules",
    });
    expect(dirty.widgets[0]!.metricKey).toBe("estimateValue");
    expect(dirty.widgets[0]!.filters ?? []).toEqual([]);

    const previousKey = process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    try {
      const result = await runTool<{
        plan: { widgets: { metricKey?: string | null; filters?: { field: string }[] }[] };
      }>(tools.refine_dashboard.execute, {
        instruction: "Keep a Florida win-rate scorecard",
        previousPlan: {
          name: "Dirty",
          description: "off list",
          scope: "personal",
          widgets: [
            {
              title: "Secret",
              kind: "kpi",
              metricKey: "estimateValue",
              layout: { w: 3, h: 2, x: 0, y: 0 },
            },
          ],
        },
      });
      for (const w of result.plan.widgets) {
        if (w.metricKey) {
          expect([
            "estimateValue",
            "feeExpected",
            "feeExpectedPct",
            "contingencyTotal",
            "roundCount",
            "winRate",
          ]).toContain(w.metricKey);
        }
        for (const f of w.filters ?? []) {
          expect([
            "region",
            "preconDepartment",
            "marketSector",
            "estimatePhase",
            "bidYear",
            "status",
            "outcome",
          ]).toContain(f.field);
        }
      }
    } finally {
      if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
      else process.env.AI_GATEWAY_API_KEY = previousKey;
    }
  });

  it("rules planner still builds executive scorecards", () => {
    const plan = planDashboardFromPrompt("executive scorecard by region");
    expect(plan.widgets.some((w) => w.kind === "kpi")).toBe(true);
    expect(plan.widgets.length).toBeGreaterThanOrEqual(4);
  });
});
