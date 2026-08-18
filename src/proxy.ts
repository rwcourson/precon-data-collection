import { type NextRequest, NextResponse } from "next/server";
import { BA_SESSION_COOKIE } from "@/lib/auth-constants";
import { inspectRuntimeConfig, runtimeDiagnostics } from "@/lib/runtime-config";

/**
 * SSO gate: no session cookie → HTML redirects to /sign-in (chrome-free).
 * Full session validation still happens in (app)/layout + getCurrentUser.
 */
const EXEMPT_EXACT = new Set([
  "/sign-in",
  "/api/health/live",
  "/api/health/ready",
]);
const EXEMPT_PREFIXES = ["/api/auth", "/api/jobs/"];

function isExempt(pathname: string): boolean {
  if (EXEMPT_EXACT.has(pathname)) return true;
  return EXEMPT_PREFIXES.some(
    (p) =>
      pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p)
  );
}

function hasSessionCookie(req: NextRequest): boolean {
  const names = [
    BA_SESSION_COOKIE,
    `__Secure-${BA_SESSION_COOKIE}`,
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
    "better-auth-session_token",
    "__Secure-better-auth-session_token",
  ];
  for (const name of names) {
    const v = req.cookies.get(name)?.value;
    if (v) return true;
  }
  // Chunked cookies
  for (const c of req.cookies.getAll()) {
    if (c.name.includes("session_token") && c.value) return true;
  }
  return false;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isExempt(pathname)) return NextResponse.next();

  const status = inspectRuntimeConfig();
  if (!status.ok) {
    // Still allow the bare sign-in HTML if config is mid-deploy.
    if (pathname === "/sign-in") return NextResponse.next();
    return NextResponse.json(
      {
        error: "Service configuration is unavailable.",
        diagnostics: runtimeDiagnostics(status),
      },
      { status: 503 }
    );
  }

  if (status.config.authMode !== "sso") return NextResponse.next();

  if (!hasSessionCookie(req)) {
    if (pathname.startsWith("/api/")) {
      // Token-authenticated APIs (mobile bearer tokens, eve HMAC webhooks)
      // never carry a session cookie. Their routes enforce their own auth and
      // fail closed, so a credentialed request passes through the SSO gate.
      if (req.headers.get("authorization") || req.headers.get("x-eve-hmac")) {
        return NextResponse.next();
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
      signIn.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
