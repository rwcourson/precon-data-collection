import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, ensureDbReady } from "@/db";
import {
  estimateRounds,
  jobs,
  sheetRows,
  sheets,
  users,
} from "@/db/schema";
import {
  createDataSnapshot,
  listTrash,
  permanentDelete,
  restoreEntity,
  softDeleteJob,
  softDeleteSheet,
  softDeleteSheetRow,
  verifyBackupIntegrity,
} from "@/lib/recovery";
import {
  permanentlyDeleteTrashItem,
  trashJob,
  getTrashItems,
} from "@/actions/recovery";
import { DomainError } from "@/domain/errors";
import { createPrincipal } from "@/lib/authorization/principal";
import { POST as trashPost, GET as trashGet } from "@/app/api/v1/mobile/trash/route";
import { DESTRUCTIVE_CHALLENGE_HEADER } from "@/lib/destructive-challenge";
import { issueDemoSession } from "@/lib/mobile-auth";
import { apiDestructiveChallenges, apiTokens } from "@/db/schema";
import { createDestructiveChallenge } from "@/lib/api-safety";
import { hashToken } from "@/lib/api-tokens";
import { authenticateBearer } from "@/lib/api-auth";

let admin: typeof users.$inferSelect;
let pcm: typeof users.$inferSelect;
let rpd: typeof users.$inferSelect;
const issued: string[] = [];

async function session(user: typeof users.$inferSelect) {
  const token = await issueDemoSession(user.id);
  if ("error" in token) throw new Error(token.error);
  issued.push(token.token);
  return token.token;
}

function request(
  url: string,
  token: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
) {
  return new Request(url, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-workspace-region": rpd.region ?? "Central",
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function authedToken(plaintext: string) {
  const auth = await authenticateBearer(`Bearer ${plaintext}`);
  if (!auth.ok) throw new Error(auth.error);
  return auth.token;
}

beforeAll(async () => {
  await ensureDbReady();
  [admin] = await db.select().from(users).where(eq(users.role, "corporate_admin")).limit(1);
  [pcm] = await db.select().from(users).where(eq(users.role, "pcm")).limit(1);
  [rpd] = await db.select().from(users).where(eq(users.role, "rpd")).limit(1);
  if (!admin || !pcm?.region || !rpd) throw new Error("seed roles missing");
});

describe("recovery soft-delete and provenance", () => {
  it("soft-deletes job+rounds in one batch and restores only that batch", async () => {
    const principal = createPrincipal({
      user: rpd,
      authSource: "demo_session",
      workspaceRegion: rpd.region ?? pcm.region,
    });
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `REC-${Date.now()}`,
        jobName: "Recovery job",
        region: rpd.region ?? pcm.region!,
        preconDepartment: "Test",
        createdById: pcm.id,
      })
      .returning();
    const [batchRound] = await db
      .insert(estimateRounds)
      .values({
        jobId: job.id,
        roundNumber: 1,
        status: "active",
        region: job.region,
        preconDepartment: "Test",
        estimatePhase: "ROM",
        bidYear: 2026,
        createdById: pcm.id,
      })
      .returning();
    const [independent] = await db
      .insert(estimateRounds)
      .values({
        jobId: job.id,
        roundNumber: 2,
        status: "active",
        region: job.region,
        preconDepartment: "Test",
        estimatePhase: "DD",
        bidYear: 2026,
        createdById: pcm.id,
        deletedAt: new Date(Date.now() - 60_000),
        deletedById: pcm.id,
        deletionBatchId: null,
      })
      .returning();

    const batchId = await softDeleteJob(principal, job.id);
    expect(batchId).toBeGreaterThan(0);

    const [afterJob] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    const [afterBatchRound] = await db
      .select()
      .from(estimateRounds)
      .where(eq(estimateRounds.id, batchRound.id));
    expect(afterJob?.deletedAt).not.toBeNull();
    expect(afterBatchRound?.deletionBatchId).toBe(batchId);

    await restoreEntity(principal, "job", job.id);
    const [restoredJob] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    const [restoredBatch] = await db
      .select()
      .from(estimateRounds)
      .where(eq(estimateRounds.id, batchRound.id));
    const [stillDeleted] = await db
      .select()
      .from(estimateRounds)
      .where(eq(estimateRounds.id, independent.id));
    expect(restoredJob?.deletedAt).toBeNull();
    expect(restoredBatch?.deletedAt).toBeNull();
    expect(stillDeleted?.deletedAt).not.toBeNull();

    await db.delete(estimateRounds).where(eq(estimateRounds.jobId, job.id));
    await db.delete(jobs).where(eq(jobs.id, job.id));
  });

  it("denies cross-Region soft-delete and unscoped trash list for RPD", async () => {
    const otherRegion = (rpd.region ?? pcm.region) === "Florida" ? "Central" : "Florida";
    const rpdPrincipal = createPrincipal({
      user: rpd,
      authSource: "demo_session",
      workspaceRegion: rpd.region ?? pcm.region,
    });
    const [crossJob] = await db
      .insert(jobs)
      .values({
        jobNumber: `XREG-${Date.now()}`,
        jobName: "Cross region",
        region: otherRegion,
        preconDepartment: "Test",
        createdById: admin.id,
      })
      .returning();

    await expect(softDeleteJob(rpdPrincipal, crossJob.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(trashJob(crossJob.id, rpdPrincipal)).rejects.toBeInstanceOf(DomainError);

    const [localJob] = await db
      .insert(jobs)
      .values({
        jobNumber: `LOC-${Date.now()}`,
        jobName: "Local",
        region: rpd.region ?? pcm.region!,
        preconDepartment: "Test",
        createdById: rpd.id,
        deletedAt: new Date(),
        deletedById: rpd.id,
      })
      .returning();
    const [foreignDeleted] = await db
      .insert(jobs)
      .values({
        jobNumber: `FOR-${Date.now()}`,
        jobName: "Foreign deleted",
        region: otherRegion,
        preconDepartment: "Test",
        createdById: admin.id,
        deletedAt: new Date(),
        deletedById: admin.id,
      })
      .returning();

    const trash = await listTrash(rpdPrincipal);
    expect(trash.some((item) => item.entityId === localJob.id && item.entityType === "job")).toBe(
      true,
    );
    expect(trash.some((item) => item.entityId === foreignDeleted.id)).toBe(false);

    const pcmPrincipal = createPrincipal({
      user: pcm,
      authSource: "demo_session",
      workspaceRegion: pcm.region,
    });
    await expect(listTrash(pcmPrincipal)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getTrashItems(pcmPrincipal)).rejects.toBeInstanceOf(DomainError);

    await db.delete(jobs).where(eq(jobs.id, crossJob.id));
    await db.delete(jobs).where(eq(jobs.id, localJob.id));
    await db.delete(jobs).where(eq(jobs.id, foreignDeleted.id));
  });

  it("permanentlyDeleteTrashItem rejects live IDs, RPD, and wrong confirmation", async () => {
    const adminPrincipal = createPrincipal({
      user: admin,
      authSource: "demo_session",
      workspaceRegion: null,
    });
    const rpdPrincipal = createPrincipal({
      user: rpd,
      authSource: "demo_session",
      workspaceRegion: rpd.region ?? pcm.region,
    });
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `PERM-${Date.now()}`,
        jobName: "Permanent target",
        region: rpd.region ?? pcm.region!,
        preconDepartment: "Test",
        createdById: rpd.id,
      })
      .returning();

    // Live (not soft-deleted) ID must not hard-delete
    await expect(
      permanentlyDeleteTrashItem("job", job.id, "PERMANENTLY DELETE", adminPrincipal),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const [stillLive] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(stillLive?.deletedAt).toBeNull();

    await softDeleteJob(rpdPrincipal, job.id);

    // RPD cannot permanently delete
    await expect(
      permanentlyDeleteTrashItem("job", job.id, "PERMANENTLY DELETE", rpdPrincipal),
    ).rejects.toMatchObject({ code: expect.stringMatching(/FORBIDDEN|NOT_FOUND/) });

    // Wrong confirmation
    await expect(
      permanentlyDeleteTrashItem("job", job.id, "DELETE", adminPrincipal),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // Correct path
    await permanentlyDeleteTrashItem("job", job.id, "PERMANENTLY DELETE", adminPrincipal);
    const remaining = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(remaining).toHaveLength(0);
  });

  it("lists sheet rows in trash and permanent-delete requires corporate admin + confirmation", async () => {
    const adminPrincipal = createPrincipal({
      user: admin,
      authSource: "demo_session",
      workspaceRegion: null,
    });
    const rpdPrincipal = createPrincipal({
      user: rpd,
      authSource: "demo_session",
      workspaceRegion: rpd.region ?? pcm.region,
    });
    const [sheet] = await db
      .insert(sheets)
      .values({
        kind: "grid",
        name: `Trash sheet ${Date.now()}`,
        region: rpd.region ?? pcm.region,
        ownerId: rpd.id,
      })
      .returning();
    const [row] = await db
      .insert(sheetRows)
      .values({ sheetId: sheet.id, values: { name: "x" }, sortOrder: 0 })
      .returning();

    await softDeleteSheetRow(rpdPrincipal, row.id);
    const trash = await listTrash(rpdPrincipal);
    expect(trash.some((item) => item.entityType === "sheet_row" && item.entityId === row.id)).toBe(
      true,
    );

    await expect(
      permanentDelete({
        principal: rpdPrincipal,
        entityType: "sheet_row",
        entityId: row.id,
        confirmation: "PERMANENTLY DELETE",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await permanentDelete({
      principal: adminPrincipal,
      entityType: "sheet_row",
      entityId: row.id,
      confirmation: "PERMANENTLY DELETE",
    });
    const remaining = await db.select().from(sheetRows).where(eq(sheetRows.id, row.id));
    expect(remaining).toHaveLength(0);

    await softDeleteSheet(rpdPrincipal, sheet.id);
    await permanentDelete({
      principal: adminPrincipal,
      entityType: "sheet",
      entityId: sheet.id,
      confirmation: "PERMANENTLY DELETE",
    });
  });
});

describe("mobile trash POST boundary", () => {
  it("requires destructive challenge; rejects missing/replayed challenges and RPD permanent", async () => {
    const adminToken = await session(admin);
    const rpdToken = await session(rpd);
    const adminApiToken = await authedToken(adminToken);
    const [job] = await db
      .insert(jobs)
      .values({
        jobNumber: `MOB-T-${Date.now()}`,
        jobName: "Mobile trash",
        region: rpd.region ?? pcm.region!,
        preconDepartment: "Test",
        createdById: rpd.id,
      })
      .returning();

    // Soft-delete first so permanent can target a real trash item
    const rpdPrincipal = createPrincipal({
      user: rpd,
      authSource: "demo_session",
      workspaceRegion: rpd.region ?? pcm.region,
    });
    await softDeleteJob(rpdPrincipal, job.id);

    // Missing challenge on API permanent path
    const missingChallenge = await trashPost(
      request("http://localhost/api/v1/mobile/trash", adminToken, {
        action: "permanent",
        entityType: "job",
        entityId: job.id,
        confirmation: "PERMANENTLY DELETE",
      }),
    );
    expect(missingChallenge.status).toBe(400);
    expect(await missingChallenge.json()).toMatchObject({
      error: expect.stringMatching(/X-Destructive-Challenge|challenge/i),
    });
    const [stillThere] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(stillThere?.deletedAt).not.toBeNull();

    // RPD with a valid-looking challenge still fails capability
    const rpdApiToken = await authedToken(rpdToken);
    const rpdChallenge = await createDestructiveChallenge({
      token: rpdApiToken,
      operation: "permanent-delete",
      target: `job:${job.id}`,
      payload: {
        entityType: "job",
        entityId: job.id,
        confirmation: "PERMANENTLY DELETE",
      },
    });
    const rpdPermanent = await trashPost(
      request(
        "http://localhost/api/v1/mobile/trash",
        rpdToken,
        {
          action: "permanent",
          entityType: "job",
          entityId: job.id,
          confirmation: "PERMANENTLY DELETE",
        },
        { [DESTRUCTIVE_CHALLENGE_HEADER]: rpdChallenge.challenge },
      ),
    );
    expect([403, 404]).toContain(rpdPermanent.status);

    // Valid admin challenge consumes once
    const payload = {
      entityType: "job" as const,
      entityId: job.id,
      confirmation: "PERMANENTLY DELETE",
    };
    const challenge = await createDestructiveChallenge({
      token: adminApiToken,
      operation: "permanent-delete",
      target: `job:${job.id}`,
      payload,
    });
    const adminOk = await trashPost(
      request(
        "http://localhost/api/v1/mobile/trash",
        adminToken,
        {
          action: "permanent",
          entityType: "job",
          entityId: job.id,
          confirmation: "PERMANENTLY DELETE",
        },
        { [DESTRUCTIVE_CHALLENGE_HEADER]: challenge.challenge },
      ),
    );
    expect(adminOk.status).toBe(200);
    const remaining = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(remaining).toHaveLength(0);

    // Replay of the same challenge must fail (already consumed)
    const [job2] = await db
      .insert(jobs)
      .values({
        jobNumber: `MOB-T2-${Date.now()}`,
        jobName: "Replay target",
        region: rpd.region ?? pcm.region!,
        preconDepartment: "Test",
        createdById: rpd.id,
        deletedAt: new Date(),
        deletedById: admin.id,
      })
      .returning();
    const replay = await trashPost(
      request(
        "http://localhost/api/v1/mobile/trash",
        adminToken,
        {
          action: "permanent",
          entityType: "job",
          entityId: job2.id,
          confirmation: "PERMANENTLY DELETE",
        },
        { [DESTRUCTIVE_CHALLENGE_HEADER]: challenge.challenge },
      ),
    );
    expect([409, 400, 404]).toContain(replay.status);
    const [job2Still] = await db.select().from(jobs).where(eq(jobs.id, job2.id));
    expect(job2Still).toBeTruthy();

    // Service-level requireApiChallenge without challenge
    await expect(
      permanentlyDeleteTrashItem(
        "job",
        job2.id,
        "PERMANENTLY DELETE",
        createPrincipal({ user: admin, authSource: "api_token", workspaceRegion: null, token: adminApiToken }),
        null,
        { requireApiChallenge: true },
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const pcmToken = await session(pcm);
    const list = await trashGet(request("http://localhost/api/v1/mobile/trash", pcmToken));
    expect([403, 404]).toContain(list.status);

    await db.delete(jobs).where(eq(jobs.id, job2.id));
    for (const plaintext of issued) {
      const tokenHash = hashToken(plaintext);
      const rows = await db.select().from(apiTokens).where(eq(apiTokens.tokenHash, tokenHash));
      for (const row of rows) {
        await db
          .delete(apiDestructiveChallenges)
          .where(eq(apiDestructiveChallenges.tokenId, row.id));
      }
      await db.delete(apiTokens).where(eq(apiTokens.tokenHash, tokenHash));
    }
  });
});

describe("backup restore integrity", () => {
  it("creates a full logical backup with checksum and verifiable payload", async () => {
    const periodKey = `test-backup-${Date.now()}`;
    const snap = await createDataSnapshot(periodKey);
    expect(snap.checksum).toHaveLength(64);
    expect(snap.byteSize).toBeGreaterThan(100);
    const integrity = await verifyBackupIntegrity(periodKey);
    expect(integrity.checksumMatch).toBe(true);
    expect(integrity.counts.jobs).toBeGreaterThan(0);
    expect(integrity.counts.estimateRounds).toBeGreaterThan(0);
    expect(createHash("sha256").update(JSON.stringify({})).digest("hex")).not.toBe(snap.checksum);
  });
});
