import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_ACCESS, mapIdentityStrict } from "@/lib/access-map";
import { proxy } from "@/proxy";
import { SSO_TRUST_HEADER, verifySsoRequest } from "@/lib/sso-trust";

const trustConfig = {
  ssoTrustSecret: "s".repeat(32),
  ssoAllowedDomains: ["example.com"],
};

function headers(overrides: Record<string, string> = {}) {
  return new Headers({
    [SSO_TRUST_HEADER]: trustConfig.ssoTrustSecret,
    "x-forwarded-email": "person@example.com",
    "x-forwarded-preferred-username": "Person",
    "x-forwarded-groups": "BG-Precon-RPD,BG-Region-Central",
    ...overrides,
  });
}

afterEach(() => vi.unstubAllEnvs());

describe("production SSO trust matrix", () => {
  it("accepts only the trusted hop and an approved email domain", () => {
    expect(verifySsoRequest(headers(), trustConfig).ok).toBe(true);
    expect(verifySsoRequest(headers({ [SSO_TRUST_HEADER]: "wrong" }), trustConfig)).toMatchObject({ ok: false, reason: "untrusted-hop" });
    expect(verifySsoRequest(headers({ "x-forwarded-email": "person@attacker.test" }), trustConfig)).toMatchObject({ ok: false, reason: "unapproved-domain" });
    expect(verifySsoRequest(headers({ "x-forwarded-email": "" }), trustConfig)).toMatchObject({ ok: false, reason: "missing-identity" });
  });

  it("rejects unmapped roles and missing Regions for Region-bound roles", () => {
    expect(mapIdentityStrict({ email: "x@example.com", name: "X", groups: ["Unknown"] }, DEFAULT_ACCESS)).toEqual({ ok: false, reason: "unmapped-role" });
    expect(mapIdentityStrict({ email: "x@example.com", name: "X", groups: ["BG-Precon-RPD"] }, DEFAULT_ACCESS)).toEqual({ ok: false, reason: "missing-region" });
    expect(mapIdentityStrict({ email: "x@example.com", name: "X", groups: ["BG-Precon-RPD", "BG-Region-Central"] }, DEFAULT_ACCESS)).toMatchObject({ ok: true, role: "rpd", region: "Central" });
  });

  it("rejects direct-origin spoofed forwarded headers without the proxy secret", async () => {
    const env = {
      APP_ENV: "production",
      AUTH_MODE: "sso",
      DATABASE_MODE: "postgres",
      DATABASE_URL: "postgresql://app:secret@db.example.com/app",
      DATABASE_URL_UNPOOLED: "postgresql://migrator:secret@db.example.com/app",
      APP_ORIGIN: "https://precon.example.com",
      ALLOWED_ORIGINS: "https://precon.example.com",
      CRON_SECRET: "c".repeat(32),
      SSO_TRUST_SECRET: trustConfig.ssoTrustSecret,
      SSO_ALLOWED_DOMAINS: "example.com",
      API_TOKEN_MAX_TTL_DAYS: "90",
      EMAIL_MODE: "resend",
      RESEND_API_KEY: "re_123456789012",
      EMAIL_FROM: "precon@example.com",
      PRIVATE_STORAGE_MODE: "vercel-blob",
      BLOB_READ_WRITE_TOKEN: "blob_token_123456",
      CONNECT_MODE: "disabled",
      SMARTSHEET_MODE: "disabled",
      DATABRICKS_MODE: "disabled",
    };
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const spoofed = new NextRequest("https://precon.example.com/admin", {
      headers: { "x-forwarded-email": "person@example.com" },
    });
    expect(proxy(spoofed).status).toBe(401);

    const trusted = new NextRequest("https://precon.example.com/admin", {
      headers: Object.fromEntries(headers()),
    });
    expect(proxy(trusted).status).toBe(200);
  });
});
