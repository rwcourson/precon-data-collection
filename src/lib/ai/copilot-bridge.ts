import { createHash, createHmac, timingSafeEqual } from "node:crypto";

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

/** Maximum accepted clock skew between signer and verifier. */
export const COPILOT_TOOL_MAX_SKEW_MS = 120_000;

/**
 * Dedicated signing key derived from the base secret so a leaked tool-call
 * signature can never be replayed against Better Auth (and vice versa).
 * Must stay in lockstep with agent/lib/app-bridge.ts.
 */
function copilotToolSigningKey(): Buffer {
  return createHmac("sha256", copilotToolSecret()).update("copilot-tools-v1").digest();
}

export function sha256Hex(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

export type CopilotToolSignatureInput = {
  principalId: string;
  tool: string;
  /** Epoch milliseconds, transported in the x-eve-ts header. */
  timestamp: number;
  /** The exact raw request body string as sent over the wire. */
  rawBody: string;
};

export function signCopilotToolRequest(input: CopilotToolSignatureInput): string {
  const payload = `${input.timestamp}:${input.principalId}:${input.tool}:${sha256Hex(input.rawBody)}`;
  return createHmac("sha256", copilotToolSigningKey()).update(payload).digest("hex");
}

export function verifyCopilotToolRequest(
  input: CopilotToolSignatureInput & { hmac: string | null; now?: number },
): boolean {
  if (!input.hmac) return false;
  if (!Number.isFinite(input.timestamp)) return false;
  const now = input.now ?? Date.now();
  if (Math.abs(now - input.timestamp) > COPILOT_TOOL_MAX_SKEW_MS) return false;
  let expected: string;
  try {
    expected = signCopilotToolRequest(input);
  } catch {
    return false;
  }
  const left = Buffer.from(expected);
  const right = Buffer.from(input.hmac);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function copilotAppOrigin(): string {
  const fromEnv = process.env.APP_ORIGIN?.trim() || process.env.EVE_APP_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL?.trim()) return `https://${process.env.VERCEL_URL.trim()}`;
  return "http://127.0.0.1:3000";
}
