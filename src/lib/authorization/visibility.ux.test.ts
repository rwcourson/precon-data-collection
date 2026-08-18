import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, estimateRounds, jobRegionVisibility, jobs, statusTransitions, users } from "@/db/schema";
import { createPrincipal } from "@/lib/authorization/principal";
import { resolveCreatorHomeRegion } from "@/lib/home-region";
import {
  listRoundsWithJobsForPrincipal,
  loadJobForPrincipal,
} from "@/lib/authorization/loaders";
import { pursuitService, requireCreatedPursuit } from "@/services/pursuit-service";
import { visibilityService } from "@/services/visibility-service";
import type { User } from "@/db/schema";

function principalFor(user: User, workspaceRegion: string | null) {
  return createPrincipal({ user, authSource: "sso", workspaceRegion });
}

describe("visibility UX + duplicate guard", () => {
  const createdUserIds: number[] = [];
  const createdJobIds: number[] = [];

  afterAll(async () => {
    if (createdJobIds.length > 0) {
      const rounds = await db
        .select({ id: estimateRounds.id })
        .from(estimateRounds)
        .where(inArray(estimateRounds.jobId, createdJobIds));
      const roundIds = rounds.map((row) => row.id);
      if (roundIds.length > 0) {
        await db.delete(auditLog).where(inArray(auditLog.roundId, roundIds));
        await db.delete(statusTransitions).where(inArray(statusTransitions.roundId, roundIds));
        await db.delete(estimateRounds).where(inArray(estimateRounds.id, roundIds));
      }
      await db.delete(auditLog).where(inArray(auditLog.entityId, createdJobIds));
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(auditLog).where(inArray(auditLog.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  it("uses the creator workspace as home region, not the requested Salesforce office", () => {
    const georgia: User = {
      id: 1,
      name: "Georgia PCM",
      title: "PCM",
      role: "pcm",
      region: "Georgia",
      preconDepartment: "Georgia – Commercial",
      email: "g@example.com",
    };
    const actor = principalFor(georgia, "Georgia");
    expect(resolveCreatorHomeRegion(actor, "Florida")).toBe("Georgia");
  });

  it("lets a director add only their own region and denies others", async () => {
    const centralPcm = (await db.select().from(users)).find((row) => row.role === "pcm")!;
    const [georgiaPcm] = await db
      .insert(users)
      .values({
        name: "Georgia UX PCM",
        title: "Preconstruction Manager",
        role: "pcm",
        region: "Georgia",
        preconDepartment: "Georgia – Commercial",
        email: `georgia-ux-${Date.now()}@example.com`,
      })
      .returning();
    createdUserIds.push(georgiaPcm.id);
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.region, "Central"), isNull(jobs.deletedAt)))
      .limit(1);
    const georgia = principalFor(georgiaPcm, "Georgia");
    const central = principalFor(centralPcm, "Central");
    await expect(visibilityService.addRegion(central, job.id, "Florida")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const added = await visibilityService.addRegion(georgia, job.id, "Georgia");
    expect(added.added).toBe(true);
    await visibilityService.removeRegion(georgia, job.id, "Georgia");
  });

  it("lets corporate_admin add any region and pin a user who then sees the job", async () => {
    const allUsers = await db.select().from(users);
    const corporate = allUsers.find((row) => row.role === "corporate_admin")!;
    const [floridaPcm] = await db
      .insert(users)
      .values({
        name: "Florida UX PCM",
        title: "Preconstruction Manager",
        role: "pcm",
        region: "Florida",
        preconDepartment: "Florida",
        email: `florida-ux-${Date.now()}@example.com`,
      })
      .returning();
    createdUserIds.push(floridaPcm.id);
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.region, "Central"), isNull(jobs.deletedAt)))
      .limit(1);
    const admin = principalFor(corporate, null);
    const florida = principalFor(floridaPcm, "Florida");
    expect(await loadJobForPrincipal(florida, job.id)).toBeNull();
    expect((await visibilityService.addRegion(admin, job.id, "Texas")).added).toBe(true);
    expect((await visibilityService.addUser(admin, job.id, floridaPcm.id)).added).toBe(true);
    expect((await loadJobForPrincipal(florida, job.id))?.value.id).toBe(job.id);
    expect((await listRoundsWithJobsForPrincipal(florida)).some((row) => row.job.id === job.id)).toBe(
      true,
    );
    await visibilityService.removeUser(admin, job.id, floridaPcm.id);
    await visibilityService.removeRegion(admin, job.id, "Texas");
  });

  it("warns on a near-duplicate Auburn name and adopt adds visibility without a new job", async () => {
    const [floridaPcm] = await db
      .insert(users)
      .values({
        name: "Florida Auburn PCM",
        title: "Preconstruction Manager",
        role: "pcm",
        region: "Florida",
        preconDepartment: "Florida",
        email: `florida-auburn-${Date.now()}@example.com`,
      })
      .returning();
    const [georgiaPcm] = await db
      .insert(users)
      .values({
        name: "Georgia Auburn PCM",
        title: "Preconstruction Manager",
        role: "pcm",
        region: "Georgia",
        preconDepartment: "Georgia – Commercial",
        email: `georgia-auburn-${Date.now()}@example.com`,
      })
      .returning();
    createdUserIds.push(floridaPcm.id, georgiaPcm.id);

    const florida = principalFor(floridaPcm, "Florida");
    const existing = requireCreatedPursuit(
      await pursuitService.createPursuit(florida, {
        mode: "manual",
        jobName: "Auburn Football Perf. Ctr",
        region: "Florida",
        preconDepartment: "Florida",
        estimatePhase: "Budget – Concept",
        bidYear: 2026,
        city: "Auburn",
        state: "AL",
        initialStatus: "upcoming",
        confirmDuplicate: true,
      }),
    );
    createdJobIds.push(existing.jobId);

    const georgia = principalFor(georgiaPcm, "Georgia");
    const before = (await db.select({ id: jobs.id }).from(jobs)).length;
    const warning = await pursuitService.createPursuit(georgia, {
      mode: "manual",
      jobName: "Auburn Football Performance Center",
      region: "Florida",
      preconDepartment: "Georgia – Commercial",
      estimatePhase: "Budget – Concept",
      bidYear: 2026,
      city: "Auburn",
      state: "AL",
      initialStatus: "upcoming",
    });
    expect(warning.kind).toBe("duplicates");
    if (warning.kind !== "duplicates") return;
    expect(warning.matches.some((row) => row.jobId === existing.jobId)).toBe(true);
    expect(warning.matches[0]?.homeRegion).toBe("Florida");

    const adopted = await visibilityService.addRegion(georgia, existing.jobId, "Georgia");
    expect(adopted.added).toBe(true);
    const after = (await db.select({ id: jobs.id }).from(jobs)).length;
    expect(after).toBe(before);
    expect((await loadJobForPrincipal(georgia, existing.jobId))?.value.id).toBe(existing.jobId);
  });

  it("creates a Georgia home + visibility row even when the requested region is a Salesforce office", async () => {
    const [georgiaPcm] = await db
      .insert(users)
      .values({
        name: "Georgia Create PCM",
        title: "Preconstruction Manager",
        role: "pcm",
        region: "Georgia",
        preconDepartment: "Georgia – Commercial",
        email: `georgia-create-${Date.now()}@example.com`,
      })
      .returning();
    createdUserIds.push(georgiaPcm.id);
    const georgia = principalFor(georgiaPcm, "Georgia");
    const created = requireCreatedPursuit(
      await pursuitService.createPursuit(georgia, {
        mode: "manual",
        jobName: `Georgia home ${Date.now()}`,
        region: "Florida",
        preconDepartment: "Georgia – Commercial",
        estimatePhase: "Budget – Concept",
        bidYear: 2026,
        initialStatus: "upcoming",
        confirmDuplicate: true,
      }),
    );
    createdJobIds.push(created.jobId);
    const [job] = await db.select().from(jobs).where(eq(jobs.id, created.jobId));
    expect(job.region).toBe("Georgia");
    const vis = await db
      .select()
      .from(jobRegionVisibility)
      .where(eq(jobRegionVisibility.jobId, created.jobId));
    expect(vis.map((row) => row.region)).toEqual(["Georgia"]);
    expect(vis.some((row) => row.region === "Florida")).toBe(false);
  });
});
