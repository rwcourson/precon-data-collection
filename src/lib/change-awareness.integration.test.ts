import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { db, ensureDbReady } from "@/db";
import {
  auditLog,
  emailOutbox,
  estimateRounds,
  jobs,
  notifications,
  productEvents,
  userRoundWatermarks,
  users,
} from "@/db/schema";
import { createPrincipal } from "@/lib/authorization/principal";
import {
  acknowledgeRoundChanges,
  loadRoundChanges,
} from "@/services/change-awareness-service";
import { pursuitService } from "@/services/pursuit-service";

describe("two-user change watermarks", () => {
  const createdAuditIds: number[] = [];
  let roundId = 0;

  beforeAll(async () => {
    await ensureDbReady();
  });

  afterEach(async () => {
    if (roundId) {
      await db
        .delete(userRoundWatermarks)
        .where(eq(userRoundWatermarks.roundId, roundId));
    }
    for (const id of createdAuditIds.splice(0)) {
      await db.delete(auditLog).where(eq(auditLog.id, id));
    }
  });

  it("keeps PCM and RPD acknowledgements independent", async () => {
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
    const [round] = await db
      .select({ id: estimateRounds.id })
      .from(estimateRounds)
      .where(eq(estimateRounds.region, pcm.region ?? "Central"))
      .limit(1);
    roundId = round.id;
    const [pcmEdit] = await db
      .insert(auditLog)
      .values({
        entity: "round",
        entityId: round.id,
        roundId: round.id,
        action: "field_changed",
        field: "bidDueDate",
        oldValue: "2026-08-01",
        newValue: "2026-08-15",
        userId: pcm.id,
      })
      .returning({ id: auditLog.id });
    const [rpdEdit] = await db
      .insert(auditLog)
      .values({
        entity: "round",
        entityId: round.id,
        roundId: round.id,
        action: "field_changed",
        field: "drawingsDueDate",
        oldValue: "2026-07-01",
        newValue: "2026-07-20",
        userId: rpd.id,
      })
      .returning({ id: auditLog.id });
    createdAuditIds.push(pcmEdit.id, rpdEdit.id);

    const pcmPrincipal = createPrincipal({
      user: pcm,
      authSource: "demo_session",
      workspaceRegion: pcm.region,
    });
    const rpdPrincipal = createPrincipal({
      user: rpd,
      authSource: "demo_session",
      workspaceRegion: rpd.region,
    });
    const before = await loadRoundChanges(pcmPrincipal, [round.id]);
    expect(before.get(round.id)?.fields).toContain("drawingsDueDate");
    await acknowledgeRoundChanges(pcmPrincipal, round.id, rpdEdit.id);
    const afterPcm = await loadRoundChanges(pcmPrincipal, [round.id]);
    const afterRpd = await loadRoundChanges(rpdPrincipal, [round.id]);
    expect(afterPcm.get(round.id)?.count ?? 0).toBe(0);
    expect(afterRpd.get(round.id)?.fields).toContain("bidDueDate");
  });
});

describe("date-shift notifications", () => {
  const createdRoundIds: number[] = [];

  afterEach(async () => {
    for (const roundId of createdRoundIds.splice(0)) {
      await db.delete(notifications).where(eq(notifications.roundId, roundId));
      await db.delete(emailOutbox).where(eq(emailOutbox.roundId, roundId));
      await db.delete(auditLog).where(eq(auditLog.roundId, roundId));
      const [round] = await db
        .select({ jobId: estimateRounds.jobId })
        .from(estimateRounds)
        .where(eq(estimateRounds.id, roundId));
      await db.delete(estimateRounds).where(eq(estimateRounds.id, roundId));
      if (round) await db.delete(jobs).where(eq(jobs.id, round.jobId));
    }
  });

  it("notifies interview and start-month shifts once per exact change", async () => {
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
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `DATE-${Date.now()}`,
        jobName: "Date-shift fixture",
        region: pcm.region ?? "Central",
        preconDepartment: "Central Building Group",
        createdById: pcm.id,
      })
      .returning();
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
        interviewDate: "2026-08-01",
        projectStartMonth: "2026-10",
        estimateLeadId: lead.id,
        createdById: pcm.id,
      })
      .returning();
    createdRoundIds.push(round.id);

    const actor = createPrincipal({
      user: pcm,
      authSource: "demo_session",
      workspaceRegion: pcm.region,
    });
    await pursuitService.savePostBidData(actor, {
      roundId: round.id,
      values: {
        interviewDate: "2026-08-20",
        projectStartMonth: "2026-12",
      },
      multiValues: {},
      customValues: {},
    });
    const first = await db
      .select()
      .from(notifications)
      .where(eq(notifications.roundId, round.id));
    const dateShift = first.filter((row) => row.kind === "date_shift");
    expect(dateShift.some((row) => /Interview/.test(row.title))).toBe(true);
    expect(
      dateShift.some((row) => /Start month|Project Start/i.test(row.title))
    ).toBe(true);
    const count = dateShift.length;
    await pursuitService.savePostBidData(actor, {
      roundId: round.id,
      values: {
        interviewDate: "2026-08-20",
        projectStartMonth: "2026-12",
      },
      multiValues: {},
      customValues: {},
    });
    const second = await db
      .select()
      .from(notifications)
      .where(eq(notifications.roundId, round.id));
    expect(second.filter((row) => row.kind === "date_shift")).toHaveLength(
      count
    );
    const events = await db
      .select({
        event: productEvents.event,
        properties: productEvents.properties,
      })
      .from(productEvents)
      .where(eq(productEvents.userId, pcm.id));
    const forRound = events.filter(
      (row) =>
        (row.properties as { roundId?: number } | null)?.roundId === round.id
    );
    expect(forRound.map((row) => row.event)).toEqual(
      expect.arrayContaining(["date.changed", "resource.bar.future"])
    );
    expect(
      forRound.find((row) => row.event === "resource.bar.future")?.properties
    ).toMatchObject({ autoSlidePeople: false });
  });

  it("groups Destini/source-driven date shifts into one review event", async () => {
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
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `IMP-${Date.now()}`,
        jobName: "Import date-shift fixture",
        region: pcm.region ?? "Central",
        preconDepartment: "Central Building Group",
        createdById: pcm.id,
      })
      .returning();
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
        interviewDate: "2026-08-01",
        projectStartMonth: "2026-10",
        estimateLeadId: lead.id,
        createdById: pcm.id,
      })
      .returning();
    createdRoundIds.push(round.id);

    const actor = createPrincipal({
      user: pcm,
      authSource: "demo_session",
      workspaceRegion: pcm.region,
    });
    await pursuitService.savePostBidData(actor, {
      roundId: round.id,
      values: {
        interviewDate: "2026-08-20",
        projectStartMonth: "2026-12",
      },
      multiValues: {},
      customValues: {},
      sourceBatch: "destini:checksum-fixture",
    });
    const grouped = (
      await db
        .select()
        .from(notifications)
        .where(eq(notifications.roundId, round.id))
    ).filter((row) => row.kind === "date_shift");
    expect(grouped.length).toBeGreaterThan(0);
    expect(new Set(grouped.map((row) => row.title)).size).toBe(1);
    expect(grouped[0]?.title).toMatch(/Imported schedule dates/);
    expect(
      grouped.every(
        (row) =>
          row.idempotencyKey === `${round.id}:import:destini:checksum-fixture`
      )
    ).toBe(true);
  });
});
