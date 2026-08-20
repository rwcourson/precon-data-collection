import "server-only";

import { tool } from "ai";
import { z } from "zod";
import type { EstimateRound } from "@/db/schema";
import type { Principal } from "@/lib/authorization/types";
import {
  formatAwardableShadowBrief,
  toAwardableReportingRows,
} from "@/lib/awardable-reporting";
import {
  type CopilotPlan,
  planDashboardFromPrompt,
  planDashboardWithOptionalLlm,
} from "@/lib/dashboard-copilot";
import {
  dashboardCreateSchema,
  widgetConfigSchema,
} from "@/lib/dashboard-domain";
import { resolveWidgets } from "@/lib/dashboard-query";
import { sanitizePlan } from "@/lib/dashboard-sanitize";
import { fmtDollars, fmtNumber, fmtPercent } from "@/lib/format";
import { computeStats, rollup } from "@/lib/rollup";
import { copilotQueryService } from "@/services/copilot-query-service";

const REGION_LABELS = [
  "Central",
  "Carolinas",
  "Florida",
  "Georgia",
  "Texas",
] as const;

function filterRounds(
  rounds: EstimateRound[],
  region?: string | null,
  bidYear?: number | null
): EstimateRound[] {
  let out = rounds;
  if (region) {
    out = out.filter(
      (r) => (r.region || "").toLowerCase() === region.toLowerCase()
    );
  }
  if (bidYear != null) {
    out = out.filter((r) => r.bidYear === bidYear);
  }
  return out;
}

function buildBrief(rounds: EstimateRound[]): string {
  const totals = computeStats("all", rounds);
  const byRegion = rollup(rounds, (r) => r.region || "Unclassified").slice(
    0,
    8
  );
  const bySector = rollup(
    rounds,
    (r) => r.marketSector || "Unclassified"
  ).slice(0, 8);
  const years = [...new Set(rounds.map((r) => r.bidYear))].sort();
  const shadow = formatAwardableShadowBrief(toAwardableReportingRows(rounds));
  return [
    `Rounds: ${fmtNumber(totals.rounds)}`,
    `Pursuit volume: ${fmtDollars(totals.volume, true)}`,
    `Win rate: ${fmtPercent(totals.winRate)}`,
    `Expected fee: ${fmtDollars(totals.totalFee, true)}`,
    `Fee % (weighted): ${fmtPercent(totals.weightedFeePct)}`,
    `${shadow.coverageLine} · ${shadow.grain.coverage}`,
    `Bid years: ${years.join(", ") || "—"}`,
    "Volume by region:",
    ...byRegion.map(
      (g) =>
        `  - ${g.key}: ${fmtDollars(g.volume, true)} · ${g.rounds} rounds · win ${fmtPercent(g.winRate)}`
    ),
    "Volume by market sector:",
    ...bySector.map(
      (g) => `  - ${g.key}: ${fmtDollars(g.volume, true)} · ${g.rounds} rounds`
    ),
  ].join("\n");
}

const metricEnum = z.enum([
  "estimateValue",
  "feeExpected",
  "feeExpectedPct",
  "contingencyTotal",
  "roundCount",
  "winRate",
]);

export type MagnusToolContext = {
  rounds: EstimateRound[];
  /** Last plan on the canvas — used by refine_dashboard when the model omits it. */
  previousPlan?: CopilotPlan | null;
  /** When set, data tools run as this Principal (same wrappers Eve uses). */
  principal?: Principal;
};

function createPrincipalDataTools(principal: Principal) {
  return {
    query_efforts: tool({
      description:
        "List visibility-scoped efforts with optional status, home region, department, or bid year filters.",
      inputSchema: z.object({
        status: z.string().optional(),
        homeRegion: z.string().optional(),
        department: z.string().optional(),
        bidYear: z.number().int().optional(),
      }),
      execute: async (input) =>
        copilotQueryService.queryEfforts(principal, input),
    }),
    query_needs_staffing: tool({
      description:
        "Upcoming efforts with no team assigned — the same phase-7 Needs staffing preset as Overview.",
      inputSchema: z.object({
        regions: z.array(z.string()).optional(),
        departments: z.array(z.string()).optional(),
      }),
      execute: async (input) =>
        copilotQueryService.queryNeedsStaffing(principal, {
          regions: input.regions ?? [],
          departments: input.departments ?? [],
        }),
    }),
    search_notes: tool({
      description:
        "Search effort notes the caller can read. Returns excerpts plus job/round citations.",
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: async ({ query }) =>
        copilotQueryService.searchNotes(principal, query),
    }),
    person_history: tool({
      description:
        "Efforts a directory person worked in a year, from estimateLead plus staffing marks.",
      inputSchema: z.object({
        name: z.string().optional(),
        userId: z.number().int().optional(),
        year: z.number().int().min(2015).max(2040),
      }),
      execute: async (input) =>
        copilotQueryService.personHistory(principal, input),
    }),
    plan_chart: tool({
      description:
        "Build a dashboard/chart spec from a natural-language request for the canvas.",
      inputSchema: z.object({
        intent: z.string().min(2).max(500),
      }),
      execute: async ({ intent }) =>
        copilotQueryService.planChart(principal, intent),
    }),
  };
}

export function createMagnusTools(ctx: MagnusToolContext) {
  return {
    ...(ctx.principal ? createPrincipalDataTools(ctx.principal) : {}),
    get_portfolio_brief: tool({
      description:
        "Get a compact portfolio snapshot (volume, win rate, fee, region/sector mix). Call before answering data questions.",
      inputSchema: z.object({
        region: z
          .enum(REGION_LABELS)
          .optional()
          .describe("Optional region scope"),
        bidYear: z.number().int().min(2015).max(2040).optional(),
      }),
      execute: async ({ region, bidYear }) => {
        const scoped = filterRounds(ctx.rounds, region, bidYear);
        return {
          region: region ?? null,
          bidYear: bidYear ?? null,
          roundCount: scoped.length,
          brief: buildBrief(scoped),
        };
      },
    }),

    answer_metric: tool({
      description:
        "Compute a single allowlisted metric for optional region/year filters.",
      inputSchema: z.object({
        metric: metricEnum,
        region: z.enum(REGION_LABELS).optional(),
        bidYear: z.number().int().min(2015).max(2040).optional(),
      }),
      execute: async ({ metric, region, bidYear }) => {
        const scoped = filterRounds(ctx.rounds, region, bidYear);
        const totals = computeStats(region ?? "all", scoped);
        const contingencyDollars =
          totals.weightedContingencyPct != null
            ? totals.volume * totals.weightedContingencyPct
            : 0;
        const map: Record<string, number | null> = {
          estimateValue: totals.volume,
          feeExpected: totals.totalFee,
          feeExpectedPct: totals.weightedFeePct,
          contingencyTotal: contingencyDollars,
          roundCount: totals.rounds,
          winRate: totals.winRate,
        };
        const raw = map[metric] ?? 0;
        const n = raw ?? 0;
        const formatted =
          metric === "winRate" || metric === "feeExpectedPct"
            ? fmtPercent(n)
            : metric === "roundCount"
              ? fmtNumber(n)
              : fmtDollars(n, true);
        return {
          metric,
          region: region ?? null,
          bidYear: bidYear ?? null,
          raw: n,
          formatted,
          rounds: scoped.length,
        };
      },
    }),

    plan_dashboard: tool({
      description:
        "Build a Power BI–style multi-widget dashboard plan from a natural language request. Returns a sanitized plan the UI can preview and save.",
      inputSchema: z.object({
        intent: z
          .string()
          .min(2)
          .max(500)
          .describe(
            "User request for the dashboard / scorecard / report visuals"
          ),
        preferRegion: z.enum(REGION_LABELS).optional(),
      }),
      execute: async ({ intent, preferRegion }) => {
        const prompt = preferRegion
          ? `${intent} (focus on ${preferRegion})`
          : intent;
        const plan = await planDashboardWithOptionalLlm(prompt);
        const widgets = resolveWidgets(plan.widgets, ctx.rounds);
        return {
          plan,
          widgets,
          widgetCount: plan.widgets.length,
          emptyWidgets: widgets.filter((w) => w.empty).length,
          previewTitles: plan.widgets.map((w) => w.title),
        };
      },
    }),

    refine_dashboard: tool({
      description:
        "Modify an existing dashboard plan (swap chart kinds, add filters, rename, add/remove widgets).",
      inputSchema: z.object({
        instruction: z.string().min(2).max(500),
        previousPlan: z
          .object({
            name: z.string(),
            description: z.string(),
            scope: z.enum(["personal", "region", "corporate"]),
            widgets: z.array(widgetConfigSchema).max(12),
            rationale: z.array(z.string()).optional(),
            engine: z.enum(["rules", "opus5-zdr"]).optional(),
          })
          .optional(),
      }),
      execute: async ({ instruction, previousPlan }) => {
        const base =
          (previousPlan as CopilotPlan | undefined) ?? ctx.previousPlan;
        const seed = base
          ? `Refine this dashboard named "${base.name}" with widgets: ${base.widgets
              .map((w) => `${w.kind}:${w.title}`)
              .join("; ")}. Instruction: ${instruction}`
          : instruction;
        // Re-plan from instruction + seed context; sanitize enforces allowlists.
        const plan = await planDashboardWithOptionalLlm(seed);
        // Preserve name if user only tweaked widgets slightly
        if (base && !/rename|call it|title/i.test(instruction)) {
          plan.name = base.name;
          plan.description = base.description || plan.description;
        }
        const validated = dashboardCreateSchema.parse({
          name: plan.name,
          description: plan.description,
          scope: "personal",
          widgets: plan.widgets,
        });
        const sanitized = sanitizePlan({
          ...plan,
          name: validated.name,
          description: validated.description ?? plan.description,
          widgets: validated.widgets,
          scope: "personal",
        });
        const widgets = resolveWidgets(sanitized.widgets, ctx.rounds);
        return {
          plan: sanitized,
          widgets,
          widgetCount: sanitized.widgets.length,
          previewTitles: sanitized.widgets.map((w) => w.title),
        };
      },
    }),

    /** Deterministic local planner — used when gateway is off or as a fast path. */
    plan_dashboard_rules: tool({
      description:
        "Fast local rules-based dashboard planner (no LLM). Prefer plan_dashboard when AI is available.",
      inputSchema: z.object({
        intent: z.string().min(2).max(500),
      }),
      execute: async ({ intent }) => {
        const plan = planDashboardFromPrompt(intent);
        const widgets = resolveWidgets(plan.widgets, ctx.rounds);
        return {
          plan,
          widgets,
          widgetCount: plan.widgets.length,
          previewTitles: plan.widgets.map((w) => w.title),
        };
      },
    }),
  };
}

export type MagnusTools = ReturnType<typeof createMagnusTools>;
