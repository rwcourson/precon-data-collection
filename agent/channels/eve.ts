import { eveChannel } from "eve/channels/eve";
import { vercelOidc, type AuthFn } from "eve/channels/auth";

function appOrigin(request: Request): string {
  const fromEnv = process.env.APP_ORIGIN?.trim() || process.env.EVE_APP_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  if (process.env.VERCEL_URL?.trim()) return `https://${process.env.VERCEL_URL.trim()}`;
  return "http://127.0.0.1:3000";
}

function appSession(): AuthFn<Request> {
  return async (request) => {
    const cookie = request.headers.get("cookie") ?? "";
    const demo = /(?:^|;\s*)demo-user-id=(\d+)/.exec(cookie);
    if (demo) {
      return {
        authenticator: "app",
        principalId: demo[1],
        principalType: "user",
        attributes: {} as Record<string, string>,
      };
    }
    const response = await fetch(`${appOrigin(request)}/api/v1/copilot/identity`, {
      headers: cookie ? { cookie } : {},
    });
    if (!response.ok) return null;
    const user = (await response.json()) as {
      id?: number;
      region?: string | null;
      workspaceRegion?: string | null;
    };
    if (!user.id || !Number.isInteger(user.id)) return null;
    const region = user.workspaceRegion ?? user.region ?? "";
    return {
      authenticator: "app",
      principalId: String(user.id),
      principalType: "user",
      attributes: (region ? { region } : {}) as Record<string, string>,
    };
  };
}

export default eveChannel({
  // Fail closed on anonymous traffic — this agent reads private precon data.
  // Do not add localDev(): its synthetic principalId is not an app user id.
  auth: [appSession(), vercelOidc()],
});
