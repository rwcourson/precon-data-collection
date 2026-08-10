import { NextResponse } from "next/server";
import { DomainError } from "@/domain/errors";
import {
  resolveMobilePrincipal,
  type MobilePrincipal,
} from "@/lib/mobile-auth";
import { runWithMobileContext } from "@/lib/mobile-context";
import { createPrincipal } from "@/lib/authorization/principal";
import { requireScopes } from "@/lib/api-auth";
import type { ApiTokenScope } from "@/domain/contracts";

export const WORKSPACE_HEADER = "x-workspace-region";

export function jsonOk<T>(data: T, init?: { status?: number }) {
  return NextResponse.json(data, { status: init?.status ?? 200 });
}

export function jsonError(
  error: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error, ...extra }, { status });
}

export function mapError(err: unknown): NextResponse {
  if (err instanceof DomainError) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "FORBIDDEN"
          ? 403
          : err.code === "UNAUTHORIZED"
            ? 401
            : err.code === "CONFLICT"
              ? 409
              : 400;
    return jsonError(err.what, status, {
      code: err.code,
      why: err.why,
      solution: err.solution,
      details: err.message,
    });
  }
  if (err instanceof Error) {
    const msg = err.message;
    if (/permission denied|not permitted|do not have/i.test(msg)) {
      return jsonError(msg, 403, { code: "FORBIDDEN" });
    }
    if (/not found/i.test(msg)) {
      return jsonError(msg, 404, { code: "NOT_FOUND" });
    }
    return jsonError(msg, 400, { code: "BAD_REQUEST" });
  }
  return jsonError("Internal error", 500, { code: "INTERNAL" });
}

/**
 * Authenticate mobile request and run handler with ALS user/workspace context
 * so existing server actions see the principal.
 */
export async function withMobileAuth(
  req: Request,
  requirements: { scopes: ApiTokenScope | readonly ApiTokenScope[] },
  handler: (principal: MobilePrincipal, req: Request) => Promise<NextResponse>,
): Promise<NextResponse> {
  const resolved = await resolveMobilePrincipal(req.headers.get("authorization"));
  if (!resolved.ok) {
    return jsonError(resolved.error, resolved.status);
  }
  const scope = requireScopes(resolved.principal.token, requirements.scopes);
  if (!scope.ok) return jsonError(scope.error, scope.status);
  const workspaceCookie =
    req.headers.get(WORKSPACE_HEADER)?.trim() || undefined;
  const authorization = createPrincipal({
    user: resolved.principal.user,
    authSource: resolved.principal.source,
    workspaceRegion:
      workspaceCookie === "corporate"
        ? null
        : (workspaceCookie ?? resolved.principal.user.region),
    token: resolved.principal.token,
  });
  const principal = { ...resolved.principal, authorization };

  try {
    return await runWithMobileContext(
      { user: resolved.principal.user, workspaceCookie, authorization },
      () => handler(principal, req),
    );
  } catch (err) {
    return mapError(err);
  }
}
