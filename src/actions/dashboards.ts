"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { dashboardWidgets, dashboards } from "@/db/schema";
import { loadDashboardForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { dashboardService } from "@/services/dashboard-service";
import {
  assertWidgetQueryBounds,
  canPublishDashboard,
  dashboardCreateSchema,
  widgetConfigSchema,
} from "@/lib/dashboard-domain";

export async function createDashboard(raw: unknown) {
  const principal = await getWebPrincipal();
  const user = principal.user;
  const input = dashboardCreateSchema.parse(raw);
  if (input.published && !canPublishDashboard(user.role, input.scope)) {
    throw new Error("Permission denied: cannot publish at this scope.");
  }
  for (const w of input.widgets) assertWidgetQueryBounds(w);

  const [dash] = await db
    .insert(dashboards)
    .values({
      name: input.name,
      description: input.description ?? null,
      scope: input.scope,
      region: input.scope === "region" ? (input.region ?? user.region) : null,
      ownerId: user.id,
      published: input.published ?? input.scope === "personal",
    })
    .returning();

  if (input.widgets.length) {
    await db.insert(dashboardWidgets).values(
      input.widgets.map((config, i) => ({
        dashboardId: dash.id,
        sortOrder: i,
        config,
      })),
    );
  }
  revalidatePath("/dashboards");
  revalidatePath("/dashboards/studio");
  return dash.id;
}

export async function cloneDashboard(id: number) {
  const principal = await getWebPrincipal();
  const copy = await dashboardService.duplicateToPersonal(principal, id);
  revalidatePath("/dashboards/studio");
  return copy.id;
}

export async function reorderWidgets(dashboardId: number, orderedIds: number[]) {
  const principal = await getWebPrincipal();
  const loaded = await loadDashboardForPrincipal(principal, dashboardId, "edit");
  if (!loaded) throw new Error("Permission denied.");
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(dashboardWidgets)
      .set({ sortOrder: i })
      .where(eq(dashboardWidgets.id, orderedIds[i]!));
  }
  revalidatePath(`/dashboards/studio/${dashboardId}`);
}

export async function addWidget(dashboardId: number, rawConfig: unknown) {
  const principal = await getWebPrincipal();
  const config = widgetConfigSchema.parse(rawConfig);
  assertWidgetQueryBounds(config);
  const loaded = await loadDashboardForPrincipal(principal, dashboardId, "edit");
  if (!loaded) throw new Error("Permission denied.");
  const existing = await db
    .select()
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.dashboardId, dashboardId));
  await db.insert(dashboardWidgets).values({
    dashboardId,
    sortOrder: existing.length,
    config,
  });
  revalidatePath(`/dashboards/studio/${dashboardId}`);
}

export async function deleteDashboard(id: number) {
  const principal = await getWebPrincipal();
  const loaded = await loadDashboardForPrincipal(principal, id, "edit");
  if (!loaded) return;
  await db.update(dashboards).set({ deletedAt: new Date() }).where(eq(dashboards.id, id));
  revalidatePath("/dashboards/studio");
}
