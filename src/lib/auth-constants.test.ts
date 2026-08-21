import { describe, expect, it } from "vitest";
import {
  BA_SESSION_COOKIE,
  BA_SESSION_COOKIE_SECURE,
  cookiesLookLikeBetterAuthSession,
} from "@/lib/auth-constants";

describe("cookiesLookLikeBetterAuthSession", () => {
  it("accepts the default and Secure-prefixed Better Auth cookies", () => {
    expect(
      cookiesLookLikeBetterAuthSession([
        { name: BA_SESSION_COOKIE, value: "token" },
      ])
    ).toBe(true);
    expect(
      cookiesLookLikeBetterAuthSession([
        { name: BA_SESSION_COOKIE_SECURE, value: "token" },
      ])
    ).toBe(true);
  });

  it("accepts chunked session cookies and ignores empty values", () => {
    expect(
      cookiesLookLikeBetterAuthSession([
        { name: `${BA_SESSION_COOKIE}.0`, value: "chunk" },
      ])
    ).toBe(true);
    expect(
      cookiesLookLikeBetterAuthSession([{ name: BA_SESSION_COOKIE, value: "" }])
    ).toBe(false);
    expect(cookiesLookLikeBetterAuthSession([])).toBe(false);
  });
});
