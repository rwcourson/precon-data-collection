import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { db, ensureDbReady } from "@/db";
import {
  approvalRequests,
  auditLog,
  estimateRounds,
  groupEditPolicies,
  jobGroupMemberships,
  jobs,
  notifications,
  organizationGroups,
  statusTransitions,
  users,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { createPrincipal } from "@/lib/authorization/principal";
import { approvalService } from "@/services/approval-service";
import { pursuitService } from "@/services/pursuit-service";

let pcm: typeof users.$inferSelect;
let lead: typeof users.$inferSelect;
let rpd: typeof users.$inferSelect;
let leadership: typeof users.$inferSelect;
let admin: typeof users.$inferSelect;
let corporate: typeof users.$inferSelect;
const createdRequestIds: number[] = [];
const createdJobs: number[] = [];
const createdPolicies: {
  groupId: number;
  role: (typeof users.$inferSelect)["role"];
}[] = [];

beforeAll(async () => {
  await ensureDbReady();
  [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
  [lead] = await db
    .select()
    .from(users)
    .where(eq(users.role, "estimate_lead"))
    .limit(1);
  [rpd] = await db.select().from(users).where(eq(users.role, "rpd")).limit(1);
  [leadership] = await db
    .select()
    .from(users)
    .where(eq(users.role, "leadership"))
    .limit(1);
  [admin] = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin_jsa"))
    .limit(1);
  [corporate] = await db
    .select()
    .from(users)
    .where(eq(users.role, "corporate_admin"))
    .limit(1);
});

afterEach(async () => {
  for (const id of createdRequestIds.splice(0)) {
    await db.delete(approvalRequests).where(eq(approvalRequests.id, id));
  }
  for (const policy of createdPolicies.splice(0)) {
    await db
      .delete(groupEditPolicies)
      .where(
        and(
          eq(groupEditPolicies.groupId, policy.groupId),
          eq(groupEditPolicies.role, policy.role)
        )
      );
  }
  for (const jobId of createdJobs.splice(0)) {
    const rounds = await db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .where(eq(estimateRounds.jobId, jobId));
    for (const round of rounds) {
      await db.delete(auditLog).where(eq(auditLog.roundId, round.id));
      await db.delete(notifications).where(eq(notifications.roundId, round.id));
      await db
        .delete(statusTransitions)
        .where(eq(statusTransitions.roundId, round.id));
    }
    await db
      .delete(jobGroupMemberships)
      .where(eq(jobGroupMemberships.jobId, jobId));
    await db.delete(estimateRounds).where(eq(estimateRounds.jobId, jobId));
    await db.delete(jobs).where(eq(jobs.id, jobId));
  }
});

function principalFor(user: typeof users.$inferSelect) {
  return createPrincipal({
    user,
    authSource: "demo_session",
    workspaceRegion: user.region,
  });
}

const createInput = () => ({
  mode: "manual" as const,
  jobName: `Approval fixture ${Date.now()}`,
  region: pcm.region ?? "Central",
  preconDepartment: pcm.preconDepartment ?? "Central Building Group",
  estimatePhase: "Budget - Quick ROM",
  bidYear: 2026,
  initialStatus: "upcoming" as const,
  confirmDuplicate: true,
});

describe("approval publish boundaries", () => {
  it("keeps PCM creates pending until RPD or corporate admin publishes", async () => {
    expect(await approvalService.writeMode(principalFor(pcm))).toBe("propose");
    expect(await approvalService.writeMode(principalFor(lead))).toBe("direct");
    expect(await approvalService.writeMode(principalFor(admin))).toBe("direct");
    expect(await approvalService.writeMode(principalFor(rpd))).toBe("direct");
    expect(await approvalService.writeMode(principalFor(corporate))).toBe(
      "direct"
    );
    expect(await approvalService.writeMode(principalFor(leadership))).toBe(
      "read"
    );

    const pending = await approvalService.requestCreate(
      principalFor(pcm),
      createInput()
    );
    expect(pending).toMatchObject({ kind: "pending" });
    if (!("requestId" in pending)) throw new Error("expected pending request");
    createdRequestIds.push(pending.requestId);
    const [row] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, pending.requestId));
    expect(row.status).toBe("pending");
    expect(row.publishedJobId).toBeNull();

    await expect(
      approvalService.decide(principalFor(pcm), pending.requestId, "approved")
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      approvalService.decide(
        principalFor(leadership),
        pending.requestId,
        "approved"
      )
    ).rejects.toBeInstanceOf(DomainError);

    const published = await approvalService.decide(
      principalFor(corporate),
      pending.requestId,
      "approved"
    );
    expect(published).toMatchObject({ status: "approved" });
    const [done] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, pending.requestId));
    expect(done.publishedJobId).toBeTruthy();
    if (done.publishedJobId) createdJobs.push(done.publishedJobId);
    const [job] = await db
      .select({ createdById: jobs.createdById })
      .from(jobs)
      .where(eq(jobs.id, done.publishedJobId!));
    expect(job.createdById).toBe(pcm.id);
  });

  it("checks pending create payloads as well as published jobs", async () => {
    const input = {
      ...createInput(),
      jobName: `Pending duplicate ${Date.now()}`,
      confirmDuplicate: true,
    };
    const first = await approvalService.requestCreate(principalFor(pcm), input);
    expect(first).toMatchObject({ kind: "pending" });
    if (!("requestId" in first)) throw new Error("expected pending request");
    createdRequestIds.push(first.requestId);

    const second = await approvalService.requestCreate(principalFor(pcm), {
      ...input,
      confirmDuplicate: false,
    });
    expect(second).toMatchObject({ kind: "duplicates" });
    if (second.kind !== "duplicates") throw new Error("expected duplicates");
    expect(
      second.matches.some((match) => match.jobName === input.jobName)
    ).toBe(true);
  });

  it("honors the most restrictive group edit policy for PCM", async () => {
    const [group] = await db.select().from(organizationGroups).limit(1);
    if (!group) throw new Error("expected seeded organization group");
    const created = await pursuitService.createPursuit(
      principalFor(lead),
      createInput()
    );
    expect(created.kind).toBe("created");
    if (created.kind !== "created") throw new Error("expected created job");
    createdJobs.push(created.jobId);
    await db
      .delete(groupEditPolicies)
      .where(
        and(
          eq(groupEditPolicies.groupId, group.id),
          eq(groupEditPolicies.role, "pcm")
        )
      );
    await db.insert(jobGroupMemberships).values({
      jobId: created.jobId,
      groupId: group.id,
      participationRole: "lead",
      discipline: "preconstruction",
      addedById: corporate.id,
    });
    await db.insert(groupEditPolicies).values({
      groupId: group.id,
      role: "pcm",
      mode: "read",
      updatedById: corporate.id,
    });
    createdPolicies.push({ groupId: group.id, role: "pcm" });
    expect(
      await approvalService.writeMode(principalFor(pcm), created.jobId)
    ).toBe("read");
    await db
      .update(groupEditPolicies)
      .set({ mode: "direct" })
      .where(
        and(
          eq(groupEditPolicies.groupId, group.id),
          eq(groupEditPolicies.role, "pcm")
        )
      );
    expect(
      await approvalService.writeMode(principalFor(pcm), created.jobId)
    ).toBe("direct");
  });

  it("returns a reviewable diff instead of overwriting a stale edit approval", async () => {
    const created = await pursuitService.createPursuit(
      principalFor(lead),
      createInput()
    );
    expect(created.kind).toBe("created");
    if (created.kind !== "created") throw new Error("expected created job");
    createdJobs.push(created.jobId);
    const request = await approvalService.requestEdit(principalFor(pcm), {
      roundId: created.roundId,
      values: { owner: "Proposed Owner" },
      multiValues: {},
      customValues: {},
      expectedUpdatedAt: new Date("2000-01-01T00:00:00Z"),
    });
    createdRequestIds.push(request.id);
    await pursuitService.savePostBidData(principalFor(lead), {
      roundId: created.roundId,
      values: { owner: "Current Owner" },
      multiValues: {},
      customValues: {},
    });
    const decided = await approvalService.decide(
      principalFor(rpd),
      request.id,
      "approved"
    );
    expect(decided).toMatchObject({ status: "conflict" });
    if (decided.status !== "conflict") throw new Error("expected conflict");
    expect(decided.diff.some((item) => item.field === "owner")).toBe(true);
  });
});
