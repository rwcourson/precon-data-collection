import { type NextRequest, NextResponse } from "next/server";
import { cookiesLookLikeBetterAuthSession } from "@/lib/auth-constants";
import { inspectRuntimeConfig, runtimeDiagnostics } from "@/lib/runtime-config";

/**
 * SSO gate: no session cookie → HTML redirects to /sign-in (chrome-free).
 * Full session validation still happens in (app)/layout + getCurrentUser.
 */
const EXEMPT_EXACT = new Set([
  "/sign-in",
  "/api/health/live",
  "/api/health/ready",
  // MCP clients probe without credentials expecting the RFC 9728
  // WWW-Authenticate challenge; requireMcpAuth owns auth and fails closed.
  "/api/mcp",
]);
const EXEMPT_PREFIXES = ["/api/auth", "/api/jobs/", "/.well-known/"];

function isExempt(pathname: string): boolean {
  if (EXEMPT_EXACT.has(pathname)) return true;
  return EXEMPT_PREFIXES.some(
    (p) =>
      pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p)
  );
}

function hasSessionCookie(req: NextRequest): boolean {
  return cookiesLookLikeBetterAuthSession(req.cookies.getAll());
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  const nextWithPath = () =>
    NextResponse.next({ request: { headers: requestHeaders } });

  if (isExempt(pathname)) return nextWithPath();

  const status = inspectRuntimeConfig();
  if (!status.ok) {
    // Still allow the bare sign-in HTML if config is mid-deploy.
    if (pathname === "/sign-in") return nextWithPath();
    return NextResponse.json(
      {
        error: "Service configuration is unavailable.",
        diagnostics: runtimeDiagnostics(status),
      },
      { status: 503 }
    );
  }

  if (status.config.authMode !== "sso") return nextWithPath();

  if (!hasSessionCookie(req)) {
    if (pathname.startsWith("/api/")) {
      // Token-authenticated APIs (mobile bearer tokens, eve HMAC webhooks)
      // never carry a session cookie. Their routes enforce their own auth and
      // fail closed, so a credentialed request passes through the SSO gate.
      if (req.headers.get("authorization") || req.headers.get("x-eve-hmac")) {
        return nextWithPath();
      }
      return NextResponse.json(
        { error: "Not signed in. Sign in with Microsoft." },
        { status: 401 }
      );
    }
    const signIn = req.nextUrl.clone();
    signIn.pathname = "/sign-in";
    signIn.search = "";
    if (pathname !== "/") {
      // Keep signed OAuth/consent parameters intact across the SSO gate.
      // `next` remains a same-origin path and is validated again by /sign-in.
      signIn.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
    }
    return NextResponse.redirect(signIn);
  }
  return nextWithPath();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
