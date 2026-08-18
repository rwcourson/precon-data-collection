"use server";

import { createDashboard } from "@/actions/dashboards";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import type { CopilotPlan } from "@/lib/dashboard-copilot";
import { resolveWidgets, type WidgetResolved } from "@/lib/dashboard-query";
import { runMagnusTurn, type MagnusTurn } from "@/lib/magnus-ai";

export type CopilotPreviewResult = {
  plan: CopilotPlan;
  widgets: WidgetResolved[];
};

export type MagnusChatResult = {
  turn: MagnusTurn;
  preview: CopilotPreviewResult | null;
};

export async function askMagnus(prompt: string): Promise<MagnusChatResult> {
  const principal = await getWebPrincipal();
  const trimmed = prompt.trim();
  if (trimmed.length < 2) throw new Error("Ask a question or describe a dashboard.");

  const rows = await listRoundsWithJobsForPrincipal(principal);
  const rounds = rows.map((r) => r.round);
  const turn = await runMagnusTurn(trimmed, rounds);

  if (turn.mode === "dashboard") {
    return {
      turn,
      preview: {
        plan: turn.plan,
        widgets: resolveWidgets(turn.plan.widgets, rounds),
      },
    };
  }

  return { turn, preview: null };
}

/** @deprecated prefer askMagnus — kept for explicit dashboard builds */
export async function generateDashboardPreview(prompt: string): Promise<CopilotPreviewResult> {
  const result = await askMagnus(
    /dashboard|chart|scorecard|view/i.test(prompt) ? prompt : `Build a dashboard: ${prompt}`,
  );
  if (!result.preview) {
    throw new Error("That looked like a question — ask again or say “build a dashboard…”.");
  }
  return result.preview;
}

export async function saveCopilotDashboard(plan: CopilotPlan): Promise<number> {
  await getWebPrincipal();
  return createDashboard({
    name: plan.name,
    description: plan.description,
    scope: plan.scope,
    widgets: plan.widgets,
    published: false,
  });
}
