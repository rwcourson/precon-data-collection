import "server-only";

import { ToolLoopAgent, isStepCount, type InferAgentUIMessage } from "ai";
import type { EstimateRound } from "@/db/schema";
import {
  AI_MODEL_LABEL,
  gatewayZdrOptions,
  getZdrModel,
  isAiConfigured,
} from "@/lib/ai/gateway";
import { MAGNUS_SYSTEM } from "@/lib/ai/magnus-system";
import {
  createMagnusTools,
  type MagnusToolContext,
} from "@/lib/ai/magnus-tools";
import type { Principal } from "@/lib/authorization/types";
import type { CopilotPlan } from "@/lib/dashboard-copilot";

export type MagnusAgentOptions = {
  rounds: EstimateRound[];
  previousPlan?: CopilotPlan | null;
  principal?: Principal;
};

export function createMagnusAgent(options: MagnusAgentOptions) {
  if (!isAiConfigured()) {
    throw new Error(
      "AI gateway is not configured. Use the rules fallback path instead.",
    );
  }

  const ctx: MagnusToolContext = {
    rounds: options.rounds,
    previousPlan: options.previousPlan ?? null,
    principal: options.principal,
  };

  const tools = createMagnusTools(ctx);

  return new ToolLoopAgent({
    model: getZdrModel(),
    ...gatewayZdrOptions(),
    instructions: MAGNUS_SYSTEM,
    tools,
    stopWhen: isStepCount(8),
    // Keep temperature low for numeric fidelity.
    temperature: 0.2,
  });
}

export type MagnusAgent = ReturnType<typeof createMagnusAgent>;
export type MagnusUIMessage = InferAgentUIMessage<MagnusAgent>;

export { isAiConfigured, AI_MODEL_LABEL };
