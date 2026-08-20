import "server-only";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { MCP_ADVERTISED_SCOPES } from "@/lib/authorization/mcp-scopes";

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function trustedOrigins(): string[] {
  const raw = env("ALLOWED_ORIGINS");
  const fromList = raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const origin = env("APP_ORIGIN") || env("BETTER_AUTH_URL");
  if (origin) {
    try {
      fromList.push(new URL(origin).origin);
    } catch {
      /* ignore */
    }
  }
  fromList.push("https://grok.com", "https://www.grok.com");
  // Local dev conveniences — never trusted on production/hosted runs.
  const production =
    process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  if (!production) {
    fromList.push(
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001"
    );
  }
  return [...new Set(fromList)];
}

/**
 * Canonical public origin for OAuth redirects.
 * Prefer APP_ORIGIN / BETTER_AUTH_URL so production always uses the stable
 * host registered in Entra (never a one-off *.vercel.app deployment URL).
 */
function baseURL(): string {
  const explicit =
    env("BETTER_AUTH_URL") || env("APP_ORIGIN") || env("NEXT_PUBLIC_APP_URL");
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      return explicit.replace(/\/$/, "");
    }
  }
  // Vercel production hostname (custom domain / stable project URL), not dpl_*.
  const prodHost = env("VERCEL_PROJECT_PRODUCTION_URL");
  if (prodHost) {
    return prodHost.startsWith("http")
      ? prodHost.replace(/\/$/, "")
      : `https://${prodHost}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3001";
}

/**
 * Better Auth server — Microsoft Entra OAuth.
 * App roles still live on `users` via email → resolveSsoUser().
 */
export const auth = betterAuth({
  baseURL: baseURL(),
  secret: env("BETTER_AUTH_SECRET") || undefined,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  socialProviders: {
    microsoft: {
      clientId: env("MICROSOFT_CLIENT_ID"),
      clientSecret: env("MICROSOFT_CLIENT_SECRET"),
      tenantId: env("MICROSOFT_TENANT_ID") || "common",
      authority: "https://login.microsoftonline.com",
      prompt: "select_account",
      mapProfileToUser: (profile) => {
        const p = profile as Record<string, unknown>;
        const email =
          (typeof p.email === "string" && p.email) ||
          (typeof p.preferred_username === "string" && p.preferred_username) ||
          (typeof p.upn === "string" && p.upn) ||
          "";
        const name =
          (typeof p.name === "string" && p.name) ||
          (typeof p.preferred_username === "string" && p.preferred_username) ||
          "Microsoft user";
        return {
          // Entra can return huge base64 profile photos that blow cookie/header limits.
          image: undefined,
          email: email.toLowerCase(),
          name,
        };
      },
    },
  },
  trustedOrigins: trustedOrigins(),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["microsoft"],
    },
  },
  advanced: {
    // Production on Vercel is always HTTPS.
    useSecureCookies:
      process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL),
  },
  plugins: [
    jwt(),
    mcp({
      loginPage: "/sign-in",
      consentPage: "/consent",
      resource: mcpResourceIdentifier(),
      scopes: [...MCP_ADVERTISED_SCOPES],
      // CIMD is preferred (Grok web / Claude / Cursor). Local CLIs such as
      // `grok mcp` still register a public loopback client via RFC 7591 before
      // they can open the browser — without DCR they hang on [authenticating].
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
    }),
    cimd({
      fetchClientMetadataResource,
      metadataProfile: "mcp-2026-07-28",
    }),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;

/** Canonical MCP resource identifier — must match `mcp({ resource })` and `requireMcpAuth`. */
export function mcpResourceIdentifier(): string {
  return `${baseURL()}/api/mcp`;
}
