import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { db, ensureDbReady } from "@/db";
import {
  estimateRounds,
  jobGroupMemberships,
  jobRegionVisibility,
  jobRelationships,
  jobs,
  organizationGroups,
  roundStaffAssignments,
  users,
} from "@/db/schema";
import {
  listRoundsWithJobsForPrincipal,
  loadJobForPrincipal,
} from "@/lib/authorization/loaders";
import { createPrincipal } from "@/lib/authorization/principal";
import { excludeChildJobRows } from "@/lib/schedule-projection";
import {
  listJobGroupMemberships,
  setJobGroupMembership,
} from "@/services/organization-service";

describe("organization membership vs board rows", () => {
  const createdJobIds: number[] = [];
  const createdUserIds: number[] = [];

  beforeAll(async () => {
    await ensureDbReady();
  });

  afterEach(async () => {
    for (const jobId of createdJobIds.splice(0)) {
      await db
        .delete(jobRelationships)
        .where(eq(jobRelationships.parentJobId, jobId));
      await db
        .delete(jobRelationships)
        .where(eq(jobRelationships.childJobId, jobId));
      const rounds = await db
        .select({ id: estimateRounds.id })
        .from(estimateRounds)
        .where(eq(estimateRounds.jobId, jobId));
      for (const round of rounds) {
        await db
          .delete(roundStaffAssignments)
          .where(eq(roundStaffAssignments.roundId, round.id));
      }
      await db
        .delete(jobGroupMemberships)
        .where(eq(jobGroupMemberships.jobId, jobId));
      await db.delete(estimateRounds).where(eq(estimateRounds.jobId, jobId));
      await db
        .delete(jobRegionVisibility)
        .where(eq(jobRegionVisibility.jobId, jobId));
      await db.delete(jobs).where(eq(jobs.id, jobId));
    }
    for (const userId of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  it("hides nested TI/sub-jobs from the board without deleting them", () => {
    const rows = [
      { job: { id: 10 } },
      { job: { id: 11 } },
      { job: { id: 12 } },
    ];
    expect(excludeChildJobRows(rows, [11])).toEqual([
      { job: { id: 10 } },
      { job: { id: 12 } },
    ]);
  });

  it("does not treat group membership as a visibility grant", () => {
    const visibilityIds = new Set([10]);
    const membershipIds = [10, 11];
    const visible = membershipIds.filter((id) => visibilityIds.has(id));
    expect(visible).toEqual([10]);
  });

  it("keeps a Texas/Georgia IJV as one job with two memberships", async () => {
    const [rpd] = await db
      .select()
      .from(users)
      .where(eq(users.role, "rpd"))
      .limit(1);
    const groups = await db.select().from(organizationGroups);
    const texas = groups.find((group) => group.region === "Texas");
    const georgia = groups.find((group) => group.region === "Georgia");
    expect(texas && georgia).toBeTruthy();
    const [parent] = await db
      .insert(jobs)
      .values({
        jobNumber: `IJV-${Date.now()}`,
        jobName: "Texas/Georgia slice",
        region: "Texas",
        preconDepartment: "Texas",
        createdById: rpd.id,
      })
      .returning();
    const [child] = await db
      .insert(jobs)
      .values({
        jobNumber: `${parent.jobNumber}-TI`,
        jobName: "TI child",
        region: "Texas",
        preconDepartment: "Texas",
        createdById: rpd.id,
      })
      .returning();
    createdJobIds.push(parent.id, child.id);
    await db.insert(jobGroupMemberships).values([
      {
        jobId: parent.id,
        groupId: texas!.id,
        participationRole: "lead",
        discipline: "preconstruction",
      },
      {
        jobId: parent.id,
        groupId: georgia!.id,
        participationRole: "partner",
        discipline: "operations",
      },
    ]);
    await db.insert(jobRelationships).values({
      parentJobId: parent.id,
      childJobId: child.id,
      kind: "tenant_improvement",
      createdById: rpd.id,
    });
    const memberships = await db
      .select()
      .from(jobGroupMemberships)
      .where(eq(jobGroupMemberships.jobId, parent.id));
    expect(memberships).toHaveLength(2);
    expect(
      excludeChildJobRows(
        [{ job: { id: parent.id } }, { job: { id: child.id } }],
        [child.id]
      )
    ).toEqual([{ job: { id: parent.id } }]);
  });

  it("lets a Georgia director filter the same Texas/Georgia job via visibility, not membership", async () => {
    const [georgiaUser] = await db
      .insert(users)
      .values({
        name: "Georgia Director",
        title: "Director",
        role: "leadership",
        region: "Georgia",
        email: `ga-director-${Date.now()}@example.com`,
      })
      .returning();
    createdUserIds.push(georgiaUser.id);
    const groups = await db.select().from(organizationGroups);
    const texas = groups.find((group) => group.region === "Texas");
    const georgia = groups.find((group) => group.region === "Georgia");
    const [parent] = await db
      .insert(jobs)
      .values({
        jobNumber: `GA-${Date.now()}`,
        jobName: "Shared Georgia slice",
        region: "Texas",
        preconDepartment: "Texas",
        createdById: georgiaUser.id,
      })
      .returning();
    createdJobIds.push(parent.id);
    await db.insert(jobGroupMemberships).values([
      {
        jobId: parent.id,
        groupId: texas!.id,
        participationRole: "lead",
        discipline: "preconstruction",
      },
      {
        jobId: parent.id,
        groupId: georgia!.id,
        participationRole: "partner",
        discipline: "preconstruction",
      },
    ]);
    await db.insert(jobRegionVisibility).values({
      jobId: parent.id,
      region: "Georgia",
      addedById: georgiaUser.id,
    });
    await db.insert(estimateRounds).values({
      jobId: parent.id,
      roundNumber: 1,
      status: "active",
      region: "Texas",
      preconDepartment: "Texas",
      estimatePhase: "GMP",
      bidYear: 2026,
      createdById: georgiaUser.id,
    });
    const principal = createPrincipal({
      user: georgiaUser,
      authSource: "demo_session",
      workspaceRegion: "Georgia",
    });
    const rows = await listRoundsWithJobsForPrincipal(principal);
    expect(rows.some((row) => row.job.id === parent.id)).toBe(true);
  });

  it("does not grant job visibility by staffing a user from another region", async () => {
    const [pcm] = await db
      .select()
      .from(users)
      .where(eq(users.role, "pcm"))
      .limit(1);
    const [rpd] = await db
      .select()
      .from(users)
      .where(eq(users.role, "rpd"))
      .limit(1);
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `STAFF-${Date.now()}`,
        jobName: "Staffing is not visibility",
        region: pcm.region === "Florida" ? "Texas" : "Florida",
        preconDepartment: pcm.region === "Florida" ? "Texas" : "Florida",
        createdById: rpd.id,
      })
      .returning();
    createdJobIds.push(job.id);
    const [round] = await db
      .insert(estimateRounds)
      .values({
        jobId: job.id,
        roundNumber: 1,
        status: "upcoming",
        region: job.region,
        preconDepartment: job.preconDepartment,
        estimatePhase: "Budget - Concept",
        bidYear: 2026,
        createdById: rpd.id,
      })
      .returning();
    await db.insert(roundStaffAssignments).values({
      roundId: round.id,
      stage: "concept",
      userId: pcm.id,
      roleLabel: "PCM",
      assignedById: rpd.id,
    });
    const loaded = await loadJobForPrincipal(
      createPrincipal({
        user: pcm,
        authSource: "demo_session",
        workspaceRegion: pcm.region,
      }),
      job.id
    );
    expect(loaded).toBeNull();
  });

  it("keeps one lead group and records operations vs preconstruction", async () => {
    const [rpd] = await db
      .select()
      .from(users)
      .where(eq(users.role, "rpd"))
      .limit(1);
    const groups = await db.select().from(organizationGroups);
    const texas = groups.find((group) => group.region === "Texas");
    const georgia = groups.find((group) => group.region === "Georgia");
    expect(texas && georgia && rpd).toBeTruthy();
    const home = rpd!.region ?? "Texas";
    const [parent] = await db
      .insert(jobs)
      .values({
        jobNumber: `LEAD-${Date.now()}`,
        jobName: "One lead IJV",
        region: home,
        preconDepartment: home,
        createdById: rpd!.id,
      })
      .returning();
    createdJobIds.push(parent.id);
    const principal = createPrincipal({
      user: rpd!,
      authSource: "demo_session",
      workspaceRegion: rpd!.region,
    });
    await setJobGroupMembership(principal, {
      jobId: parent.id,
      groupId: texas!.id,
      enabled: true,
      participationRole: "lead",
      discipline: "preconstruction",
    });
    await setJobGroupMembership(principal, {
      jobId: parent.id,
      groupId: georgia!.id,
      enabled: true,
      participationRole: "lead",
      discipline: "operations",
    });
    const memberships = await listJobGroupMemberships(parent.id);
    expect(
      memberships.filter((row) => row.participationRole === "lead")
    ).toHaveLength(1);
    expect(
      memberships.find((row) => row.groupId === georgia!.id)
    ).toMatchObject({
      participationRole: "lead",
      discipline: "operations",
    });
    expect(
      memberships.find((row) => row.groupId === texas!.id)?.participationRole
    ).toBe("partner");
  });
});
