import { cookies } from "next/headers";
import { getMobileContext } from "@/lib/mobile-context";
import { jsonError, jsonOk, withMobileAuth } from "@/lib/mobile-http";
import {
  CORPORATE,
  canViewCorporate,
  resolveWorkspace,
  WORKSPACE_COOKIE,
} from "@/lib/workspace";

export async function POST(req: Request) {
  return withMobileAuth(req, { scopes: "profile:read" }, async (principal) => {
    let body: { region?: string };
    try {
      body = (await req.json()) as { region?: string };
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    const region = String(body.region ?? "").trim();
    if (!region) return jsonError("region is required", 400);

    const user = principal.user;
    const allowed =
      region === CORPORATE
        ? canViewCorporate(user)
        : resolveWorkspace(user, region).region === region ||
          resolveWorkspace(user, region).available.includes(region);
    if (!allowed) {
      return jsonError("You do not have access to that Region workspace.", 403);
    }

    // Persist cookie for web parity; mobile primarily uses X-Workspace-Region header.
    try {
      const store = await cookies();
      store.set(WORKSPACE_COOKIE, region, { path: "/" });
    } catch {
      // Cookie may be unavailable in some test contexts.
    }

    const workspace = resolveWorkspace(user, region);
    const mobile = getMobileContext();
    if (mobile) mobile.workspaceCookie = region;

    return jsonOk({
      workspace: {
        region: workspace.region,
        label: workspace.label,
        available: workspace.available,
        canViewCorporate: workspace.canViewCorporate,
      },
    });
  });
}
