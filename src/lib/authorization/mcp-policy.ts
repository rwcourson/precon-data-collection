import type { Role, User } from "@/db/schema";
import { type ApiTokenScope, apiTokenScopeSchema } from "@/domain/contracts";
import {
  GRANTABLE_MCP_SCOPE_SET,
  GRANTABLE_MCP_SCOPES,
  type GrantableMcpScope,
} from "@/lib/authorization/mcp-scopes";

export const MCP_READ_SCOPES = [
  "profile:read",
  "read:pursuits",
  "read:reports",
  "read:dashboards",
  "read:sheets",
] as const satisfies readonly GrantableMcpScope[];

const ALL_API_TOKEN_SCOPES = apiTokenScopeSchema.options;

/**
 * Every ApiTokenScope outside the grantable MCP six. New scopes added to the
 * contract default to denied until they are explicitly added to GRANTABLE_MCP_SCOPES.
 */
export const NEVER_GRANTABLE: readonly ApiTokenScope[] =
  ALL_API_TOKEN_SCOPES.filter((scope) => !GRANTABLE_MCP_SCOPE_SET.has(scope));

export const NEVER_GRANTABLE_SET: ReadonlySet<string> = new Set(
  NEVER_GRANTABLE
);

export type McpAdminConfig = {
  /** Kill switch. `false` disables MCP for every role, including corporate_admin. */
  enabled: boolean;
  roleDefaults: Record<Role, GrantableMcpScope[]>;
};

export type McpUserOverride = {
  /** `null` inherits the global kill switch. `false` disables MCP for this user. */
  enabled: boolean | null;
  /** `null` inherits the role default. */
  scopeCeiling: string[] | null;
};

export const MCP_ROLES: readonly Role[] = [
  "pcm",
  "estimate_lead",
  "admin_jsa",
  "rpd",
  "leadership",
  "corporate_admin",
];

function readOnlyDefaults(): Record<Role, GrantableMcpScope[]> {
  const reads = [...MCP_READ_SCOPES];
  return {
    pcm: reads,
    estimate_lead: reads,
    admin_jsa: reads,
    rpd: reads,
    leadership: reads,
    corporate_admin: reads,
  };
}

export const DEFAULT_MCP_ADMIN_CONFIG: McpAdminConfig = {
  enabled: true,
  roleDefaults: readOnlyDefaults(),
};

function asGrantable(scopes: readonly string[]): GrantableMcpScope[] {
  const seen = new Set<GrantableMcpScope>();
  const out: GrantableMcpScope[] = [];
  for (const scope of scopes) {
    if (!GRANTABLE_MCP_SCOPE_SET.has(scope)) continue;
    if (NEVER_GRANTABLE_SET.has(scope)) continue;
    const grantable = scope as GrantableMcpScope;
    if (seen.has(grantable)) continue;
    seen.add(grantable);
    out.push(grantable);
  }
  return out;
}

export function parseMcpAdminConfig(value: unknown): McpAdminConfig {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const roleDefaults = readOnlyDefaults();
  const incoming =
    raw.roleDefaults && typeof raw.roleDefaults === "object"
      ? (raw.roleDefaults as Record<string, unknown>)
      : {};
  for (const role of MCP_ROLES) {
    const listed = incoming[role];
    if (Array.isArray(listed)) {
      roleDefaults[role] = asGrantable(listed.map(String));
    }
  }
  return {
    enabled: raw.enabled !== false,
    roleDefaults,
  };
}

export function mcpCeilingForUser(
  user: Pick<User, "role">,
  adminConfig: McpAdminConfig,
  userOverride: McpUserOverride | null
): GrantableMcpScope[] {
  if (!adminConfig.enabled) return [];
  if (userOverride?.enabled === false) return [];
  const inherited = adminConfig.roleDefaults[user.role] ?? [...MCP_READ_SCOPES];
  const source =
    userOverride?.scopeCeiling != null ? userOverride.scopeCeiling : inherited;
  return asGrantable(source);
}

export function effectiveMcpScopes(
  ceiling: readonly string[],
  grantedScopes: readonly string[]
): GrantableMcpScope[] {
  const allowed = new Set(asGrantable(ceiling));
  return asGrantable(grantedScopes).filter((scope) => allowed.has(scope));
}

export { GRANTABLE_MCP_SCOPES };
