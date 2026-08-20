import { redirect } from "next/navigation";
import { CopilotCanvas } from "@/components/copilot/copilot-canvas";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { roleMayAccessPath } from "@/lib/route-access";
import { roundtableFeatureEnabled } from "@/services/rollout-service";

export default async function CopilotPage() {
  const principal = await getWebPrincipal();
  const roleChrome = await roundtableFeatureEnabled(principal, "roleChrome");
  if (!roleMayAccessPath(principal.user.role, "/copilot", { roleChrome })) {
    redirect("/");
  }
  return <CopilotCanvas userId={principal.user.id} />;
}
