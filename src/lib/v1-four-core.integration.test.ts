import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, ensureDbReady } from "@/db";
import { auditLog, estimateRounds, jobs, notifications, statusTransitions, users } from "@/db/schema";
import { createPrincipal } from "@/lib/authorization/principal";
import { allowedTransitions } from "@/lib/permissions";
import { pursuitService } from "@/services/pursuit-service";

let pcm: typeof users.$inferSelect;
let rpd: typeof users.$inferSelect;
const created: { jobId: number; roundIds: number[] }[] = [];

beforeAll(async () => {
  await ensureDbReady();
  [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
  [rpd] = await db.select().from(users).where(eq(users.role, "rpd")).limit(1);
  if (!pcm?.region || !rpd) throw new Error("seed roles missing");
});

afterEach(async () => {
  for (const row of created.splice(0)) {
    for (const id of row.roundIds) {
      await db.delete(auditLog).where(eq(auditLog.roundId, id));
      await db.delete(notifications).where(eq(notifications.roundId, id));
      await db.delete(statusTransitions).where(eq(statusTransitions.roundId, id));
      await db.delete(estimateRounds).where(eq(estimateRounds.id, id));
    }
    await db.delete(jobs).where(eq(jobs.id, row.jobId));
  }
});

describe("V1 four-core loop", () => {
  it("allows pre-bid bucket moves and submit from an estimate lead / RPD", () => {
    expect(allowedTransitions(pcm, { status: "upcoming" }).sort()).toEqual(
      ["active", "outstanding"].sort(),
    );
    expect(allowedTransitions(rpd, { status: "active" })).toEqual(
      expect.arrayContaining(["upcoming", "outstanding", "submitted"]),
    );
    expect(allowedTransitions(rpd, { status: "submitted" })).toContain("post_bid");
  });

  it("adds a second estimate round on the same job", async () => {
    const principal = createPrincipal({
      user: rpd,
      authSource: "demo_session",
      workspaceRegion: rpd.region,
    });
    const createdJob = await pursuitService.createPursuit(principal, {
      mode: "manual",
      jobName: "V1 two-round ROM",
      region: rpd.region ?? "Central",
      preconDepartment: rpd.preconDepartment ?? "Central Building Group",
      estimatePhase: "Budget - Quick ROM",
      bidYear: 2026,
      initialStatus: "upcoming",
    });
    created.push({ jobId: createdJob.jobId, roundIds: [createdJob.roundId] });

    const [jobRow] = await db.select().from(jobs).where(eq(jobs.id, createdJob.jobId));
    expect(jobRow.isLinked).toBe(false);
    expect(jobRow.jobNumber.startsWith("TBD-")).toBe(true);

    const second = await pursuitService.addEstimateRound(principal, {
      jobId: createdJob.jobId,
      estimatePhase: "GMP",
      bidYear: 2026,
      initialStatus: "active",
    });
    created[0].roundIds.push(second.roundId);

    const rounds = await db
      .select()
      .from(estimateRounds)
      .where(eq(estimateRounds.jobId, createdJob.jobId));
    expect(rounds).toHaveLength(2);
    expect(rounds.map((r) => r.estimatePhase).sort()).toEqual(["Budget - Quick ROM", "GMP"].sort());
    expect(new Set(rounds.map((r) => r.jobId)).size).toBe(1);
  });

  it("blocks RPD lock when required fields are blank and names those labels", async () => {
    const principal = createPrincipal({
      user: rpd,
      authSource: "demo_session",
      workspaceRegion: rpd.region,
    });
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `V1-${Date.now()}`,
        jobName: "Incomplete lock subject",
        region: rpd.region ?? "Central",
        preconDepartment: "Central Building Group",
        createdById: rpd.id,
      })
      .returning();
    const [round] = await db
      .insert(estimateRounds)
      .values({
        jobId: job.id,
        roundNumber: 1,
        status: "post_bid",
        region: rpd.region ?? "Central",
        preconDepartment: "Central Building Group",
        estimatePhase: "GMP",
        bidYear: 2026,
        createdById: rpd.id,
      })
      .returning();
    created.push({ jobId: job.id, roundIds: [round.id] });

    const result = await pursuitService.approveAndLock(principal, round.id);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingFields.length).toBeGreaterThan(0);
      expect(result.error).toMatch(/Cannot lock/);
      expect(result.missingFields).toContain("Fee – Expected $");
    }
  });

  it("persists a post-lock outcome change", async () => {
    const principal = createPrincipal({
      user: rpd,
      authSource: "demo_session",
      workspaceRegion: rpd.region,
    });
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `V1O-${Date.now()}`,
        jobName: "Outcome subject",
        region: rpd.region ?? "Central",
        preconDepartment: "Central Building Group",
        createdById: rpd.id,
      })
      .returning();
    const [round] = await db
      .insert(estimateRounds)
      .values({
        jobId: job.id,
        roundNumber: 1,
        status: "locked",
        outcome: "pending",
        region: rpd.region ?? "Central",
        preconDepartment: "Central Building Group",
        estimatePhase: "GMP",
        bidYear: 2026,
        createdById: rpd.id,
      })
      .returning();
    created.push({ jobId: job.id, roundIds: [round.id] });

    const updated = await pursuitService.setOutcome(principal, round.id, "successful");
    expect(updated.outcome).toBe("successful");
    const [row] = await db.select().from(estimateRounds).where(eq(estimateRounds.id, round.id));
    expect(row.outcome).toBe("successful");
    const audits = await db.select().from(auditLog).where(eq(auditLog.roundId, round.id));
    expect(audits.some((a) => a.field === "outcome" && a.newValue === "successful")).toBe(true);
  });
});
