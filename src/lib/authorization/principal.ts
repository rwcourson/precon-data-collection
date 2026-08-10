import type { ApiToken, User } from "@/db/schema";
import type { ApiTokenScope } from "@/domain/contracts";
import type { AuthSource, EffectiveWorkspace, Principal } from "./types";

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

function intersection(left: readonly string[], right: readonly string[]): string[] {
  const allowed = new Set(right);
  return left.filter((value) => allowed.has(value));
}

export function createPrincipal(input: {
  user: User;
  authSource: AuthSource;
  workspaceRegion?: string | null;
  token?: ApiToken | null;
}): Principal {
  if (input.authSource === "api_token" && !input.token) {
    throw new Error("API-token principals require token constraints.");
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
      baseRegions === "all" || baseRegions.includes(workspace.region) ? [workspace.region] : [];
  }
  const tokenRegions = input.token?.regionAllowlist ?? [];
  if (tokenRegions.length > 0) {
    allowedRegions = allowedRegions === "all" ? [...tokenRegions] : intersection(allowedRegions, tokenRegions);
  }

  const scopes = (input.token?.scopes ?? []).filter(
    (scope): scope is ApiTokenScope => TOKEN_SCOPES.has(scope as ApiTokenScope),
  );
  return {
    authSource: input.authSource,
    user: input.user,
    workspace,
    allowedRegions,
    token: input.token
      ? {
          tokenId: input.token.id,
          scopes,
          regionAllowlist: input.token.regionAllowlist,
          expiresAt: input.token.expiresAt,
        }
      : null,
  };
}

export function principalAllowsRegion(principal: Principal, region: string | null): boolean {
  if (region == null) return true;
  return principal.allowedRegions === "all" || principal.allowedRegions.includes(region);
}
