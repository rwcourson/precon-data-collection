import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { db, ensureDbReady } from "@/db";
import {
  appSettings,
  auditLog,
  estimateRounds,
  jobs,
  notifications,
  publicationOutbox,
  roundLockRevisions,
  roundMultiValues,
  statusTransitions,
  users,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { createPrincipal } from "@/lib/authorization/principal";
import { nextLockRevisionNumber } from "@/lib/lock-revisions";
import { parseRolloutSettings, ROLLOUT_SETTINGS_KEY } from "@/lib/rollout";
import { unlockRound } from "@/services/lock-lifecycle-service";
import { pursuitService } from "@/services/pursuit-service";

let pcm: typeof users.$inferSelect;
let rpd: typeof users.$inferSelect;
let lead: typeof users.$inferSelect;
const createdRoundIds: number[] = [];
let previousRollout: Record<string, unknown> | null | undefined;

beforeAll(async () => {
  await ensureDbReady();
  [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
  [rpd] = await db.select().from(users).where(eq(users.role, "rpd")).limit(1);
  [lead] = await db
    .select()
    .from(users)
    .where(eq(users.role, "estimate_lead"))
    .limit(1);
});

afterEach(async () => {
  if (previousRollout !== undefined) {
    if (previousRollout == null) {
      await db
        .delete(appSettings)
        .where(eq(appSettings.key, ROLLOUT_SETTINGS_KEY));
    } else {
      await db
        .insert(appSettings)
        .values({
          key: ROLLOUT_SETTINGS_KEY,
          value: previousRollout,
          updatedById: rpd.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: {
            value: previousRollout,
            updatedById: rpd.id,
            updatedAt: new Date(),
          },
        });
    }
    previousRollout = undefined;
  }
  for (const roundId of createdRoundIds.splice(0)) {
    await db
      .delete(publicationOutbox)
      .where(eq(publicationOutbox.roundId, roundId));
    await db
      .delete(roundLockRevisions)
      .where(eq(roundLockRevisions.roundId, roundId));
    await db
      .delete(statusTransitions)
      .where(eq(statusTransitions.roundId, roundId));
    await db.delete(auditLog).where(eq(auditLog.roundId, roundId));
    await db.delete(notifications).where(eq(notifications.roundId, roundId));
    await db
      .delete(roundMultiValues)
      .where(eq(roundMultiValues.roundId, roundId));
    const [round] = await db
      .select({ jobId: estimateRounds.jobId })
      .from(estimateRounds)
      .where(eq(estimateRounds.id, roundId));
    await db.delete(estimateRounds).where(eq(estimateRounds.id, roundId));
    if (round) await db.delete(jobs).where(eq(jobs.id, round.jobId));
  }
});

async function enableFeatures(features: {
  lockRevisions?: boolean;
  fieldPolicy?: boolean;
}) {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, ROLLOUT_SETTINGS_KEY));
  if (previousRollout === undefined) previousRollout = row?.value ?? null;
  const current = parseRolloutSettings(row?.value);
  const value = {
    version: 1 as const,
    features: {
      ...current.features,
      ...(features.lockRevisions != null
        ? { lockRevisions: { enabled: features.lockRevisions } }
        : {}),
      ...(features.fieldPolicy != null
        ? { fieldPolicy: { enabled: features.fieldPolicy } }
        : {}),
    },
  };
  await db
    .insert(appSettings)
    .values({
      key: ROLLOUT_SETTINGS_KEY,
      value,
      updatedById: rpd.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedById: rpd.id, updatedAt: new Date() },
    });
}

function rpdPrincipal() {
  return createPrincipal({
    user: rpd,
    authSource: "demo_session",
    workspaceRegion: rpd.region,
  });
}

describe("lock revisions", () => {
  it("requires an RPD reason and does not fabricate a legacy revision", async () => {
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `LOCK-${Date.now()}`,
        jobName: "Lock fixture",
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
        region: job.region,
        preconDepartment: job.preconDepartment,
        estimatePhase: "GMP",
        bidYear: 2026,
        createdById: rpd.id,
        lockedAt: new Date(),
      })
      .returning();
    createdRoundIds.push(round.id);

    await expect(
      unlockRound(
        createPrincipal({
          user: pcm,
          authSource: "demo_session",
          workspaceRegion: pcm.region,
        }),
        round.id,
        "please unlock"
      )
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      unlockRound(
        createPrincipal({
          user: rpd,
          authSource: "demo_session",
          workspaceRegion: rpd.region,
        }),
        round.id,
        "no"
      )
    ).rejects.toBeInstanceOf(DomainError);

    const unlocked = await unlockRound(
      createPrincipal({
        user: rpd,
        authSource: "demo_session",
        workspaceRegion: rpd.region,
      }),
      round.id,
      "Correct the awardability value"
    );
    expect(unlocked.revision).toBeNull();
    const revisions = await db
      .select()
      .from(roundLockRevisions)
      .where(eq(roundLockRevisions.roundId, round.id));
    expect(revisions).toHaveLength(0);
    const [fresh] = await db
      .select({ status: estimateRounds.status })
      .from(estimateRounds)
      .where(eq(estimateRounds.id, round.id));
    expect(fresh.status).toBe("post_bid");
    const [retract] = await db
      .select()
      .from(publicationOutbox)
      .where(eq(publicationOutbox.roundId, round.id));
    expect(retract?.eventType).toBe("retract");
    expect(retract?.payload).toMatchObject({ revision: 1, legacyUnlock: true });
    expect(nextLockRevisionNumber([])).toBe(1);
    expect(nextLockRevisionNumber([1])).toBe(2);
    expect(nextLockRevisionNumber([1, 2])).toBe(3);
  });

  it("blocks in-place saves while locked and mints revision 2 on re-lock", async () => {
    await enableFeatures({ lockRevisions: true, fieldPolicy: true });
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `RELK-${Date.now()}`,
        jobName: "Re-lock fixture",
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
        region: job.region,
        preconDepartment: job.preconDepartment,
        estimatePhase: "Budget - Quick ROM",
        bidYear: 2026,
        bidDueDate: "2026-09-01",
        projectStartMonth: "2026-11",
        estimateLeadId: lead.id,
        marketSector: "Healthcare – Acute",
        awardability: "Not Work Under Contract – Budget",
        estimateValue: 10_000_000,
        feeBackPage: 400_000,
        feeExpected: 420_000,
        contingencyTotal: 100_000,
        createdById: rpd.id,
      })
      .returning();
    createdRoundIds.push(round.id);
    const actor = rpdPrincipal();

    const first = await pursuitService.approveAndLock(actor, round.id);
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.revision).toBe(1);

    await expect(
      pursuitService.savePostBidData(actor, {
        roundId: round.id,
        values: { bidDueDate: "2026-10-01" },
        multiValues: {},
        customValues: {},
      })
    ).rejects.toBeInstanceOf(DomainError);

    await unlockRound(actor, round.id, "Correct the start month");
    const second = await pursuitService.approveAndLock(actor, round.id);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.revision).toBe(2);
    const revisions = await db
      .select({ revision: roundLockRevisions.revision })
      .from(roundLockRevisions)
      .where(eq(roundLockRevisions.roundId, round.id));
    expect(revisions.map((row) => row.revision).sort()).toEqual([1, 2]);
  });
});
