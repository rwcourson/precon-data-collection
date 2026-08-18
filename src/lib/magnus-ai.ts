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
  type CopilotPlan,
  planDashboardFromPrompt,
  planDashboardWithOptionalLlm,
} from "@/lib/dashboard-copilot";
import { fmtDollars, fmtNumber, fmtPercent } from "@/lib/format";
import { toPlainText } from "@/lib/plain-text";
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

const REGION_LABELS = [
  "Central",
  "Carolinas",
  "Florida",
  "Georgia",
  "Texas",
] as const;

function detectRegion(prompt: string): (typeof REGION_LABELS)[number] | null {
  const q = prompt.toLowerCase();
  for (const label of REGION_LABELS) {
    if (q.includes(label.toLowerCase())) return label;
  }
  if (q.includes("carolinas") || q.includes("carolina")) return "Carolinas";
  return null;
}

function filterRounds(
  rounds: EstimateRound[],
  region: string | null
): EstimateRound[] {
  if (!region) return rounds;
  return rounds.filter(
    (r) => (r.region || "").toLowerCase() === region.toLowerCase()
  );
}

function buildDataBrief(rounds: EstimateRound[]): string {
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
        `  - ${g.key}: ${fmtDollars(g.volume, true)} · ${g.rounds} rounds · win ${fmtPercent(g.winRate)}`
    ),
    "Volume by market sector:",
    ...bySector.map(
      (g) => `  - ${g.key}: ${fmtDollars(g.volume, true)} · ${g.rounds} rounds`
    ),
  ];
  return lines.join("\n");
}

/** Explicit “build me a view” language. */
function looksLikeExplicitDashboard(prompt: string): boolean {
  return /(dashboard|scorecard|chart|graph|viz|visuali[sz]|pie|donut|bar chart|bucket|build (me )?a|create (me )?a|make (me )?a|show me\b|widget|canvas|save (this )?view)/i.test(
    prompt
  );
}

/**
 * Metric / portfolio questions that should answer in chat AND paint a
 * Power BI–style canvas (KPIs + charts), even when phrased as a question.
 */
function looksLikeDataViewQuestion(prompt: string): boolean {
  return /(win.?rate|hit rate|success rate|pursuit volume|pipeline|fee\b|contingenc|how many|rounds?|by region|by sector|scorecard|overview|summary)/i.test(
    prompt
  );
}

function shouldBuildCanvas(prompt: string): boolean {
  return (
    looksLikeExplicitDashboard(prompt) || looksLikeDataViewQuestion(prompt)
  );
}

function rulesAnswer(prompt: string, rounds: EstimateRound[]): string {
  const region = detectRegion(prompt);
  const scoped = filterRounds(rounds, region);
  const totals = computeStats(region ?? "all", scoped);
  const scopeLabel = region ? `in ${region}` : "across the portfolio";

  if (region && scoped.length === 0) {
    const available = rollup(rounds, (r) => r.region || "Unclassified")
      .map((g) => g.key)
      .filter((k) => k !== "Unclassified")
      .slice(0, 6);
    return `No estimate rounds are tagged to ${region} in this snapshot. Regions present: ${available.join(", ") || "none tagged"}. The canvas shows the closest available portfolio view.`;
  }

  const q = prompt.toLowerCase();
  if (/win.?rate/.test(q)) {
    return `${region ? `${region} ` : ""}Win rate ${scopeLabel} is ${fmtPercent(totals.winRate)} (${fmtNumber(totals.wins)} wins of ${fmtNumber(totals.decided)} decided) across ${fmtNumber(totals.rounds)} estimate rounds. Dollar-weighted win rate is ${fmtPercent(totals.winRateByValue)}. Pursuit volume is ${fmtDollars(totals.volume, true)}.`;
  }
  if (/fee/.test(q)) {
    return `Expected fee ${scopeLabel} totals ${fmtDollars(totals.totalFee, true)} on ${fmtDollars(totals.volume, true)} pursuit volume (${fmtPercent(totals.weightedFeePct)} weighted fee %).`;
  }
  if (/volume|how much|pipeline/.test(q)) {
    const top = rollup(scoped, (r) => r.region || "Unclassified").slice(0, 3);
    const bits = top
      .map((g) => `${g.key} ${fmtDollars(g.volume, true)}`)
      .join("; ");
    return `Pursuit volume ${scopeLabel} is ${fmtDollars(totals.volume, true)} across ${fmtNumber(totals.rounds)} rounds. Top regions: ${bits || "—"}.`;
  }
  if (/how many|count|rounds/.test(q)) {
    return `There are ${fmtNumber(totals.rounds)} estimate rounds ${scopeLabel}.`;
  }
  return `Portfolio snapshot ${scopeLabel}: ${fmtDollars(totals.volume, true)} volume across ${fmtNumber(totals.rounds)} rounds with a ${fmtPercent(totals.winRate)} win rate. Ask a follow-up or save the canvas view to Studio.`;
}

const PLAIN_TEXT_RULES = `Write in plain prose only. Never use Markdown — no bold, italics, headings, bullet lists, numbered lists, code fences, or tables. Use short paragraphs and complete sentences.`;

async function llmAnswer(
  prompt: string,
  rounds: EstimateRound[]
): Promise<{ text: string; engine: "opus5-zdr" | "rules" }> {
  if (!isAiConfigured()) {
    return { text: rulesAnswer(prompt, rounds), engine: "rules" };
  }
  const brief = buildDataBrief(rounds);
  const region = detectRegion(prompt);
  try {
    const { text } = await generateText({
      model: getZdrModel(),
      ...gatewayZdrOptions(),
      system: `You are Magnus AI for Brasfield & Gorrie Preconstruction.
Answer clearly and concisely from the live portfolio snapshot below.
${PLAIN_TEXT_RULES}
Use dollars and percentages with sensible rounding. If a requested region or field is missing, say so plainly and report the closest available numbers.
Do not invent jobs or numbers not supported by the snapshot.
A matching dashboard view is shown on the canvas automatically — keep this reply as the verbal answer only (2–5 short sentences).
${region ? `The user asked about ${region}; prefer that region's numbers when present.` : ""}
Model: ${AI_MODEL_LABEL} (${AI_MODEL_ID}). Zero data retention is on.

Portfolio snapshot:
${brief}`,
      prompt,
    });
    const plain = toPlainText(text);
    return {
      text: plain || rulesAnswer(prompt, rounds),
      engine: "opus5-zdr",
    };
  } catch {
    return { text: rulesAnswer(prompt, rounds), engine: "rules" };
  }
}

const routeSchema = z.object({
  mode: z.enum(["answer", "dashboard"]),
  reason: z.string().max(200),
});

/**
 * One Magnus turn: answer a question and/or build a Power BI–style canvas.
 * Data questions (win rate, volume, region, etc.) always paint the canvas.
 * Always Claude Opus 5 + ZDR when configured. Chat text is plain (no Markdown).
 */
export async function runMagnusTurn(
  prompt: string,
  rounds: EstimateRound[]
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

  let buildCanvas = shouldBuildCanvas(trimmed);

  // Ambiguous non-question prompts: ask Opus to route.
  if (
    isAiConfigured() &&
    !buildCanvas &&
    !/\?$/.test(trimmed) &&
    !/^(what|who|when|where|why|how|which|is|are|do|does|did|can|could|would|should|tell me|explain|summarize)\b/i.test(
      trimmed
    )
  ) {
    try {
      const routed = await generateObject({
        model: getZdrModel(),
        ...gatewayZdrOptions(),
        schema: routeSchema,
        system: `You route Magnus AI for B&G Preconstruction.
"dashboard" = user wants charts, widgets, a scorecard, or canvas built — or asks about win rate, volume, fees, regions in a way that a view would help.
"answer" = purely explanatory with no useful chart.
Model: ${AI_MODEL_LABEL}.`,
        prompt: `User: ${trimmed}`,
      });
      buildCanvas = routed.object.mode === "dashboard";
    } catch {
      /* keep heuristic */
    }
  }

  if (buildCanvas) {
    const [plan, answer] = await Promise.all([
      planDashboardWithOptionalLlm(trimmed),
      llmAnswer(trimmed, rounds),
    ]);
    const text = toPlainText(
      `${answer.text}\n\nI also built “${plan.name}” on the canvas with ${plan.widgets.length} widgets — review it, then save if you want it in Studio.`
    );
    return {
      mode: "dashboard",
      text,
      plan,
      engine: plan.engine,
      model: plan.engine === "opus5-zdr" ? AI_MODEL_ID : "rules",
    };
  }

  const answer = await llmAnswer(trimmed, rounds);
  return {
    mode: "answer",
    text: toPlainText(answer.text),
    engine: answer.engine,
    model: answer.engine === "opus5-zdr" ? AI_MODEL_ID : "rules",
  };
}

/** Explicit dashboard build (skips Q&A routing). */
export async function runMagnusDashboard(prompt: string): Promise<CopilotPlan> {
  if (
    !looksLikeExplicitDashboard(prompt) &&
    prompt.trim().split(/\s+/).length < 4
  ) {
    return planDashboardFromPrompt(`Executive scorecard: ${prompt}`);
  }
  return planDashboardWithOptionalLlm(prompt);
}
