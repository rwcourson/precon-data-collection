import type { ApiToken, User } from "@/db/schema";
import type { ApiTokenScope } from "@/domain/contracts";
import type {
  AuthSource,
  EffectiveWorkspace,
  Principal,
  TokenConstraints,
} from "./types";

const TOKEN_SCOPES = new Set<ApiTokenScope>([
  "profile:read",
  "read:pursuits",
  "read:reports",
  "read:dashboards",
  "read:sheets",
  "read:notifications",
  "read:admin",
  "read:trash",
  "write:pursuits",
  "write:reports",
  "write:dashboards",
  "write:sheets",
  "write:notifications",
  "write:admin",
  "write:trash",
  "write:destructive",
  "integrate:connect",
  "admin:tokens",
]);

function intersection(
  left: readonly string[],
  right: readonly string[]
): string[] {
  const allowed = new Set(right);
  return left.filter((value) => allowed.has(value));
}

export function createPrincipal(input: {
  user: User;
  authSource: AuthSource;
  workspaceRegion?: string | null;
  token?: ApiToken | null;
  tokenConstraints?: TokenConstraints | null;
}): Principal {
  const constraints: TokenConstraints | null = input.tokenConstraints
    ? {
        tokenId: input.tokenConstraints.tokenId,
        scopes: input.tokenConstraints.scopes.filter(
          (scope): scope is ApiTokenScope =>
            TOKEN_SCOPES.has(scope as ApiTokenScope)
        ),
        regionAllowlist: input.tokenConstraints.regionAllowlist,
        expiresAt: input.tokenConstraints.expiresAt,
      }
    : input.token
      ? {
          tokenId: input.token.id,
          scopes: (input.token.scopes ?? []).filter(
            (scope): scope is ApiTokenScope =>
              TOKEN_SCOPES.has(scope as ApiTokenScope)
          ),
          regionAllowlist: input.token.regionAllowlist,
          expiresAt: input.token.expiresAt,
        }
      : null;

  if (
    (input.authSource === "api_token" || input.authSource === "mcp") &&
    !constraints
  ) {
    throw new Error(
      input.authSource === "mcp"
        ? "MCP principals require token constraints."
        : "API-token principals require token constraints."
    );
  }
  const workspace: EffectiveWorkspace = input.workspaceRegion
    ? { kind: "region", region: input.workspaceRegion }
    : { kind: "corporate", region: null };

  const baseRegions: "all" | string[] =
    input.user.role === "corporate_admin" ||
    input.user.role === "leadership" ||
    input.user.region == null
      ? "all"
      : [input.user.region];
  let allowedRegions: "all" | string[] = baseRegions;
  if (workspace.kind === "region") {
    allowedRegions =
      baseRegions === "all" || baseRegions.includes(workspace.region)
        ? [workspace.region]
        : [];
  }
  const tokenRegions = constraints?.regionAllowlist ?? [];
  if (tokenRegions.length > 0) {
    allowedRegions =
      allowedRegions === "all"
        ? [...tokenRegions]
        : intersection(allowedRegions, tokenRegions);
  }

  return {
    authSource: input.authSource,
    user: input.user,
    workspace,
    allowedRegions,
    token: constraints,
  };
}

/**
 * MCP principals always carry a non-null token so `tokenAllows` enforces scopes.
 * `authSource` is `"mcp"` (not `"api_token"`) so audit logs can tell OAuth MCP
 * grants apart from `pcn_` API tokens. `tokenId` is the OAuth access-token or
 * consent id string.
 */
export function createMcpPrincipal(input: {
  user: User;
  tokenRef: string;
  scopes: readonly string[];
  expiresAt?: Date | null;
  workspaceRegion?: string | null;
}): Principal {
  const scopes = input.scopes.filter((scope): scope is ApiTokenScope =>
    TOKEN_SCOPES.has(scope as ApiTokenScope)
  );
  return createPrincipal({
    user: input.user,
    authSource: "mcp",
    workspaceRegion: input.workspaceRegion,
    tokenConstraints: {
      tokenId: input.tokenRef,
      scopes,
      regionAllowlist: [],
      expiresAt: input.expiresAt ?? null,
    },
  });
}

export function principalAllowsRegion(
  principal: Principal,
  region: string | null
): boolean {
  if (region == null) return true;
  return (
    principal.allowedRegions === "all" ||
    principal.allowedRegions.includes(region)
  );
}
