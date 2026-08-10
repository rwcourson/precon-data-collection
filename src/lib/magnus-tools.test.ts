import { describe, expect, it } from "vitest";
import type { EstimateRound } from "@/db/schema";
import { createMagnusTools } from "@/lib/ai/magnus-tools";
import { planDashboardFromPrompt } from "@/lib/dashboard-copilot";

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
    const result = await runTool<{
      region: string | null;
      roundCount: number;
      brief: string;
    }>(tools.get_portfolio_brief.execute, { region: "Florida" });
    expect(result.region).toBe("Florida");
    expect(result.roundCount).toBe(2);
    expect(result.brief).toMatch(/Win rate/);
  });

  it("answer_metric formats win rate", async () => {
    const tools = createMagnusTools({ rounds });
    const result = await runTool<{
      metric: string;
      raw: number;
      formatted: string;
    }>(tools.answer_metric.execute, { metric: "winRate", region: "Florida" });
    expect(result.metric).toBe("winRate");
    expect(result.raw).toBe(0.5);
    expect(result.formatted).toMatch(/%/);
  });

  it("plan_dashboard_rules returns resolved widgets with allowlisted metrics", async () => {
    const tools = createMagnusTools({ rounds });
    const result = await runTool<{
      plan: { widgets: { metricKey?: string | null }[] };
      widgets: unknown[];
    }>(tools.plan_dashboard_rules.execute, { intent: "Build a region scorecard" });
    expect(result.plan.widgets.length).toBeGreaterThan(0);
    expect(result.widgets.length).toBe(result.plan.widgets.length);
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
    }
  });

  it("rules planner still builds executive scorecards", () => {
    const plan = planDashboardFromPrompt("executive scorecard by region");
    expect(plan.widgets.some((w) => w.kind === "kpi")).toBe(true);
    expect(plan.widgets.length).toBeGreaterThanOrEqual(4);
  });
});
