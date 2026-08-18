import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import type { User } from "@/db/schema";
import {
  distributionLists,
  distributionRuns,
  emailOutbox,
  reportArtifacts,
  savedReports,
  users,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { getArtifactStorage } from "@/lib/artifact-storage";
import { createPrincipal } from "@/lib/authorization/principal";
import { UPCOMING_BID_SCHEDULE_PRESET_KEY } from "@/lib/report-presets";
import { distributionService } from "@/services/distribution-service";
import { reportScheduleService } from "@/services/report-schedule-service";
import { salesforceSyncService } from "@/services/salesforce-sync-service";

function principalFor(user: User, workspaceRegion: string | null) {
  return createPrincipal({ user, authSource: "sso", workspaceRegion });
}

describe("report schedules and run-sync-now", () => {
  const listIds: number[] = [];

  afterAll(async () => {
    if (listIds.length === 0) return;
    await db
      .delete(emailOutbox)
      .where(inArray(emailOutbox.distributionListId, listIds));
    await db
      .delete(distributionRuns)
      .where(inArray(distributionRuns.distributionListId, listIds));
    await db
      .delete(distributionLists)
      .where(inArray(distributionLists.id, listIds));
  });

  it("fires a Friday schedule once per period and attaches wrapped report HTML", async () => {
    const [rpd] = await db
      .select()
      .from(users)
      .where(eq(users.role, "rpd"))
      .limit(1);
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const [report] = await db
      .select()
      .from(savedReports)
      .where(
        and(
          eq(savedReports.ownerId, rpd.id),
          eq(savedReports.presetKey, UPCOMING_BID_SCHEDULE_PRESET_KEY),
          isNull(savedReports.deletedAt)
        )
      )
      .limit(1);
    const owner = principalFor(rpd, "Central");
    const other = principalFor(pcm, "Central");
    const schedule = await reportScheduleService.create(owner, {
      savedReportId: report.id,
      weekday: 5,
      hour: 8,
      timezone: "America/Chicago",
    });
    listIds.push(schedule.id);

    await expect(
      reportScheduleService.setPaused(other, schedule.id, true)
    ).rejects.toBeInstanceOf(DomainError);

    const friday = new Date("2026-08-21T13:00:00Z");
    const first = await distributionService.runDueDistributions(friday);
    const mine = first.filter((row) => row.listId === schedule.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.skipped).toBe(false);

    const outbox = await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.distributionListId, schedule.id));
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.kind).toBe("report_schedule");
    expect(outbox[0]?.toEmail).toBe(rpd.email);
    expect(outbox[0]?.subject).toContain("Upcoming");
    expect(outbox[0]?.attachmentStorageKey).toBeTruthy();

    const [artifact] = await db
      .select()
      .from(reportArtifacts)
      .where(eq(reportArtifacts.storageKey, outbox[0]!.attachmentStorageKey!));
    expect(artifact?.contentType).toBe("text/html");
    const stored = await getArtifactStorage().get(
      outbox[0]!.attachmentStorageKey!
    );
    expect(stored).toBeTruthy();
    const html = new TextDecoder().decode(stored!);
    expect(html).toContain("overflow-wrap: anywhere");
    expect(html).toContain("word-break: break-word");

    const second = await distributionService.runDueDistributions(friday);
    expect(second.find((row) => row.listId === schedule.id)?.skipped).toBe(
      true
    );
    const outboxAgain = await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.distributionListId, schedule.id));
    expect(outboxAgain).toHaveLength(1);
  });

  it("run-sync-now creates match candidates for an integrate principal", async () => {
    const [rpd] = await db
      .select()
      .from(users)
      .where(eq(users.role, "rpd"))
      .limit(1);
    const result = await salesforceSyncService.runIncremental(
      principalFor(rpd, "Central"),
      {
        pageSize: 50,
      }
    );
    expect(result.opportunitiesSeen).toBeGreaterThanOrEqual(0);
    expect(result).toHaveProperty("candidatesCreated");
  });
});
