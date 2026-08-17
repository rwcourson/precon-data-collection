import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, estimateRounds, jobs, users } from "@/db/schema";
import type { User } from "@/db/schema";
import { createPrincipal } from "@/lib/authorization/principal";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { parseHierarchyFromSearchParams } from "@/lib/bid-schedule-filter";
import { buildOverviewQueues } from "@/lib/overview-queues";
import { filterNeedsStaffing } from "@/lib/staffing";
import { staffingService } from "@/services/staffing-service";

function principalFor(user: User, workspaceRegion: string | null) {
  return createPrincipal({ user, authSource: "sso", workspaceRegion });
}

describe("staffing mark and needs-staffing queue", () => {
  const touchedRoundIds: number[] = [];

  afterAll(async () => {
    if (touchedRoundIds.length === 0) return;
    await db
      .update(estimateRounds)
      .set({ teamAssignedAt: null, teamAssignedById: null })
      .where(inArray(estimateRounds.id, touchedRoundIds));
    await db.delete(auditLog).where(
      and(eq(auditLog.entity, "round"), inArray(auditLog.roundId, touchedRoundIds), eq(auditLog.field, "teamAssignedAt")),
    );
  });

  it("overview queue count equals the preset-filtered schedule row count", async () => {
    const [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
    const principal = principalFor(pcm, "Central");
    const listed = await listRoundsWithJobsForPrincipal(principal);
    const hierarchy = parseHierarchyFromSearchParams(
      {},
      { workspaceRegion: "Central", allowedRegions: ["Central"] },
    );
    const inputs = listed.map(({ round, job }) => ({
      roundId: round.id,
      jobId: job.id,
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      status: round.status,
      bidDueDate: round.bidDueDate,
      isLinked: job.isLinked,
      missingRequiredCount: 0,
      preconDepartment: round.preconDepartment,
      teamAssignedAt: round.teamAssignedAt,
    }));
    const queues = buildOverviewQueues(inputs, new Date(), hierarchy);
    const schedule = filterNeedsStaffing(
      listed.map(({ round }) => ({
        status: round.status,
        teamAssignedAt: round.teamAssignedAt,
        preconDepartment: round.preconDepartment,
      })),
      hierarchy,
    );
    expect(queues.find((q) => q.id === "needs-staffing")?.count).toBe(schedule.length);
  });

  it("mark and undo persist who/when and write audit entries", async () => {
    const [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
    const [round] = await db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(
        and(
          eq(estimateRounds.status, "upcoming"),
          eq(jobs.region, "Central"),
          isNull(estimateRounds.deletedAt),
          isNull(estimateRounds.teamAssignedAt),
        ),
      )
      .limit(1);
    touchedRoundIds.push(round.id);
    const actor = principalFor(pcm, "Central");

    const marked = await staffingService.mark(actor, round.id);
    expect(marked.teamAssignedAt).toBeInstanceOf(Date);
    expect(marked.teamAssignedById).toBe(pcm.id);

    const markAudits = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.roundId, round.id), eq(auditLog.action, "staffing.mark")));
    expect(markAudits.length).toBeGreaterThanOrEqual(1);
    expect(markAudits.at(-1)?.userId).toBe(pcm.id);
    expect(markAudits.at(-1)?.newValue).toBe(marked.teamAssignedAt?.toISOString());

    const unmarked = await staffingService.unmark(actor, round.id);
    expect(unmarked.teamAssignedAt).toBeNull();
    expect(unmarked.teamAssignedById).toBeNull();

    const undoAudits = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.roundId, round.id), eq(auditLog.action, "staffing.unmark")));
    expect(undoAudits.length).toBeGreaterThanOrEqual(1);
    expect(undoAudits.at(-1)?.oldValue).toBe(marked.teamAssignedAt?.toISOString());
    expect(undoAudits.at(-1)?.newValue).toBeNull();
  });

  it("denies staffing.mark for a role the kernel does not allow", async () => {
    const [leadership] = await db.select().from(users).where(eq(users.role, "leadership")).limit(1);
    const [round] = await db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .innerJoin(jobs, eq(estimateRounds.jobId, jobs.id))
      .where(and(eq(jobs.region, "Central"), isNull(estimateRounds.deletedAt)))
      .limit(1);
    const actor = principalFor(leadership, "Central");
    await expect(staffingService.mark(actor, round.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
