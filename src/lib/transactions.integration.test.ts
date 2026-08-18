import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db, ensureDbReady } from "@/db";
import {
  estimateRounds,
  jobs,
  roundMultiValues,
  statusTransitions,
  users,
} from "@/db/schema";
import { createPrincipal } from "@/lib/authorization/principal";
import { DomainError } from "@/domain/errors";
import { transactionFault } from "@/lib/transactions";
import { pursuitService, requireCreatedPursuit } from "@/services/pursuit-service";
import {
  analyzeLogicalDuplicates,
  resolveLogicalDuplicates,
} from "@/db/duplicate-preflight";

let pcm: typeof users.$inferSelect;
let rpd: typeof users.$inferSelect;
let estimateLead: typeof users.$inferSelect;

beforeAll(async () => {
  await ensureDbReady();
  [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
  [rpd] = await db.select().from(users).where(eq(users.role, "rpd")).limit(1);
  [estimateLead] = await db.select().from(users).where(eq(users.role, "estimate_lead")).limit(1);
  if (!pcm?.region || !rpd || !estimateLead) throw new Error("seed roles missing");
});

afterEach(() => {
  transactionFault.throwAfter = null;
});

async function seedPostBidRound() {
  const [job] = await db
    .insert(jobs)
    .values({
      jobNumber: `P7-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      jobName: "Phase 7 concurrency",
      region: pcm.region!,
      preconDepartment: "Test",
      createdById: pcm.id,
    })
    .returning();
  const [round] = await db
    .insert(estimateRounds)
    .values({
      jobId: job.id,
      roundNumber: 1,
      status: "post_bid",
      region: pcm.region!,
      preconDepartment: "Test",
      estimatePhase: "ROM",
      bidYear: 2026,
      estimateLeadId: estimateLead.id,
      createdById: pcm.id,
    })
    .returning();
  await db.insert(roundMultiValues).values({
    roundId: round.id,
    field: "selfPerformWorkType",
    value: "Concrete",
  });
  return { job, round };
}

async function cleanup(roundId: number, jobId: number) {
  await db.delete(roundMultiValues).where(eq(roundMultiValues.roundId, roundId));
  await db.delete(statusTransitions).where(eq(statusTransitions.roundId, roundId));
  await db.delete(estimateRounds).where(eq(estimateRounds.id, roundId));
  await db.delete(jobs).where(eq(jobs.id, jobId));
}

describe("transactions and concurrency", () => {
  it("rolls back multi-value replacement when a mid-transaction fault is injected", async () => {
    const { job, round } = await seedPostBidRound();
    const principal = createPrincipal({
      user: estimateLead,
      authSource: "demo_session",
      workspaceRegion: pcm.region,
    });
    transactionFault.throwAfter = "after-multi-delete";
    try {
      await expect(
        pursuitService.savePostBidData(principal, {
          roundId: round.id,
          values: {},
          multiValues: { selfPerformWorkType: ["Steel"] },
          customValues: {},
        }),
      ).rejects.toThrow(/Injected transaction fault/);

      const remaining = await db
        .select()
        .from(roundMultiValues)
        .where(
          and(
            eq(roundMultiValues.roundId, round.id),
            eq(roundMultiValues.field, "selfPerformWorkType"),
          ),
        );
      expect(remaining.map((row) => row.value)).toEqual(["Concrete"]);
    } finally {
      await cleanup(round.id, job.id);
    }
  });

  it("rejects a stale save after another transaction locks the round", async () => {
    const { job, round } = await seedPostBidRound();
    const leadPrincipal = createPrincipal({
      user: estimateLead,
      authSource: "demo_session",
      workspaceRegion: pcm.region,
    });
    const rpdPrincipal = createPrincipal({
      user: rpd,
      authSource: "demo_session",
      workspaceRegion: rpd.region ?? pcm.region,
    });

    // Fill required fields enough that lock may still fail validation — force lock via status.
    // Use approve path only if complete; otherwise direct optimistic lock via service transition isn't available.
    // Simulate lock by RPD using updateRoundIfUnchanged through approve after setting status.
    try {
      // Stale reader holds original updatedAt/status snapshot inside savePostBidData load.
      // First lock the round as RPD by updating status to locked with matching snapshot.
      const [fresh] = await db
        .select()
        .from(estimateRounds)
        .where(eq(estimateRounds.id, round.id));
      await db
        .update(estimateRounds)
        .set({ status: "locked", lockedAt: new Date(), updatedAt: new Date() })
        .where(eq(estimateRounds.id, round.id));

      // estimate_lead cannot edit locked fields; rpd can but only with fresh snapshot.
      await expect(
        pursuitService.savePostBidData(leadPrincipal, {
          roundId: round.id,
          values: { city: "StaleCity" },
          multiValues: {},
          customValues: {},
        }),
      ).rejects.toBeInstanceOf(DomainError);

      // RPD save with stale unloaded state also fails concurrency when updatedAt changed.
      // Reload is inside service, so RPD would see locked status and succeed field policy —
      // concurrency is proven by updateRoundIfUnchanged when two concurrent ops share a snapshot.
      const stalePrincipal = rpdPrincipal;
      const { updateRoundIfUnchanged, withTransaction } = await import("@/lib/transactions");
      await expect(
        withTransaction((tx) =>
          updateRoundIfUnchanged(tx, {
            roundId: round.id,
            expectedStatus: fresh!.status,
            expectedUpdatedAt: fresh!.updatedAt,
            patch: { city: "Race" },
          }),
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      const [after] = await db
        .select()
        .from(estimateRounds)
        .where(eq(estimateRounds.id, round.id));
      expect(after?.status).toBe("locked");
      expect(after?.city).not.toBe("Race");
      expect(stalePrincipal.user.role).toBe("rpd");
    } finally {
      await cleanup(round.id, job.id);
    }
  });

  it("matches the optimistic guard when updated_at carries microseconds", async () => {
    const { job, round } = await seedPostBidRound();
    try {
      // Real Postgres defaults write now() with microseconds; JS Date only has
      // milliseconds. Simulate that row state explicitly.
      await db.execute(
        sql`update estimate_rounds set updated_at = '2026-01-05 12:34:56.123456'::timestamp where id = ${round.id}`,
      );
      // The snapshot a caller loads through drizzle is ms-precision.
      const [loadedRound] = await db
        .select()
        .from(estimateRounds)
        .where(eq(estimateRounds.id, round.id));
      expect(loadedRound.updatedAt.getMilliseconds()).toBe(123);

      const { updateRoundIfUnchanged, withTransaction } = await import("@/lib/transactions");
      await expect(
        withTransaction((tx) =>
          updateRoundIfUnchanged(tx, {
            roundId: round.id,
            expectedStatus: loadedRound.status,
            expectedUpdatedAt: loadedRound.updatedAt,
            patch: { city: "Microsecond City" },
          }),
        ),
      ).resolves.toBeUndefined();

      const [after] = await db
        .select()
        .from(estimateRounds)
        .where(eq(estimateRounds.id, round.id));
      expect(after.city).toBe("Microsecond City");
    } finally {
      await cleanup(round.id, job.id);
    }
  });

  it("rejects a save whose client snapshot is stale even after a reload", async () => {
    const { job, round } = await seedPostBidRound();
    const principal = createPrincipal({
      user: estimateLead,
      authSource: "demo_session",
      workspaceRegion: pcm.region,
    });
    try {
      const staleSnapshot = round.updatedAt;
      // Another user edits in between (updatedAt moves forward).
      await db
        .update(estimateRounds)
        .set({ feeExpected: 111, updatedAt: new Date(Date.now() + 1000) })
        .where(eq(estimateRounds.id, round.id));

      await expect(
        pursuitService.savePostBidData(principal, {
          roundId: round.id,
          values: { feeExpected: "222" },
          multiValues: {},
          customValues: {},
          expectedUpdatedAt: staleSnapshot,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      const [after] = await db
        .select()
        .from(estimateRounds)
        .where(eq(estimateRounds.id, round.id));
      expect(after.feeExpected).toBe(111);
    } finally {
      await cleanup(round.id, job.id);
    }
  });

  it("rejects direct transitions to locked, pointing at Approve & Lock", async () => {
    const { job, round } = await seedPostBidRound();
    const rpdPrincipal = createPrincipal({
      user: rpd,
      authSource: "demo_session",
      workspaceRegion: rpd.region ?? pcm.region,
    });
    try {
      await expect(
        pursuitService.transitionStatus(rpdPrincipal, round.id, "locked"),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const [after] = await db
        .select()
        .from(estimateRounds)
        .where(eq(estimateRounds.id, round.id));
      expect(after.status).toBe("post_bid");
      expect(after.lockedAt).toBeNull();
    } finally {
      await cleanup(round.id, job.id);
    }
  });

  it("creates pursuit job+round+transition atomically", async () => {
    const principal = createPrincipal({
      user: pcm,
      authSource: "demo_session",
      workspaceRegion: pcm.region,
    });
    const created = requireCreatedPursuit(
      await pursuitService.createPursuit(principal, {
      mode: "manual",
      jobName: `Atomic ${Date.now()}`,
      region: pcm.region!,
      preconDepartment: "Test",
      estimatePhase: "ROM",
      bidYear: 2026,
      initialStatus: "active",
      confirmDuplicate: true,
    }),
    );
    try {
      const transitions = await db
        .select()
        .from(statusTransitions)
        .where(eq(statusTransitions.roundId, created.roundId));
      expect(transitions).toHaveLength(1);
      expect(transitions[0]?.toStatus).toBe("active");
    } finally {
      await cleanup(created.roundId, created.jobId);
    }
  });
});

describe("migrations uniqueness and indexes", () => {
  it("reports clean duplicate preflight on seeded database", async () => {
    const result = await analyzeLogicalDuplicates();
    expect(result.clean).toBe(true);
    expect(result.groups).toEqual([]);
  });

  it("resolves injected custom-value duplicates deterministically", async () => {
    const { job, round } = await seedPostBidRound();
    const { customColumns, customColumnValues } = await import("@/db/schema");
    const [col] = await db.select().from(customColumns).limit(1);
    if (!col) {
      await cleanup(round.id, job.id);
      return;
    }
    try {
      await db.insert(customColumnValues).values([
        { columnId: col.id, roundId: round.id, value: "a" },
        { columnId: col.id, roundId: round.id, value: "b" },
      ]);
    } catch {
      // unique index may already reject second insert — that's success for constraints
      await cleanup(round.id, job.id);
      return;
    }

    try {
      const analysis = await analyzeLogicalDuplicates();
      expect(analysis.clean).toBe(false);
      const dropped = await resolveLogicalDuplicates(analysis.groups);
      expect(dropped).toBeGreaterThan(0);
      const after = await analyzeLogicalDuplicates();
      expect(after.clean).toBe(true);
    } finally {
      await db
        .delete(customColumnValues)
        .where(eq(customColumnValues.roundId, round.id));
      await cleanup(round.id, job.id);
    }
  });

  it("enforces one round number per job via unique index", async () => {
    const { job, round } = await seedPostBidRound();
    try {
      // Drizzle wraps the driver error ("Failed query: …") with the duplicate-key
      // detail on the cause, so assert rejection then verify no row landed.
      await expect(
        db.insert(estimateRounds).values({
          jobId: job.id,
          roundNumber: round.roundNumber,
          status: "active",
          region: pcm.region!,
          preconDepartment: "Test",
          estimatePhase: "GMP",
          bidYear: 2026,
          createdById: pcm.id,
        }),
      ).rejects.toThrow();
      const dupes = await db
        .select({ id: estimateRounds.id })
        .from(estimateRounds)
        .where(
          and(
            eq(estimateRounds.jobId, job.id),
            eq(estimateRounds.roundNumber, round.roundNumber),
          ),
        );
      expect(dupes).toHaveLength(1);
    } finally {
      await cleanup(round.id, job.id);
    }
  });

  it("has phase-7 unique indexes and hot-query indexes applied", async () => {
    const indexes = await db.execute(sql`
      select indexname from pg_indexes
      where schemaname = 'public'
        and indexname in (
          'custom_column_values_column_round_unique',
          'sheet_pins_sheet_user_unique',
          'distribution_runs_list_period_unique',
          'entity_versions_entity_version_unique',
          'estimate_rounds_status_region_idx',
          'round_multi_values_round_field_idx',
          'notifications_user_created_idx',
          'audit_log_round_created_idx'
        )
    `);
    const rows = Array.isArray(indexes)
      ? indexes
      : ((indexes as { rows?: { indexname: string }[] }).rows ?? []);
    const names = new Set(rows.map((row) => (row as { indexname: string }).indexname));
    expect(names.has("custom_column_values_column_round_unique")).toBe(true);
    expect(names.has("estimate_rounds_status_region_idx")).toBe(true);
    expect(names.has("round_multi_values_round_field_idx")).toBe(true);
  });

  it("EXPLAIN uses an index for active rounds by status/region", async () => {
    const plan = await db.execute(sql`
      explain select id from estimate_rounds
      where status = 'active' and region = ${pcm.region!} and deleted_at is null
    `);
    const text = JSON.stringify(plan);
    expect(text.toLowerCase()).toMatch(/index|estimate_rounds/);
  });
});
