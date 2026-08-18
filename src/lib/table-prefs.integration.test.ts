import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import type { User } from "@/db/schema";
import { bidScheduleViews, users, userTablePrefs } from "@/db/schema";
import { createPrincipal } from "@/lib/authorization/principal";
import {
  BID_SCHEDULE_SURFACE,
  resolveBidScheduleTableState,
} from "@/lib/table-prefs";
import { parseBidScheduleViewConfig } from "@/lib/view-config";
import { tablePrefsService } from "@/services/table-prefs-service";

function principalFor(user: User, workspaceRegion: string | null) {
  return createPrincipal({ user, authSource: "sso", workspaceRegion });
}

describe("per-user bid-schedule table prefs", () => {
  const createdViewIds: number[] = [];
  const touchedUserIds: number[] = [];

  afterAll(async () => {
    if (createdViewIds.length > 0) {
      await db
        .delete(bidScheduleViews)
        .where(inArray(bidScheduleViews.id, createdViewIds));
    }
    if (touchedUserIds.length > 0) {
      await db
        .delete(userTablePrefs)
        .where(inArray(userTablePrefs.userId, touchedUserIds));
    }
  });

  it("survives a fresh load for the same user and does not leak to another user", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const [lead] = await db
      .select()
      .from(users)
      .where(eq(users.role, "estimate_lead"))
      .limit(1);
    expect(pcm.id).not.toBe(lead.id);
    touchedUserIds.push(pcm.id, lead.id);

    const pcmPrincipal = principalFor(pcm, "Central");
    const leadPrincipal = principalFor(lead, "Central");

    await tablePrefsService.save(pcmPrincipal, BID_SCHEDULE_SURFACE, {
      columns: ["jobNumber", "jobName", "status"],
      density: "detail",
      columnWidths: { jobName: 320 },
    });
    await tablePrefsService.save(leadPrincipal, BID_SCHEDULE_SURFACE, {
      columns: ["jobName", "bidDueDate"],
      density: "summary",
    });

    const pcmReload = await tablePrefsService.load(
      pcmPrincipal,
      BID_SCHEDULE_SURFACE
    );
    const leadReload = await tablePrefsService.load(
      leadPrincipal,
      BID_SCHEDULE_SURFACE
    );
    expect(pcmReload.columns).toEqual(["jobNumber", "jobName", "status"]);
    expect(pcmReload.density).toBe("detail");
    expect(pcmReload.columnWidths).toEqual({ jobName: 320 });
    expect(leadReload.columns).toEqual(["jobName", "bidDueDate"]);
    expect(leadReload.columns).not.toEqual(pcmReload.columns);
    expect(leadReload.columnWidths).toBeUndefined();
  });

  it("stores a default-view pointer that resolve auto-applies, then restores prefs when skipped", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    touchedUserIds.push(pcm.id);
    const principal = principalFor(pcm, "Central");

    await tablePrefsService.save(principal, BID_SCHEDULE_SURFACE, {
      columns: ["jobNumber", "jobName"],
      density: "summary",
    });

    const [view] = await db
      .insert(bidScheduleViews)
      .values({
        name: "phase-10-default-view",
        ownerId: pcm.id,
        region: null,
        shared: false,
        config: parseBidScheduleViewConfig({
          columns: ["jobName", "status", "bidDueDate"],
          density: "detail",
          section: "upcoming",
        }),
      })
      .returning({ id: bidScheduleViews.id });
    createdViewIds.push(view.id);

    await tablePrefsService.setDefaultView(principal, view.id);
    const prefs = await tablePrefsService.load(principal, BID_SCHEDULE_SURFACE);
    expect(prefs.defaultViewId).toBe(view.id);
    expect(prefs.columns).toEqual(["jobNumber", "jobName"]);

    const onLoad = resolveBidScheduleTableState({
      prefs,
      views: [
        {
          id: view.id,
          config: parseBidScheduleViewConfig({
            columns: ["jobName", "status", "bidDueDate"],
            density: "detail",
          }),
        },
      ],
    });
    expect(onLoad.source).toBe("view");
    expect(onLoad.activeViewId).toBe(view.id);
    expect(onLoad.columns).toEqual(["jobName", "status", "bidDueDate"]);

    const named = resolveBidScheduleTableState({
      urlViewId: view.id,
      prefs,
      views: [
        {
          id: view.id,
          config: { columns: ["jobName", "status", "bidDueDate"] },
        },
      ],
    });
    expect(named.source).toBe("view");

    const cleared = resolveBidScheduleTableState({
      skipDefaultView: true,
      prefs,
      views: [
        {
          id: view.id,
          config: { columns: ["jobName", "status", "bidDueDate"] },
        },
      ],
    });
    expect(cleared.source).toBe("prefs");
    expect(cleared.columns).toEqual(["jobNumber", "jobName"]);
  });
});
