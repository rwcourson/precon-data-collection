import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

const ssoEnv = {
  APP_ENV: "production",
  AUTH_MODE: "sso",
  DATABASE_MODE: "postgres",
  DATABASE_URL: "postgresql://app:secret@db.example.com/app?sslmode=require",
  DATABASE_URL_UNPOOLED:
    "postgresql://migrator:secret@db.example.com/app?sslmode=require",
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
  BLOB_READ_WRITE_TOKEN: "vercel_blob_token_123",
  CONNECT_MODE: "disabled",
  SMARTSHEET_MODE: "disabled",
  DATABRICKS_MODE: "disabled",
} as const;

function stubSso(): void {
  for (const [key, value] of Object.entries(ssoEnv)) {
    vi.stubEnv(key, value);
  }
}

describe("SSO proxy gate for MCP discovery", () => {
  it("lets unauthenticated clients read OAuth discovery documents", () => {
    stubSso();
    for (const path of [
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-protected-resource/api/mcp",
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-authorization-server/api/auth",
    ]) {
      const response = proxy(
        new NextRequest(`https://precon.example.com${path}`)
      );
      expect(response.status, path).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("lets a credential-less POST reach /api/mcp so requireMcpAuth can issue the RFC 9728 challenge", () => {
    stubSso();
    const response = proxy(
      new NextRequest("https://precon.example.com/api/mcp", {
        method: "POST",
      })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("still 401s unrelated API routes without a session in SSO mode", async () => {
    stubSso();
    const response = proxy(
      new NextRequest("https://precon.example.com/api/search")
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Not signed in. Sign in with Microsoft.",
    });
  });
});
