import { NextResponse } from "next/server";
import { DomainError } from "@/domain/errors";
import {
  resolveMobilePrincipal,
  type MobilePrincipal,
} from "@/lib/mobile-auth";
import { runWithMobileContext } from "@/lib/mobile-context";

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
  handler: (principal: MobilePrincipal, req: Request) => Promise<NextResponse>,
): Promise<NextResponse> {
  const resolved = await resolveMobilePrincipal(req.headers.get("authorization"));
  if (!resolved.ok) {
    return jsonError(resolved.error, resolved.status);
  }
  const workspaceCookie =
    req.headers.get(WORKSPACE_HEADER)?.trim() || undefined;

  try {
    return await runWithMobileContext(
      { user: resolved.principal.user, workspaceCookie },
      () => handler(resolved.principal, req),
    );
  } catch (err) {
    return mapError(err);
  }
}
