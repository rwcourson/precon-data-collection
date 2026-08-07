import { NextResponse, type NextRequest } from "next/server";

/**
 * Gate for SSO mode. The authenticating proxy in front of the app is what
 * actually establishes identity; this only refuses to serve a request that
 * arrived without one, so a misconfigured deployment fails closed instead of
 * silently falling back to a demo persona.
 *
 * The scheduler endpoints are exempt because they authenticate with
 * `CRON_SECRET` rather than a user identity.
 */
const EMAIL_HEADER = process.env.SSO_EMAIL_HEADER ?? "x-forwarded-email";
const EXEMPT = ["/api/jobs/"];

export function proxy(req: NextRequest) {
  if (process.env.AUTH_MODE !== "sso") return NextResponse.next();
  if (EXEMPT.some((p) => req.nextUrl.pathname.startsWith(p))) return NextResponse.next();

  if (!req.headers.get(EMAIL_HEADER)) {
    return NextResponse.json(
      { error: "Not signed in. This deployment requires SSO through the B&G proxy." },
      { status: 401 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
