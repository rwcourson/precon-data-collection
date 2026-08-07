import { describe, expect, it } from "vitest";
import {
  generateApiTokenSecret,
  hashToken,
  tokenHasScope,
  tokenIsExpired,
} from "./api-tokens";

describe("api tokens", () => {
  it("hashes deterministically and never stores plaintext equality", () => {
    const { plaintext, hash, prefix } = generateApiTokenSecret();
    expect(plaintext.startsWith("pcn_")).toBe(true);
    expect(prefix.length).toBe(12);
    expect(hash).toBe(hashToken(plaintext));
    expect(hash).not.toBe(plaintext);
  });

  it("checks scopes and expiry", () => {
    expect(tokenHasScope(["read:pursuits"], "read:pursuits")).toBe(true);
    expect(tokenHasScope(["read:pursuits"], "write:pursuits")).toBe(false);
    expect(tokenIsExpired(null)).toBe(false);
    expect(tokenIsExpired(new Date(Date.now() - 1000))).toBe(true);
  });
});
