import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, estimateRounds, jobRegionVisibility, jobs, jobUserVisibility, users } from "@/db/schema";
import {
  listRoundsWithJobsForPrincipal,
  loadJobForPrincipal,
  loadRoundForPrincipal,
} from "@/lib/authorization/loaders";
import { createPrincipal } from "@/lib/authorization/principal";
import { visibilityService } from "@/services/visibility-service";
import type { User } from "@/db/schema";

function principalFor(user: User, workspaceRegion: string | null) {
  return createPrincipal({ user, authSource: "sso", workspaceRegion });
}

describe("job visibility model", () => {
  const createdUserIds: number[] = [];
  const createdJobIds: number[] = [];
  const extraRegionKeys: { jobId: number; region: string }[] = [];
  const extraPinKeys: { jobId: number; userId: number }[] = [];

  afterAll(async () => {
    for (const pin of extraPinKeys) {
      await db
        .delete(jobUserVisibility)
        .where(and(eq(jobUserVisibility.jobId, pin.jobId), eq(jobUserVisibility.userId, pin.userId)));
    }
    for (const row of extraRegionKeys) {
      await db
        .delete(jobRegionVisibility)
        .where(and(eq(jobRegionVisibility.jobId, row.jobId), eq(jobRegionVisibility.region, row.region)));
    }
    if (createdUserIds.length > 0) {
      await db.delete(auditLog).where(inArray(auditLog.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    if (createdJobIds.length > 0) {
      await db.delete(jobRegionVisibility).where(inArray(jobRegionVisibility.jobId, createdJobIds));
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
    }
  });

  it("backfill: every job has ≥1 region row and the home region row exists", async () => {
    const jobRows = await db.select({ id: jobs.id, region: jobs.region }).from(jobs);
    const vis = await db
      .select({ jobId: jobRegionVisibility.jobId, region: jobRegionVisibility.region })
      .from(jobRegionVisibility);
    const distinctJobIds = new Set(vis.map((row) => row.jobId));
    const missingHome = jobRows.filter(
      (job) => !vis.some((row) => row.jobId === job.id && row.region === job.region),
    );
    // Printed for the phase-2 transcript (backfill verification).
    console.info(
      `BACKFILL_VERIFY jobs=${jobRows.length} visibility_distinct_job_id=${distinctJobIds.size} visibility_rows=${vis.length} missing_home=${missingHome.length}`,
    );
    expect(jobRows.length).toBeGreaterThan(0);
    expect(distinctJobIds.size).toBe(jobRows.length);
    expect(missingHome).toEqual([]);
  });

  it("a job with region rows for Central and Georgia appears for both principals", async () => {
    const allUsers = await db.select().from(users);
    const centralPcm = allUsers.find((row) => row.role === "pcm" && row.region === "Central")!;
    const [georgiaPcm] = await db
      .insert(users)
      .values({
        name: "Georgia Visibility PCM",
        title: "Preconstruction Manager",
        role: "pcm",
        region: "Georgia",
        preconDepartment: "Georgia – Commercial",
        email: `georgia-vis-${Date.now()}@example.com`,
      })
      .returning();
    createdUserIds.push(georgiaPcm.id);

    const [centralJob] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.region, "Central"), isNull(jobs.deletedAt)))
      .limit(1);
    expect(centralJob).toBeDefined();

    const georgiaActor = principalFor(georgiaPcm, "Georgia");
    const centralActor = principalFor(centralPcm, "Central");
    expect(await loadJobForPrincipal(georgiaActor, centralJob.id)).toBeNull();

    const added = await visibilityService.addRegion(georgiaActor, centralJob.id, "Georgia");
    expect(added.added).toBe(true);
    extraRegionKeys.push({ jobId: centralJob.id, region: "Georgia" });

    expect((await loadJobForPrincipal(georgiaActor, centralJob.id))?.value.id).toBe(centralJob.id);
    expect((await loadJobForPrincipal(centralActor, centralJob.id))?.value.id).toBe(centralJob.id);

    const georgiaList = await listRoundsWithJobsForPrincipal(georgiaActor);
    const centralList = await listRoundsWithJobsForPrincipal(centralActor);
    expect(georgiaList.some((row) => row.job.id === centralJob.id)).toBe(true);
    expect(centralList.some((row) => row.job.id === centralJob.id)).toBe(true);

    const [round] = await db
      .select()
      .from(estimateRounds)
      .where(and(eq(estimateRounds.jobId, centralJob.id), isNull(estimateRounds.deletedAt)))
      .limit(1);
    if (round) {
      expect((await loadRoundForPrincipal(georgiaActor, round.id))?.value.round.id).toBe(round.id);
    }

    const audits = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, centralJob.id), eq(auditLog.action, "visibility.add_region")));
    expect(audits.some((row) => row.newValue === "Georgia")).toBe(true);
  });

  it("a job_user_visibility pin makes the job visible outside the user's region", async () => {
    const allUsers = await db.select().from(users);
    const corporate = allUsers.find((row) => row.role === "corporate_admin")!;
    const [floridaPcm] = await db
      .insert(users)
      .values({
        name: "Florida Visibility PCM",
        title: "Preconstruction Manager",
        role: "pcm",
        region: "Florida",
        preconDepartment: "Florida",
        email: `florida-vis-${Date.now()}@example.com`,
      })
      .returning();
    createdUserIds.push(floridaPcm.id);

    const [centralJob] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.region, "Central"), isNull(jobs.deletedAt)))
      .limit(1);
    const floridaActor = principalFor(floridaPcm, "Florida");
    expect(await loadJobForPrincipal(floridaActor, centralJob.id)).toBeNull();

    const admin = principalFor(corporate, null);
    const pinned = await visibilityService.addUser(admin, centralJob.id, floridaPcm.id);
    expect(pinned.added).toBe(true);
    extraPinKeys.push({ jobId: centralJob.id, userId: floridaPcm.id });

    expect((await loadJobForPrincipal(floridaActor, centralJob.id))?.value.id).toBe(centralJob.id);
    const listed = await listRoundsWithJobsForPrincipal(floridaActor);
    expect(listed.some((row) => row.job.id === centralJob.id)).toBe(true);
    expect(listed.every((row) => row.job.region === "Central" || row.job.region === "Florida")).toBe(true);

    const pcmCannotPin = await principalFor(
      allUsers.find((row) => row.role === "pcm" && row.region === "Central")!,
      "Central",
    );
    await expect(visibilityService.addUser(pcmCannotPin, centralJob.id, floridaPcm.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("directors cannot add another region's visibility row", async () => {
    const centralPcm = (await db.select().from(users)).find((row) => row.role === "pcm")!;
    const [centralJob] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.region, "Central"), isNull(jobs.deletedAt)))
      .limit(1);
    const actor = principalFor(centralPcm, "Central");
    await expect(visibilityService.addRegion(actor, centralJob.id, "Florida")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(visibilityService.removeRegion(actor, centralJob.id, "Central")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("inserting a job always creates a home visibility row (zero-visibility is impossible)", async () => {
    const [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `VIS-ZERO-${Date.now()}`,
        jobName: "Zero visibility invariant",
        region: "Central",
        preconDepartment: "Central Heavy Civil",
        createdById: pcm.id,
      })
      .returning();
    createdJobIds.push(job.id);
    const vis = await db
      .select()
      .from(jobRegionVisibility)
      .where(eq(jobRegionVisibility.jobId, job.id));
    expect(vis.some((row) => row.region === "Central")).toBe(true);
  });

  it("a job with zero visibility rows is invisible to a regional principal", async () => {
    const [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `VIS-EMPTY-${Date.now()}`,
        jobName: "Stripped visibility",
        region: "Central",
        preconDepartment: "Central Heavy Civil",
        createdById: pcm.id,
      })
      .returning();
    createdJobIds.push(job.id);
    await db.delete(jobRegionVisibility).where(eq(jobRegionVisibility.jobId, job.id));
    const actor = principalFor(pcm, "Central");
    expect(await loadJobForPrincipal(actor, job.id)).toBeNull();
  });
});
