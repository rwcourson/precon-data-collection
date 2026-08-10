import "server-only";
import { authMode } from "@/lib/auth";
import { getCurrentUser } from "@/lib/current-user";
import { getWorkspace } from "@/lib/workspace-server";
import { getMobileContext } from "@/lib/mobile-context";
import { createPrincipal } from "./principal";

/** Transport adapter only; application services receive its explicit result. */
export async function getWebPrincipal() {
  const mobile = getMobileContext();
  if (mobile?.authorization) return mobile.authorization;
  const [user, workspace] = await Promise.all([getCurrentUser(), getWorkspace()]);
  return createPrincipal({
    user,
    authSource: authMode() === "sso" ? "sso" : "demo_session",
    workspaceRegion: workspace.region,
  });
}
