import { describe, expect, it } from "vitest";
import {
  generateApiTokenSecret,
  hashToken,
  tokenHasScope,
  tokenIsExpired,
  validateTokenExpiry,
} from "./api-tokens";

describe("api tokens", () => {
  it("hashes deterministically and never stores plaintext equality", () => {
    const { plaintext, hash, prefix } = generateApiTokenSecret();
    expect(plaintext.startsWith("pcn_")).toBe(true);
    expect(prefix.length).toBe(12);
    expect(hash).toBe(hashToken(plaintext));
    expect(hash).not.toBe(plaintext);
  });

  it("requires a future expiry within the configured maximum", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    expect(validateTokenExpiry(new Date("2026-09-01T12:00:00.000Z"), 30, now).ok).toBe(true);
    expect(validateTokenExpiry(new Date("2026-08-09T11:59:59.000Z"), 30, now).ok).toBe(false);
    expect(validateTokenExpiry(new Date("2027-08-09T12:00:00.000Z"), 30, now).ok).toBe(false);
  });

  it("checks scopes and expiry", () => {
    expect(tokenHasScope(["read:pursuits"], "read:pursuits")).toBe(true);
    expect(tokenHasScope(["read:pursuits"], "write:pursuits")).toBe(false);
    expect(tokenIsExpired(null)).toBe(false);
    expect(tokenIsExpired(new Date(Date.now() - 1000))).toBe(true);
  });
});
