import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { dashboardWidgets, dashboards } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { loadDashboardForPrincipal } from "@/lib/authorization/loaders";
import type { Principal } from "@/lib/authorization/types";
import { allStandardDashboardDefs } from "@/lib/standard-dashboards";

/** Standard dashboards are seeded, read-only canvases. Duplicate is the personal escape hatch. */
export const dashboardService = {
  async duplicateToPersonal(principal: Principal, dashboardId: number) {
    const loaded = await loadDashboardForPrincipal(principal, dashboardId);
    if (!loaded) throw DomainError.notFound("Dashboard not found");
    const src = loaded.value;
    const widgets = await db
      .select()
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.dashboardId, src.id))
      .orderBy(asc(dashboardWidgets.sortOrder));

    const [copy] = await db
      .insert(dashboards)
      .values({
        name: `${src.name} (copy)`,
        description: src.description,
        scope: "personal",
        region: null,
        ownerId: principal.user.id,
        published: false,
        isStandard: false,
      })
      .returning();

    if (widgets.length) {
      await db.insert(dashboardWidgets).values(
        widgets.map((widget, i) => ({
          dashboardId: copy.id,
          sortOrder: i,
          config: widget.config,
        })),
      );
    }
    return copy;
  },

  async seedStandard(ownerId: number) {
    const existing = await db
      .select({ name: dashboards.name, region: dashboards.region, scope: dashboards.scope })
      .from(dashboards)
      .where(and(eq(dashboards.isStandard, true), isNull(dashboards.deletedAt)));
    const seen = new Set(existing.map((row) => `${row.scope}:${row.region ?? ""}:${row.name}`));

    for (const def of allStandardDashboardDefs()) {
      const key = `${def.scope}:${def.region ?? ""}:${def.name}`;
      if (seen.has(key)) continue;
      const [dash] = await db
        .insert(dashboards)
        .values({
          name: def.name,
          description: def.description,
          scope: def.scope,
          region: def.region,
          ownerId,
          published: true,
          isStandard: true,
        })
        .returning();
      if (def.widgets.length) {
        await db.insert(dashboardWidgets).values(
          def.widgets.map((config, i) => ({
            dashboardId: dash.id,
            sortOrder: i,
            config,
          })),
        );
      }
    }
  },
};
