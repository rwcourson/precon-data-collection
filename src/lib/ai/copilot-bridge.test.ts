import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isCopilotToolName,
  signCopilotToolRequest,
  verifyCopilotToolRequest,
} from "./copilot-bridge";

describe("copilot tool bridge", () => {
  it("accepts only the allowlisted tool names", () => {
    expect(isCopilotToolName("query_needs_staffing")).toBe(true);
    expect(isCopilotToolName("bash")).toBe(false);
  });

  it("verifies a matching HMAC and rejects a mismatch", () => {
    const hmac = signCopilotToolRequest("42", "search_notes");
    expect(verifyCopilotToolRequest("42", "search_notes", hmac)).toBe(true);
    expect(verifyCopilotToolRequest("42", "search_notes", "deadbeef")).toBe(false);
    expect(verifyCopilotToolRequest("99", "search_notes", hmac)).toBe(false);
  });

  describe("hosted deployments without a configured secret", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("fails closed instead of accepting the well-known dev fallback", () => {
      vi.stubEnv("BETTER_AUTH_SECRET", "");
      vi.stubEnv("AI_GATEWAY_API_KEY", "");
      vi.stubEnv("VERCEL", "1");
      const forged = "forged-with-public-fallback";
      expect(verifyCopilotToolRequest("42", "search_notes", forged)).toBe(false);
      expect(() => signCopilotToolRequest("42", "search_notes")).toThrow(/hosted deployments/);
    });

    it("still verifies when a real secret is configured", () => {
      vi.stubEnv("BETTER_AUTH_SECRET", "a-real-secret-value-that-is-long-enough");
      vi.stubEnv("VERCEL", "1");
      const hmac = signCopilotToolRequest("42", "search_notes");
      expect(verifyCopilotToolRequest("42", "search_notes", hmac)).toBe(true);
    });
  });
});
