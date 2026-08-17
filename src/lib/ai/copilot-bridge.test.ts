import { describe, expect, it } from "vitest";
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
});
