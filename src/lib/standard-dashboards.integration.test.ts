import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import type { User } from "@/db/schema";
import { dashboards, dashboardWidgets, users } from "@/db/schema";
import {
  listDashboardsForPrincipal,
  loadDashboardForPrincipal,
} from "@/lib/authorization/loaders";
import { createPrincipal } from "@/lib/authorization/principal";
import { dashboardService } from "@/services/dashboard-service";

function principalFor(user: User, workspaceRegion: string | null) {
  return createPrincipal({ user, authSource: "sso", workspaceRegion });
}

describe("standard dashboards", () => {
  const createdUserIds: number[] = [];
  const createdDashIds: number[] = [];

  afterAll(async () => {
    if (createdDashIds.length) {
      await db
        .delete(dashboardWidgets)
        .where(inArray(dashboardWidgets.dashboardId, createdDashIds));
      await db.delete(dashboards).where(inArray(dashboards.id, createdDashIds));
    }
    if (createdUserIds.length) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  it("shows corporate + own-region standards, blocks in-place edit, and duplicates to personal", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const [georgia] = await db
      .insert(users)
      .values({
        name: "Georgia PCM",
        title: "Preconstruction Manager",
        role: "pcm",
        region: "Georgia",
        preconDepartment: "Georgia – Commercial",
        email: `ga-pcm-${Date.now()}@example.com`,
      })
      .returning();
    createdUserIds.push(georgia.id);

    const central = principalFor(pcm, "Central");
    const ga = principalFor(georgia, "Georgia");
    const centralList = await listDashboardsForPrincipal(central);
    const gaList = await listDashboardsForPrincipal(ga);

    const centralStandards = centralList.filter((row) => row.isStandard);
    const gaStandards = gaList.filter((row) => row.isStandard);
    expect(centralStandards.some((row) => row.scope === "corporate")).toBe(
      true
    );
    expect(
      centralStandards.some(
        (row) => row.scope === "region" && row.region === "Central"
      )
    ).toBe(true);
    expect(centralStandards.some((row) => row.region === "Georgia")).toBe(
      false
    );
    expect(gaStandards.some((row) => row.scope === "corporate")).toBe(true);
    expect(gaStandards.some((row) => row.region === "Georgia")).toBe(true);
    expect(gaStandards.some((row) => row.region === "Central")).toBe(false);

    const standard = centralStandards.find((row) => row.scope === "corporate");
    expect(standard).toBeTruthy();
    const edit = await loadDashboardForPrincipal(central, standard!.id, "edit");
    expect(edit).toBeNull();

    const copy = await dashboardService.duplicateToPersonal(
      central,
      standard!.id
    );
    createdDashIds.push(copy.id);
    expect(copy.isStandard).toBe(false);
    expect(copy.scope).toBe("personal");
    expect(copy.ownerId).toBe(pcm.id);
    const copyEdit = await loadDashboardForPrincipal(central, copy.id, "edit");
    expect(copyEdit).not.toBeNull();
  });
});
