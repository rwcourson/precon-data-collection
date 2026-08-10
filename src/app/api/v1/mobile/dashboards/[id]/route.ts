import { db } from "@/db";
import { dashboardWidgets } from "@/db/schema";
import { jsonError, jsonOk, withMobileAuth } from "@/lib/mobile-http";
import { asc, eq } from "drizzle-orm";
import { authorizationService } from "@/services/authorization-service";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withMobileAuth(req, { scopes: "read:dashboards" }, async (principal) => {
    const { id } = await ctx.params;
    const dashId = Number(id);
    if (!Number.isFinite(dashId)) return jsonError("Invalid id", 400);
    const result = await authorizationService.readDashboard(principal.authorization, dashId);
    if (!result.ok) return jsonError(result.error.what, 404, { code: result.error.code });
    const dash = result.value;
    const widgets = await db
      .select()
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.dashboardId, dashId))
      .orderBy(asc(dashboardWidgets.sortOrder));
    return jsonOk({ data: { dashboard: dash, widgets } });
  });
}
