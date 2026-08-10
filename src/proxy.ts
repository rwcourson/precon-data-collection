import { NextResponse, type NextRequest } from "next/server";
import { inspectRuntimeConfig, runtimeDiagnostics } from "@/lib/runtime-config";
import { BA_SESSION_COOKIE } from "@/lib/auth-constants";

/**
 * Gate for SSO mode. Better Auth Microsoft holds the session cookie;
 * this edge check only fails closed when the cookie is absent so demos
 * and misconfigured deployments do not silently serve as a random persona.
 *
 * Full session + role mapping still run in getCurrentUser() on the server.
 *
 * Cron endpoints authenticate with CRON_SECRET, not a user cookie.
 */
const EXEMPT_PREFIXES = ["/api/auth", "/api/jobs/", "/sign-in"];
const HEALTH_EXEMPT = ["/api/health/live", "/api/health/ready"];

function isExempt(pathname: string): boolean {
  if (HEALTH_EXEMPT.includes(pathname)) return true;
  return EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`) || pathname.startsWith(p));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isExempt(pathname)) return NextResponse.next();

  const status = inspectRuntimeConfig();
  if (!status.ok) {
    return NextResponse.json(
      { error: "Service configuration is unavailable.", diagnostics: runtimeDiagnostics(status) },
      { status: 503 },
    );
  }

  if (status.config.authMode !== "sso") return NextResponse.next();

  const token =
    req.cookies.get(BA_SESSION_COOKIE)?.value ||
    req.cookies.get(`__Secure-${BA_SESSION_COOKIE}`)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Not signed in. Sign in with Microsoft (AUTH_MODE=sso)." },
        { status: 401 },
      );
    }
    const signIn = new URL("/sign-in", req.url);
    signIn.searchParams.set("next", pathname);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
