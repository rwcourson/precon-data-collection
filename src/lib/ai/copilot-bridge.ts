import { createHmac, timingSafeEqual } from "node:crypto";

export const COPILOT_TOOL_NAMES = [
  "query_efforts",
  "query_needs_staffing",
  "search_notes",
  "person_history",
  "plan_chart",
] as const;

export type CopilotToolName = (typeof COPILOT_TOOL_NAMES)[number];

export function isCopilotToolName(value: string): value is CopilotToolName {
  return (COPILOT_TOOL_NAMES as readonly string[]).includes(value);
}

export function copilotToolSecret(): string {
  const configured =
    process.env.BETTER_AUTH_SECRET?.trim() || process.env.AI_GATEWAY_API_KEY?.trim();
  if (configured) return configured;
  // A well-known fallback would let anyone forge tool-call HMACs on a hosted
  // deployment, so it is only acceptable on a developer machine.
  if (process.env.VERCEL || process.env.APP_ENV === "production") {
    throw new Error(
      "Copilot tool signing requires BETTER_AUTH_SECRET or AI_GATEWAY_API_KEY on hosted deployments.",
    );
  }
  return "precon-demo-copilot";
}

export function signCopilotToolRequest(principalId: string, tool: string): string {
  return createHmac("sha256", copilotToolSecret()).update(`${principalId}:${tool}`).digest("hex");
}

export function verifyCopilotToolRequest(
  principalId: string,
  tool: string,
  hmac: string | null,
): boolean {
  if (!hmac) return false;
  let expected: string;
  try {
    expected = signCopilotToolRequest(principalId, tool);
  } catch {
    return false;
  }
  const left = Buffer.from(expected);
  const right = Buffer.from(hmac);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function copilotAppOrigin(): string {
  const fromEnv = process.env.APP_ORIGIN?.trim() || process.env.EVE_APP_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL?.trim()) return `https://${process.env.VERCEL_URL.trim()}`;
  return "http://127.0.0.1:3000";
}
