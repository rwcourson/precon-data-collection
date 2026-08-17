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
  return (
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    "precon-demo-copilot"
  );
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
  const expected = signCopilotToolRequest(principalId, tool);
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
