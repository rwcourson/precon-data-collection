import { CopilotCanvas } from "@/components/copilot/copilot-canvas";
import { getWebPrincipal } from "@/lib/authorization/web-principal";

export default async function CopilotPage() {
  const principal = await getWebPrincipal();
  return <CopilotCanvas userId={principal.user.id} />;
}
