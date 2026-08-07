import "server-only";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import type { EstimateRound } from "@/db/schema";
import {
  AI_MODEL_ID,
  AI_MODEL_LABEL,
  gatewayZdrOptions,
  getZdrModel,
  isAiConfigured,
} from "@/lib/ai/gateway";
import {
  planDashboardFromPrompt,
  planDashboardWithOptionalLlm,
  type CopilotPlan,
} from "@/lib/dashboard-copilot";
import { fmtDollars, fmtNumber, fmtPercent } from "@/lib/format";
import { computeStats, rollup } from "@/lib/rollup";

export type MagnusTurn =
  | {
      mode: "answer";
      text: string;
      engine: "opus5-zdr" | "rules";
      model: typeof AI_MODEL_ID | "rules";
    }
  | {
      mode: "dashboard";
      text: string;
      plan: CopilotPlan;
      engine: CopilotPlan["engine"];
      model: typeof AI_MODEL_ID | "rules";
    };

function buildDataBrief(rounds: EstimateRound[]): string {
  const totals = computeStats("all", rounds);
  const byRegion = rollup(rounds, (r) => r.region || "Unclassified").slice(0, 8);
  const bySector = rollup(
    rounds,
    (r) => r.marketSector || "Unclassified",
  ).slice(0, 8);
  const years = [...new Set(rounds.map((r) => r.bidYear))].sort();

  const lines = [
    `Rounds: ${fmtNumber(totals.rounds)}`,
    `Pursuit volume: ${fmtDollars(totals.volume, true)}`,
    `Win rate: ${fmtPercent(totals.winRate)}`,
    `Expected fee: ${fmtDollars(totals.totalFee, true)}`,
    `Fee % (weighted): ${fmtPercent(totals.weightedFeePct)}`,
    `Bid years: ${years.join(", ") || "—"}`,
    "Volume by region:",
    ...byRegion.map(
      (g) =>
        `  - ${g.key}: ${fmtDollars(g.volume, true)} · ${g.rounds} rounds · win ${fmtPercent(g.winRate)}`,
    ),
    "Volume by market sector:",
    ...bySector.map(
      (g) =>
        `  - ${g.key}: ${fmtDollars(g.volume, true)} · ${g.rounds} rounds`,
    ),
  ];
  return lines.join("\n");
}

function looksLikeQuestion(prompt: string): boolean {
  return (
    /\?$/.test(prompt.trim()) ||
    /^(what|who|when|where|why|how|which|is|are|do|does|did|can|could|would|should|tell me|explain|summarize)\b/i.test(
      prompt.trim(),
    )
  );
}

function looksLikeDashboardRequest(prompt: string): boolean {
  if (looksLikeQuestion(prompt) && !/(dashboard|scorecard|chart|graph|widget|canvas)/i.test(prompt)) {
    return false;
  }
  return /(dashboard|scorecard|chart|graph|viz|visuali[sz]|pie|donut|bar chart|bucket|build (me )?a|create (me )?a|make (me )?a|show me\b|widget|canvas|save (this )?view)/i.test(
    prompt,
  );
}

function rulesAnswer(prompt: string, rounds: EstimateRound[]): string {
  const totals = computeStats("all", rounds);
  const q = prompt.toLowerCase();
  if (/win.?rate/.test(q)) {
    return `Across ${fmtNumber(totals.rounds)} estimate rounds, win rate is ${fmtPercent(totals.winRate)} (${fmtNumber(totals.wins)} wins of ${fmtNumber(totals.decided)} decided). Dollar-weighted win rate is ${fmtPercent(totals.winRateByValue)}.`;
  }
  if (/fee/.test(q)) {
    return `Expected fee totals ${fmtDollars(totals.totalFee, true)} on ${fmtDollars(totals.volume, true)} pursuit volume (${fmtPercent(totals.weightedFeePct)} weighted fee %).`;
  }
  if (/volume|how much|pipeline/.test(q)) {
    const top = rollup(rounds, (r) => r.region || "Unclassified").slice(0, 3);
    const bits = top.map((g) => `${g.key} ${fmtDollars(g.volume, true)}`).join("; ");
    return `Pursuit volume is ${fmtDollars(totals.volume, true)} across ${fmtNumber(totals.rounds)} rounds. Top regions: ${bits || "—"}.`;
  }
  if (/how many|count|rounds/.test(q)) {
    return `There are ${fmtNumber(totals.rounds)} estimate rounds in the current workspace data.`;
  }
  return `I can answer questions about pursuit volume, win rate, fees, regions, and sectors — or build a dashboard view when you ask. Right now the portfolio shows ${fmtDollars(totals.volume, true)} volume across ${fmtNumber(totals.rounds)} rounds with a ${fmtPercent(totals.winRate)} win rate.`;
}

const routeSchema = z.object({
  mode: z.enum(["answer", "dashboard"]),
  reason: z.string().max(200),
});

/**
 * One Magnus turn: answer a question OR build a dashboard.
 * Always Claude Opus 5 + ZDR when configured.
 */
export async function runMagnusTurn(
  prompt: string,
  rounds: EstimateRound[],
): Promise<MagnusTurn> {
  const trimmed = prompt.trim();
  if (trimmed.length < 2) {
    return {
      mode: "answer",
      text: "Ask a question about the data, or ask me to build a dashboard view.",
      engine: "rules",
      model: "rules",
    };
  }

  const brief = buildDataBrief(rounds);
  let mode: "answer" | "dashboard" = looksLikeDashboardRequest(trimmed)
    ? "dashboard"
    : "answer";

  // Prefer local heuristics for clear questions; only ask the model when ambiguous.
  if (isAiConfigured() && !looksLikeQuestion(trimmed) && !looksLikeDashboardRequest(trimmed)) {
    try {
      const routed = await generateObject({
        model: getZdrModel(),
        ...gatewayZdrOptions(),
        schema: routeSchema,
        system: `You route Magnus AI for B&G Preconstruction.
"dashboard" = user wants charts/widgets/a scorecard/canvas built.
"answer" = factual question or explanation (default).
Model: ${AI_MODEL_LABEL}.`,
        prompt: `User: ${trimmed}`,
      });
      mode = routed.object.mode;
    } catch {
      /* keep heuristic mode */
    }
  }

  if (mode === "dashboard") {
    const plan = await planDashboardWithOptionalLlm(trimmed);
    return {
      mode: "dashboard",
      text: `Built “${plan.name}” with ${plan.widgets.length} widgets. Review the canvas, then save if you want it in Studio.`,
      plan,
      engine: plan.engine,
      model: plan.engine === "opus5-zdr" ? AI_MODEL_ID : "rules",
    };
  }

  if (!isAiConfigured()) {
    return {
      mode: "answer",
      text: rulesAnswer(trimmed, rounds),
      engine: "rules",
      model: "rules",
    };
  }

  try {
    const { text } = await generateText({
      model: getZdrModel(),
      ...gatewayZdrOptions(),
      system: `You are Magnus AI for Brasfield & Gorrie Preconstruction.
Answer clearly and concisely from the live portfolio snapshot below.
Use dollars/percentages with sensible rounding. If data is insufficient, say so.
Do not invent jobs or numbers not supported by the snapshot.
Do not build dashboards unless asked — this turn is Q&A only.
Model: ${AI_MODEL_LABEL} (${AI_MODEL_ID}). Zero data retention is on.

Portfolio snapshot:
${brief}`,
      prompt: trimmed,
    });
    return {
      mode: "answer",
      text: text.trim() || rulesAnswer(trimmed, rounds),
      engine: "opus5-zdr",
      model: AI_MODEL_ID,
    };
  } catch {
    return {
      mode: "answer",
      text: rulesAnswer(trimmed, rounds),
      engine: "rules",
      model: "rules",
    };
  }
}

/** Explicit dashboard build (skips Q&A routing). */
export async function runMagnusDashboard(prompt: string): Promise<CopilotPlan> {
  if (!looksLikeDashboardRequest(prompt) && prompt.trim().split(/\s+/).length < 4) {
    return planDashboardFromPrompt(`Executive scorecard: ${prompt}`);
  }
  return planDashboardWithOptionalLlm(prompt);
}
