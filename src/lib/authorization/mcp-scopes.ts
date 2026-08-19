import type { ApiTokenScope } from "@/domain/contracts";

/** Scopes an MCP client may request. Subset of ApiTokenScope — never invent names. */
export const GRANTABLE_MCP_SCOPES = [
  "profile:read",
  "read:pursuits",
  "write:pursuits",
  "read:reports",
  "read:dashboards",
  "read:sheets",
] as const satisfies readonly ApiTokenScope[];

export type GrantableMcpScope = (typeof GRANTABLE_MCP_SCOPES)[number];

export const GRANTABLE_MCP_SCOPE_SET: ReadonlySet<string> = new Set(
  GRANTABLE_MCP_SCOPES
);

/** OIDC protocol scopes advertised alongside the grantable API scopes. */
export const MCP_OIDC_SCOPES = ["openid", "profile", "offline_access"] as const;

export const MCP_ADVERTISED_SCOPES = [
  ...MCP_OIDC_SCOPES,
  ...GRANTABLE_MCP_SCOPES,
] as const;

export const MCP_SCOPE_LABELS: Record<string, string> = {
  openid: "Sign you in",
  profile: "Use your display name",
  offline_access: "Stay connected until you revoke access",
  "profile:read": "View your name, role, and region",
  "read:pursuits": "Read jobs, rounds, notes, and staffing",
  "write:pursuits": "Update pursuit fields and add notes",
  "read:reports": "Read reports",
  "read:dashboards": "Read dashboards and chart plans",
  "read:sheets": "Read sheets",
};

export function mcpScopeLabel(scope: string): string {
  return MCP_SCOPE_LABELS[scope] ?? scope;
}

/** Parse OAuth `scope` query values that use space or `+` delimiters. */
export function parseConsentScopes(scopeParam: string | undefined): string[] {
  if (!scopeParam?.trim()) return [];
  return scopeParam
    .split(/[+\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const ADVERTISED_SCOPE_SET: ReadonlySet<string> = new Set(
  MCP_ADVERTISED_SCOPES
);

/**
 * Consent UI may only display/post advertised OIDC + grantable MCP scopes.
 * Never-grantable ApiTokenScope strings are dropped even if a client requests them.
 */
export function filterConsentScopes(scopes: readonly string[]): string[] {
  return scopes.filter((scope) => ADVERTISED_SCOPE_SET.has(scope));
}
