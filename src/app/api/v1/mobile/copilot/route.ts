import {
  askMagnus,
  generateDashboardPreview,
  saveCopilotDashboard,
} from "@/actions/copilot";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";

export async function POST(req: Request) {
  return withMobileAuth(req, { scopes: "write:dashboards" }, async () => {
    let body: { action?: string; prompt?: string; plan?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    try {
      if (body.action === "ask" || !body.action) {
        const result = await askMagnus(body.prompt ?? "");
        return jsonOk({ response: result });
      }
      if (body.action === "preview") {
        const preview = await generateDashboardPreview(body.prompt ?? "");
        return jsonOk({ preview });
      }
      if (body.action === "save" && body.plan) {
        const id = await saveCopilotDashboard(
          body.plan as Parameters<typeof saveCopilotDashboard>[0],
        );
        return jsonOk({ id });
      }
      return jsonError("Unknown action", 400);
    } catch (err) {
      return mapError(err);
    }
  });
}
