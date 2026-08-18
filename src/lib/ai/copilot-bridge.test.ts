import { createHash, createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COPILOT_TOOL_MAX_SKEW_MS,
  isCopilotToolName,
  signCopilotToolRequest,
  verifyCopilotToolRequest,
} from "./copilot-bridge";

const rawBody = JSON.stringify({
  tool: "search_notes",
  input: { query: "roof" },
});

function signed(
  overrides: Partial<Parameters<typeof signCopilotToolRequest>[0]> = {}
) {
  const input = {
    principalId: "42",
    tool: "search_notes",
    timestamp: Date.now(),
    rawBody,
    ...overrides,
  };
  return { input, hmac: signCopilotToolRequest(input) };
}

describe("copilot tool bridge", () => {
  it("accepts only the allowlisted tool names", () => {
    expect(isCopilotToolName("query_needs_staffing")).toBe(true);
    expect(isCopilotToolName("bash")).toBe(false);
  });

  it("verifies a matching HMAC and rejects a mismatch", () => {
    const { input, hmac } = signed();
    expect(verifyCopilotToolRequest({ ...input, hmac })).toBe(true);
    expect(verifyCopilotToolRequest({ ...input, hmac: "deadbeef" })).toBe(
      false
    );
    expect(
      verifyCopilotToolRequest({ ...input, principalId: "99", hmac })
    ).toBe(false);
    expect(verifyCopilotToolRequest({ ...input, hmac: null })).toBe(false);
  });

  it("rejects a signature when the body was tampered with", () => {
    const { input, hmac } = signed();
    expect(
      verifyCopilotToolRequest({
        ...input,
        rawBody: JSON.stringify({
          tool: "search_notes",
          input: { query: "salaries" },
        }),
        hmac,
      })
    ).toBe(false);
  });

  it("rejects timestamps outside the allowed skew window (replay protection)", () => {
    const now = Date.now();
    const stale = signed({ timestamp: now - COPILOT_TOOL_MAX_SKEW_MS - 1 });
    expect(
      verifyCopilotToolRequest({ ...stale.input, hmac: stale.hmac, now })
    ).toBe(false);

    const future = signed({ timestamp: now + COPILOT_TOOL_MAX_SKEW_MS + 1 });
    expect(
      verifyCopilotToolRequest({ ...future.input, hmac: future.hmac, now })
    ).toBe(false);

    const fresh = signed({ timestamp: now - COPILOT_TOOL_MAX_SKEW_MS + 1000 });
    expect(
      verifyCopilotToolRequest({ ...fresh.input, hmac: fresh.hmac, now })
    ).toBe(true);

    const invalid = signed({ timestamp: Number.NaN });
    expect(
      verifyCopilotToolRequest({ ...invalid.input, hmac: invalid.hmac, now })
    ).toBe(false);
  });

  it("matches the signature produced by the agent-side app bridge", () => {
    // agent/lib/app-bridge.ts derives the key and payload independently; this
    // re-derivation locks the two implementations together.
    const timestamp = Date.now();
    const secret =
      process.env.BETTER_AUTH_SECRET?.trim() || "precon-demo-copilot";
    const signingKey = createHmac("sha256", secret)
      .update("copilot-tools-v1")
      .digest();
    const bodyHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
    const agentSide = createHmac("sha256", signingKey)
      .update(`${timestamp}:42:search_notes:${bodyHash}`)
      .digest("hex");
    expect(
      verifyCopilotToolRequest({
        principalId: "42",
        tool: "search_notes",
        timestamp,
        rawBody,
        hmac: agentSide,
      })
    ).toBe(true);
  });

  describe("hosted deployments without a configured secret", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("fails closed instead of accepting the well-known dev fallback", () => {
      vi.stubEnv("BETTER_AUTH_SECRET", "");
      vi.stubEnv("AI_GATEWAY_API_KEY", "");
      vi.stubEnv("VERCEL", "1");
      const input = {
        principalId: "42",
        tool: "search_notes",
        timestamp: Date.now(),
        rawBody,
      };
      expect(
        verifyCopilotToolRequest({
          ...input,
          hmac: "forged-with-public-fallback",
        })
      ).toBe(false);
      expect(() => signCopilotToolRequest(input)).toThrow(/hosted deployments/);
    });

    it("still verifies when a real secret is configured", () => {
      vi.stubEnv(
        "BETTER_AUTH_SECRET",
        "a-real-secret-value-that-is-long-enough"
      );
      vi.stubEnv("VERCEL", "1");
      const { input, hmac } = signed();
      expect(verifyCopilotToolRequest({ ...input, hmac })).toBe(true);
    });
  });
});
