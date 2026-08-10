import { NextResponse, type NextRequest } from "next/server";
import { inspectRuntimeConfig, runtimeDiagnostics } from "@/lib/runtime-config";
import { verifySsoRequest } from "@/lib/sso-trust";

/**
 * Gate for SSO mode. The authenticating proxy in front of the app is what
 * actually establishes identity; this only refuses to serve a request that
 * arrived without one, so a misconfigured deployment fails closed instead of
 * silently falling back to a demo persona.
 *
 * The scheduler endpoints are exempt because they authenticate with
 * `CRON_SECRET` rather than a user identity.
 */
const EXEMPT = ["/api/jobs/"];
const HEALTH_EXEMPT = ["/api/health/live", "/api/health/ready"];

export function proxy(req: NextRequest) {
  if (HEALTH_EXEMPT.includes(req.nextUrl.pathname)) return NextResponse.next();

  const status = inspectRuntimeConfig();
  if (!status.ok) {
    return NextResponse.json(
      { error: "Service configuration is unavailable.", diagnostics: runtimeDiagnostics(status) },
      { status: 503 },
    );
  }

  if (status.config.authMode !== "sso") return NextResponse.next();
  if (EXEMPT.some((p) => req.nextUrl.pathname.startsWith(p))) return NextResponse.next();

  const trust = verifySsoRequest(req.headers, status.config);
  if (!trust.ok) {
    return NextResponse.json(
      { error: "Not signed in. This deployment requires the trusted B&G SSO proxy." },
      { status: 401 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
