import { db } from "@/db";
import { dashboardWidgets, dashboards } from "@/db/schema";
import { jsonError, jsonOk, withMobileAuth } from "@/lib/mobile-http";
import { asc, eq } from "drizzle-orm";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withMobileAuth(req, async () => {
    const { id } = await ctx.params;
    const dashId = Number(id);
    if (!Number.isFinite(dashId)) return jsonError("Invalid id", 400);
    const [dash] = await db.select().from(dashboards).where(eq(dashboards.id, dashId));
    if (!dash) return jsonError("Dashboard not found", 404);
    const widgets = await db
      .select()
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.dashboardId, dashId))
      .orderBy(asc(dashboardWidgets.sortOrder));
    return jsonOk({ data: { dashboard: dash, widgets } });
  });
}
