import { publicUser } from "@/lib/mobile-auth";
import { jsonOk, withMobileAuth } from "@/lib/mobile-http";
import { getWorkspace } from "@/lib/workspace-server";
import { canViewCorporate, CORPORATE } from "@/lib/workspace";

export async function GET(req: Request) {
  return withMobileAuth(req, { scopes: "profile:read" }, async (principal) => {
    const workspace = await getWorkspace();
    return jsonOk({
      user: publicUser(principal.user),
      source: principal.source,
      workspace: {
        region: workspace.region,
        label: workspace.label,
        available: workspace.available,
        canViewCorporate: workspace.canViewCorporate,
        corporateKey: CORPORATE,
      },
      capabilities: {
        canViewCorporate: canViewCorporate(principal.user),
        role: principal.user.role,
      },
    });
  });
}
