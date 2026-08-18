import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ACCESS, mapIdentityStrict } from "@/lib/access-map";
import { BA_SESSION_COOKIE } from "@/lib/auth-constants";
import { SSO_TRUST_HEADER, verifySsoRequest } from "@/lib/sso-trust";
import { proxy } from "@/proxy";

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

const ssoEnv = {
  APP_ENV: "production",
  AUTH_MODE: "sso",
  DATABASE_MODE: "postgres",
  DATABASE_URL: "postgresql://app:secret@db.example.com/app",
  DATABASE_URL_UNPOOLED: "postgresql://migrator:secret@db.example.com/app",
  APP_ORIGIN: "https://precon.example.com",
  ALLOWED_ORIGINS: "https://precon.example.com",
  CRON_SECRET: "c".repeat(32),
  SSO_ALLOWED_DOMAINS: "example.com",
  BETTER_AUTH_SECRET: "b".repeat(32),
  BETTER_AUTH_URL: "https://precon.example.com",
  MICROSOFT_CLIENT_ID: "11111111-1111-1111-1111-111111111111",
  MICROSOFT_CLIENT_SECRET: "ms-client-secret-value",
  MICROSOFT_TENANT_ID: "22222222-2222-2222-2222-222222222222",
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

afterEach(() => vi.unstubAllEnvs());

describe("production SSO trust matrix", () => {
  it("accepts only the trusted hop and an approved email domain (legacy proxy helper)", () => {
    expect(verifySsoRequest(headers(), trustConfig).ok).toBe(true);
    expect(
      verifySsoRequest(headers({ [SSO_TRUST_HEADER]: "wrong" }), trustConfig)
    ).toMatchObject({ ok: false, reason: "untrusted-hop" });
    expect(
      verifySsoRequest(
        headers({ "x-forwarded-email": "person@attacker.test" }),
        trustConfig
      )
    ).toMatchObject({ ok: false, reason: "unapproved-domain" });
    expect(
      verifySsoRequest(headers({ "x-forwarded-email": "" }), trustConfig)
    ).toMatchObject({ ok: false, reason: "missing-identity" });
  });

  it("rejects unmapped roles and missing Regions for Region-bound roles", () => {
    expect(
      mapIdentityStrict(
        { email: "x@example.com", name: "X", groups: ["Unknown"] },
        DEFAULT_ACCESS
      )
    ).toEqual({ ok: false, reason: "unmapped-role" });
    expect(
      mapIdentityStrict(
        { email: "x@example.com", name: "X", groups: ["BG-Precon-RPD"] },
        DEFAULT_ACCESS
      )
    ).toEqual({ ok: false, reason: "missing-region" });
    expect(
      mapIdentityStrict(
        {
          email: "x@example.com",
          name: "X",
          groups: ["BG-Precon-RPD", "BG-Region-Central"],
        },
        DEFAULT_ACCESS
      )
    ).toMatchObject({ ok: true, role: "rpd", region: "Central" });
  });

  it("edge gate allows auth + sign-in without a session cookie", async () => {
    for (const [key, value] of Object.entries(ssoEnv)) vi.stubEnv(key, value);
    expect(
      proxy(new NextRequest("https://precon.example.com/api/auth/ok")).status
    ).toBe(200);
    expect(
      proxy(new NextRequest("https://precon.example.com/sign-in")).status
    ).toBe(200);
  });

  it("edge gate redirects HTML and 401s APIs without a Better Auth session cookie", async () => {
    for (const [key, value] of Object.entries(ssoEnv)) vi.stubEnv(key, value);

    const page = proxy(new NextRequest("https://precon.example.com/admin"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/sign-in");

    const api = proxy(
      new NextRequest("https://precon.example.com/api/v1/jobs")
    );
    expect(api.status).toBe(401);

    const authed = proxy(
      new NextRequest("https://precon.example.com/admin", {
        headers: { cookie: `${BA_SESSION_COOKIE}=fake-session-token` },
      })
    );
    expect(authed.status).toBe(200);
  });

  it("edge gate passes token-authenticated API requests through to route auth", async () => {
    for (const [key, value] of Object.entries(ssoEnv)) vi.stubEnv(key, value);

    // Bearer-token mobile API — the route validates the token and fails closed.
    const bearer = proxy(
      new NextRequest(
        "https://precon.example.com/api/v1/mobile/rounds/1/transition",
        {
          headers: { authorization: "Bearer pct_token" },
        }
      )
    );
    expect(bearer.status).toBe(200);

    // HMAC-signed webhook — same pass-through.
    const hmac = proxy(
      new NextRequest("https://precon.example.com/api/v1/copilot/tools", {
        headers: { "x-eve-hmac": "deadbeef" },
      })
    );
    expect(hmac.status).toBe(200);

    // No credential at all still gets the cookie 401.
    const bare = proxy(
      new NextRequest("https://precon.example.com/api/v1/mobile/me")
    );
    expect(bare.status).toBe(401);

    // HTML page requests never pass through on headers — redirect is unchanged.
    const page = proxy(
      new NextRequest("https://precon.example.com/admin", {
        headers: { authorization: "Bearer pct_token" },
      })
    );
    expect(page.status).toBe(307);
  });
});
