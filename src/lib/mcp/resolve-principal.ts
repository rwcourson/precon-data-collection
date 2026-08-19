import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  effectiveMcpScopes,
  mcpCeilingForUser,
} from "@/lib/authorization/mcp-policy";
import { loadMcpGrantState } from "@/lib/authorization/mcp-settings";
import { createMcpPrincipal } from "@/lib/authorization/principal";
import type { Principal } from "@/lib/authorization/types";
import type { McpAccessTokenClaims } from "@/lib/mcp/claims";

export type McpIdentityOk = {
  ok: true;
  principal: Principal;
  effectiveScopes: string[];
};

export type McpIdentityErr = {
  ok: false;
  status: 401 | 403;
  code: string;
  message: string;
};

export type McpIdentityResult = McpIdentityOk | McpIdentityErr;

export function scopesFromClaims(claims: McpAccessTokenClaims): string[] {
  const raw = claims.scope;
  if (typeof raw === "string") {
    return raw
      .split(/[+\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

export function emailFromClaims(claims: McpAccessTokenClaims): string | null {
  for (const key of ["email", "preferred_username", "upn"] as const) {
    const value = claims[key];
    if (typeof value === "string" && value.includes("@")) {
      return value.trim().toLowerCase();
    }
  }
  return null;
}

export async function resolveMcpPrincipal(
  claims: McpAccessTokenClaims
): Promise<McpIdentityResult> {
  const exp = claims.exp;
  if (typeof exp === "number" && exp * 1000 <= Date.now()) {
    return {
      ok: false,
      status: 401,
      code: "invalid_token",
      message: "Access token expired.",
    };
  }

  const email = emailFromClaims(claims);
  if (!email) {
    return {
      ok: false,
      status: 403,
      code: "unknown_user",
      message:
        "This Microsoft account is not on the Precon roster. Ask a Precon admin to add your email.",
    };
  }

  const [appUser] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (!appUser) {
    return {
      ok: false,
      status: 403,
      code: "unknown_user",
      message:
        "This Microsoft account is not on the Precon roster. Ask a Precon admin to add your email.",
    };
  }

  const granted = scopesFromClaims(claims);
  const { adminConfig, userOverride } = await loadMcpGrantState(appUser.id);
  const ceiling = mcpCeilingForUser(appUser, adminConfig, userOverride);
  const effective = effectiveMcpScopes(ceiling, granted);
  if (effective.length === 0) {
    return {
      ok: false,
      status: 403,
      code: "mcp_disabled",
      message:
        "MCP access is disabled for this account. Ask a Precon admin to enable it.",
    };
  }

  const tokenRef =
    (typeof claims.jti === "string" && claims.jti) ||
    (typeof claims.sub === "string" && claims.sub) ||
    `mcp:${email}`;

  if (typeof claims.jti === "string") {
    const { accessTokenIsRevoked } = await import("@/lib/mcp/connections");
    if (await accessTokenIsRevoked(claims.jti)) {
      return {
        ok: false,
        status: 401,
        code: "invalid_token",
        message: "Access token was revoked.",
      };
    }
  }

  const principal = createMcpPrincipal({
    user: appUser,
    tokenRef,
    scopes: effective,
    expiresAt: typeof exp === "number" ? new Date(exp * 1000) : null,
    workspaceRegion: appUser.region,
  });

  return { ok: true, principal, effectiveScopes: effective };
}
