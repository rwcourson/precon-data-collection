import {
  createAgentUIStreamResponse,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { createMagnusAgent, isAiConfigured } from "@/lib/ai/magnus-agent";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import type { CopilotPlan } from "@/lib/dashboard-copilot";
import { resolveWidgets } from "@/lib/dashboard-query";
import { runMagnusTurn } from "@/lib/magnus-ai";
import { toPlainText } from "@/lib/plain-text";

export const maxDuration = 60;
export const runtime = "nodejs";

type Body = {
  messages?: unknown[];
  previousPlan?: CopilotPlan | null;
};

/**
 * Streaming Magnus chat (AI SDK 7 ToolLoopAgent + ZDR Opus 5).
 * Falls back to a single non-stream rules/LLM turn when gateway is unconfigured.
 */
export async function POST(req: Request) {
  const principal = await getWebPrincipal();
  const body = (await req.json()) as Body;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const previousPlan = body.previousPlan ?? null;

  const rows = await listRoundsWithJobsForPrincipal(principal);
  const rounds = rows.map((r) => r.round);

  if (!isAiConfigured()) {
    // Rules / optional non-stream LLM path for demo & offline.
    const lastUser = [...messages]
      .reverse()
      .find(
        (m) =>
          m &&
          typeof m === "object" &&
          "role" in m &&
          (m as { role: string }).role === "user"
      ) as
      | { parts?: { type: string; text?: string }[]; content?: string }
      | undefined;

    const prompt =
      lastUser?.parts
        ?.filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join(" ")
        .trim() ||
      (typeof lastUser?.content === "string" ? lastUser.content : "") ||
      "";

    const turn = await runMagnusTurn(prompt || "portfolio overview", rounds);
    const preview =
      turn.mode === "dashboard"
        ? {
            plan: turn.plan,
            widgets: resolveWidgets(turn.plan.widgets, rounds),
          }
        : null;

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const id = `msg_rules_${Date.now()}`;
        writer.write({ type: "start", messageId: id });
        writer.write({ type: "text-start", id: `${id}_t` });
        writer.write({
          type: "text-delta",
          id: `${id}_t`,
          delta: toPlainText(turn.text),
        });
        writer.write({ type: "text-end", id: `${id}_t` });
        if (preview) {
          writer.write({
            type: "data-dashboard",
            id: "canvas-1",
            data: preview,
          });
        }
        writer.write({ type: "finish" });
      },
    });

    return createUIMessageStreamResponse({ stream });
  }

  const agent = createMagnusAgent({ rounds, previousPlan, principal });

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    abortSignal: req.signal,
  });
}
