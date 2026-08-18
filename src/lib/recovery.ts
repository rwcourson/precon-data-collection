import "server-only";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { createHash } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { db } from "@/db";
import {
  customColumnValues,
  dataSnapshots,
  deletionBatches,
  entityVersions,
  estimateRounds,
  jobs,
  reportArtifacts,
  roundMultiValues,
  sheetRows,
  sheets,
  statusTransitions,
  type User,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { authorize } from "@/lib/authorization/kernel";
import {
  loadJobForPrincipal,
  loadRoundForPrincipal,
  loadSheetForPrincipal,
  loadTrashForPrincipal,
} from "@/lib/authorization/loaders";
import { principalAllowsRegion } from "@/lib/authorization/principal";
import type { Principal } from "@/lib/authorization/types";
import { getArtifactStorage } from "@/lib/artifact-storage";
import { withTransaction } from "@/lib/transactions";

const TRASH_RETENTION_DAYS = 30;
export const BACKUP_FORMAT_VERSION = 1;
const TRASH_MANAGER_ROLES = new Set(["rpd", "corporate_admin", "admin_jsa"]);

export type TrashItem = {
  entityType: "job" | "round" | "sheet" | "sheet_row";
  entityId: number;
  name: string;
  deletedAt: Date;
  deletedById: number | null;
  deletionBatchId: number | null;
  retentionDeadline: Date;
  region: string | null;
};

function deadline(deletedAt: Date): Date {
  const d = new Date(deletedAt);
  d.setDate(d.getDate() + TRASH_RETENTION_DAYS);
  return d;
}

function assertTrashManager(principal: Principal): void {
  if (!TRASH_MANAGER_ROLES.has(principal.user.role)) {
    throw DomainError.forbidden("Not permitted to manage trash.");
  }
}

async function openDeletionBatch(user: User, reason: string): Promise<number> {
  const [batch] = await db
    .insert(deletionBatches)
    .values({ actorId: user.id, reason })
    .returning({ id: deletionBatches.id });
  return batch.id;
}

/** Soft-delete requires trash-manager role + scoped loader (Region-safe). */
export async function softDeleteJob(principal: Principal, jobId: number): Promise<number> {
  assertTrashManager(principal);
  // Use read capability for Region SQL scope; corporate_admin is not an edit role.
  const loaded = await loadJobForPrincipal(principal, jobId, "read");
  if (!loaded) throw DomainError.notFound("Job not found");
  const user = principal.user;
  const now = new Date();
  return withTransaction(async (tx) => {
    const [batch] = await tx
      .insert(deletionBatches)
      .values({ actorId: user.id, reason: "soft-delete-job" })
      .returning({ id: deletionBatches.id });
    const [updated] = await tx
      .update(jobs)
      .set({ deletedAt: now, deletedById: user.id, deletionBatchId: batch.id })
      .where(and(eq(jobs.id, jobId), isNull(jobs.deletedAt)))
      .returning({ id: jobs.id });
    if (!updated) throw DomainError.notFound("Job not found");
    await tx
      .update(estimateRounds)
      .set({ deletedAt: now, deletedById: user.id, deletionBatchId: batch.id })
      .where(and(eq(estimateRounds.jobId, jobId), isNull(estimateRounds.deletedAt)));
    return batch.id;
  });
}

export async function softDeleteRound(principal: Principal, roundId: number): Promise<number> {
  assertTrashManager(principal);
  const loaded = await loadRoundForPrincipal(principal, roundId, { capability: "read" });
  if (!loaded) throw DomainError.notFound("Round not found");
  const user = principal.user;
  const now = new Date();
  const batchId = await openDeletionBatch(user, "soft-delete-round");
  const [updated] = await db
    .update(estimateRounds)
    .set({ deletedAt: now, deletedById: user.id, deletionBatchId: batchId })
    .where(and(eq(estimateRounds.id, roundId), isNull(estimateRounds.deletedAt)))
    .returning({ id: estimateRounds.id });
  if (!updated) throw DomainError.notFound("Round not found");
  return batchId;
}

export async function softDeleteSheet(principal: Principal, sheetId: number): Promise<number> {
  assertTrashManager(principal);
  const loaded = await loadSheetForPrincipal(principal, sheetId, "manage");
  if (!loaded) throw DomainError.notFound("Sheet not found");
  const user = principal.user;
  const now = new Date();
  return withTransaction(async (tx) => {
    const [batch] = await tx
      .insert(deletionBatches)
      .values({ actorId: user.id, reason: "soft-delete-sheet" })
      .returning({ id: deletionBatches.id });
    const [updated] = await tx
      .update(sheets)
      .set({ deletedAt: now, deletedById: user.id, deletionBatchId: batch.id })
      .where(and(eq(sheets.id, sheetId), isNull(sheets.deletedAt)))
      .returning({ id: sheets.id });
    if (!updated) throw DomainError.notFound("Sheet not found");
    await tx
      .update(sheetRows)
      .set({ deletedAt: now, deletedById: user.id, deletionBatchId: batch.id })
      .where(and(eq(sheetRows.sheetId, sheetId), isNull(sheetRows.deletedAt)));
    return batch.id;
  });
}

export async function softDeleteSheetRow(principal: Principal, rowId: number): Promise<number> {
  const [row] = await db
    .select()
    .from(sheetRows)
    .where(and(eq(sheetRows.id, rowId), isNull(sheetRows.deletedAt)));
  if (!row) throw DomainError.notFound("Sheet row not found");
  const sheet = await loadSheetForPrincipal(principal, row.sheetId, "edit");
  if (!sheet) throw DomainError.notFound("Sheet row not found");
  const user = principal.user;
  const now = new Date();
  const batchId = await openDeletionBatch(user, "soft-delete-sheet-row");
  await db
    .update(sheetRows)
    .set({ deletedAt: now, deletedById: user.id, deletionBatchId: batchId })
    .where(and(eq(sheetRows.id, rowId), isNull(sheetRows.deletedAt)));
  return batchId;
}

/**
 * Restore only the target and descendants deleted in the same batch.
 * Independently deleted child records stay deleted.
 */
export async function restoreEntity(
  principal: Principal,
  entityType: TrashItem["entityType"],
  entityId: number,
): Promise<void> {
  if (entityType === "sheet_row") {
    assertTrashManager(principal);
    const [row] = await db
      .select()
      .from(sheetRows)
      .where(and(eq(sheetRows.id, entityId), isNotNull(sheetRows.deletedAt)));
    if (!row) throw DomainError.notFound("Deleted sheet row not found");
    const sheet = await loadSheetForPrincipal(principal, row.sheetId, "edit");
    if (!sheet) throw DomainError.notFound("Deleted sheet row not found");
  } else {
    const loaded = await loadTrashForPrincipal(principal, entityType, entityId, "restore");
    if (!loaded) throw DomainError.notFound("Trash item not found");
  }

  await withTransaction(async (tx) => {
    if (entityType === "job") {
      const [job] = await tx.select().from(jobs).where(eq(jobs.id, entityId));
      if (!job?.deletedAt) throw DomainError.badRequest("Job is not in trash");
      const batchId = job.deletionBatchId;
      await tx
        .update(jobs)
        .set({ deletedAt: null, deletedById: null, deletionBatchId: null })
        .where(eq(jobs.id, entityId));
      if (batchId != null) {
        await tx
          .update(estimateRounds)
          .set({ deletedAt: null, deletedById: null, deletionBatchId: null })
          .where(
            and(eq(estimateRounds.jobId, entityId), eq(estimateRounds.deletionBatchId, batchId)),
          );
      }
      return;
    }
    if (entityType === "round") {
      await tx
        .update(estimateRounds)
        .set({ deletedAt: null, deletedById: null, deletionBatchId: null })
        .where(eq(estimateRounds.id, entityId));
      return;
    }
    if (entityType === "sheet") {
      const [sheet] = await tx.select().from(sheets).where(eq(sheets.id, entityId));
      if (!sheet?.deletedAt) throw DomainError.badRequest("Sheet is not in trash");
      const batchId = sheet.deletionBatchId;
      await tx
        .update(sheets)
        .set({ deletedAt: null, deletedById: null, deletionBatchId: null })
        .where(eq(sheets.id, entityId));
      if (batchId != null) {
        await tx
          .update(sheetRows)
          .set({ deletedAt: null, deletedById: null, deletionBatchId: null })
          .where(and(eq(sheetRows.sheetId, entityId), eq(sheetRows.deletionBatchId, batchId)));
      }
      return;
    }
    await tx
      .update(sheetRows)
      .set({ deletedAt: null, deletedById: null, deletionBatchId: null })
      .where(eq(sheetRows.id, entityId));
  });
}

/** List trash visible to the principal only (Region + trash read capability). */
export async function listTrash(principal: Principal): Promise<TrashItem[]> {
  const decision = authorize(principal, "read", {
    type: "trash",
    id: "index",
    region: principal.workspace.region,
    ownerId: null,
    published: false,
    deleted: true,
  });
  if (!decision.allowed) {
    throw DomainError.forbidden("Not permitted to view trash.");
  }

  const [jobRows, roundRows, sheetList, gridRows] = await Promise.all([
    db.select().from(jobs).where(isNotNull(jobs.deletedAt)),
    db.select().from(estimateRounds).where(isNotNull(estimateRounds.deletedAt)),
    db.select().from(sheets).where(isNotNull(sheets.deletedAt)),
    db.select().from(sheetRows).where(isNotNull(sheetRows.deletedAt)),
  ]);

  const items: TrashItem[] = [];
  for (const j of jobRows) {
    if (!j.deletedAt || !principalAllowsRegion(principal, j.region)) continue;
    items.push({
      entityType: "job",
      entityId: j.id,
      name: `${j.jobNumber} — ${j.jobName}`,
      deletedAt: j.deletedAt,
      deletedById: j.deletedById,
      deletionBatchId: j.deletionBatchId ?? null,
      retentionDeadline: deadline(j.deletedAt),
      region: j.region,
    });
  }
  for (const r of roundRows) {
    if (!r.deletedAt || !principalAllowsRegion(principal, r.region)) continue;
    items.push({
      entityType: "round",
      entityId: r.id,
      name: `Round #${r.roundNumber} (${r.estimatePhase})`,
      deletedAt: r.deletedAt,
      deletedById: r.deletedById,
      deletionBatchId: r.deletionBatchId ?? null,
      retentionDeadline: deadline(r.deletedAt),
      region: r.region,
    });
  }
  for (const s of sheetList) {
    if (!s.deletedAt || !principalAllowsRegion(principal, s.region)) continue;
    items.push({
      entityType: "sheet",
      entityId: s.id,
      name: s.name,
      deletedAt: s.deletedAt,
      deletedById: s.deletedById,
      deletionBatchId: s.deletionBatchId ?? null,
      retentionDeadline: deadline(s.deletedAt),
      region: s.region,
    });
  }
  // Batch the parent-sheet lookup: one inArray query instead of one per row.
  const parentSheetIds = [...new Set(gridRows.filter((r) => r.deletedAt).map((r) => r.sheetId))];
  const parentSheets = parentSheetIds.length
    ? await db.select().from(sheets).where(inArray(sheets.id, parentSheetIds))
    : [];
  const parentSheetById = new Map(parentSheets.map((s) => [s.id, s]));
  for (const row of gridRows) {
    if (!row.deletedAt) continue;
    const parent = parentSheetById.get(row.sheetId);
    if (!principalAllowsRegion(principal, parent?.region ?? null)) continue;
    items.push({
      entityType: "sheet_row",
      entityId: row.id,
      name: `Row ${row.id} on sheet ${row.sheetId}`,
      deletedAt: row.deletedAt,
      deletedById: row.deletedById,
      deletionBatchId: row.deletionBatchId ?? null,
      retentionDeadline: deadline(row.deletedAt),
      region: parent?.region ?? null,
    });
  }
  return items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

export type PermanentDeleteChallenge = {
  token: import("@/db/schema").ApiToken;
  challenge: string;
};

/**
 * Corporate-admin permanent delete of an already soft-deleted target.
 * Requires capability permanent-delete, typed confirmation, FK cleanup,
 * and — for API callers — a one-time consumed destructive challenge.
 */
export async function permanentDelete(input: {
  principal: Principal;
  entityType: TrashItem["entityType"];
  entityId: number;
  confirmation: string;
  /** Required for API/mobile callers (bearer tokens). Web session may omit. */
  apiDestructive?: PermanentDeleteChallenge | null;
  requireApiChallenge?: boolean;
}): Promise<void> {
  if (input.confirmation !== "PERMANENTLY DELETE") {
    throw DomainError.badRequest('Typed confirmation must be exactly "PERMANENTLY DELETE".');
  }

  if (input.requireApiChallenge && !input.apiDestructive?.challenge) {
    throw DomainError.badRequest(
      "X-Destructive-Challenge is required for API permanent delete.",
      "Issue a challenge via POST /api/v1/destructive/challenge first.",
    );
  }

  if (input.entityType === "sheet_row") {
    if (input.principal.user.role !== "corporate_admin") {
      throw DomainError.forbidden("Only corporate admins can permanently delete.");
    }
    const [row] = await db
      .select()
      .from(sheetRows)
      .where(and(eq(sheetRows.id, input.entityId), isNotNull(sheetRows.deletedAt)));
    if (!row) throw DomainError.notFound("Deleted sheet row not found");
    const sheet = await loadSheetForPrincipal(input.principal, row.sheetId, "manage");
    if (!sheet) throw DomainError.notFound("Deleted sheet row not found");
  } else {
    const loaded = await loadTrashForPrincipal(
      input.principal,
      input.entityType,
      input.entityId,
      "permanent-delete",
    );
    if (!loaded) throw DomainError.notFound("Deleted item not found");
  }

  const payload = {
    entityType: input.entityType,
    entityId: input.entityId,
    confirmation: input.confirmation,
  };
  const target = `${input.entityType}:${input.entityId}`;
  const operation = "permanent-delete";

  const runMutation = async (tx: typeof db) => {
    if (input.entityType === "round") {
      const [round] = await tx
        .select()
        .from(estimateRounds)
        .where(and(eq(estimateRounds.id, input.entityId), isNotNull(estimateRounds.deletedAt)));
      if (!round) throw DomainError.notFound("Deleted round not found");
      await tx.delete(roundMultiValues).where(eq(roundMultiValues.roundId, round.id));
      await tx.delete(customColumnValues).where(eq(customColumnValues.roundId, round.id));
      await tx.delete(statusTransitions).where(eq(statusTransitions.roundId, round.id));
      await tx.delete(estimateRounds).where(eq(estimateRounds.id, round.id));
      return;
    }
    if (input.entityType === "job") {
      const [job] = await tx
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, input.entityId), isNotNull(jobs.deletedAt)));
      if (!job) throw DomainError.notFound("Deleted job not found");
      const rounds = await tx
        .select({ id: estimateRounds.id })
        .from(estimateRounds)
        .where(eq(estimateRounds.jobId, job.id));
      for (const round of rounds) {
        await tx.delete(roundMultiValues).where(eq(roundMultiValues.roundId, round.id));
        await tx.delete(customColumnValues).where(eq(customColumnValues.roundId, round.id));
        await tx.delete(statusTransitions).where(eq(statusTransitions.roundId, round.id));
      }
      await tx.delete(estimateRounds).where(eq(estimateRounds.jobId, job.id));
      await tx.delete(jobs).where(eq(jobs.id, job.id));
      return;
    }
    if (input.entityType === "sheet") {
      const [sheet] = await tx
        .select()
        .from(sheets)
        .where(and(eq(sheets.id, input.entityId), isNotNull(sheets.deletedAt)));
      if (!sheet) throw DomainError.notFound("Deleted sheet not found");
      await tx.delete(sheetRows).where(eq(sheetRows.sheetId, sheet.id));
      await tx.delete(sheets).where(eq(sheets.id, sheet.id));
      return;
    }
    const [row] = await tx
      .select()
      .from(sheetRows)
      .where(and(eq(sheetRows.id, input.entityId), isNotNull(sheetRows.deletedAt)));
    if (!row) throw DomainError.notFound("Deleted sheet row not found");
    await tx.delete(sheetRows).where(eq(sheetRows.id, row.id));
  };

  if (input.apiDestructive) {
    const { withDestructiveChallenge } = await import("@/lib/api-safety");
    await withDestructiveChallenge(
      {
        token: input.apiDestructive.token,
        challenge: input.apiDestructive.challenge,
        operation,
        target,
        payload,
      },
      (tx) => runMutation(tx as unknown as typeof db),
    );
    return;
  }

  await withTransaction((tx) => runMutation(tx));
}

export async function appendEntityVersion(
  entityType: string,
  entityId: number,
  snapshot: Record<string, unknown>,
  userId: number | null,
  executor: typeof db = db,
): Promise<void> {
  const existing = await executor
    .select({ version: entityVersions.version })
    .from(entityVersions)
    .where(
      and(eq(entityVersions.entityType, entityType), eq(entityVersions.entityId, entityId)),
    );
  const next = existing.reduce((m, r) => Math.max(m, r.version), 0) + 1;
  await executor.insert(entityVersions).values({
    entityType,
    entityId,
    version: next,
    snapshot,
    changedById: userId,
  });
}

export type LogicalBackup = {
  formatVersion: number;
  periodKey: string;
  capturedAt: string;
  records: {
    jobs: unknown[];
    estimateRounds: unknown[];
    roundMultiValues: unknown[];
    customColumnValues: unknown[];
    sheets: unknown[];
    sheetRows: unknown[];
  };
  hashes: Record<string, string>;
};

function hashRecords(records: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(records)).digest("hex");
}

/** Full logical backup — not count-only. */
export async function createDataSnapshot(periodKey: string): Promise<{
  id: number;
  checksum: string;
  storageKey: string;
  byteSize: number;
}> {
  const existing = await db
    .select()
    .from(dataSnapshots)
    .where(eq(dataSnapshots.periodKey, periodKey));
  if (existing[0]) {
    return {
      id: existing[0].id,
      checksum: existing[0].checksum,
      storageKey: existing[0].storageKey,
      byteSize: existing[0].byteSize,
    };
  }

  const [jobRows, roundRows, multi, customs, sheetList, gridRows] = await Promise.all([
    db.select().from(jobs),
    db.select().from(estimateRounds),
    db.select().from(roundMultiValues),
    db.select().from(customColumnValues),
    db.select().from(sheets),
    db.select().from(sheetRows),
  ]);

  const backup: LogicalBackup = {
    formatVersion: BACKUP_FORMAT_VERSION,
    periodKey,
    capturedAt: new Date().toISOString(),
    records: {
      jobs: jobRows,
      estimateRounds: roundRows,
      roundMultiValues: multi,
      customColumnValues: customs,
      sheets: sheetList,
      sheetRows: gridRows,
    },
    hashes: {
      jobs: hashRecords(jobRows),
      estimateRounds: hashRecords(roundRows),
      roundMultiValues: hashRecords(multi),
      customColumnValues: hashRecords(customs),
      sheets: hashRecords(sheetList),
      sheetRows: hashRecords(gridRows),
    },
  };

  const payload = JSON.stringify(backup);
  const bytes = new TextEncoder().encode(payload);
  const storage = getArtifactStorage();
  const stored = await storage.put(`backups/${periodKey}.json`, bytes, "application/json");

  const [row] = await db
    .insert(dataSnapshots)
    .values({
      periodKey,
      storageKey: stored.storageKey,
      checksum: stored.checksum,
      byteSize: stored.byteSize,
      manifest: {
        formatVersion: BACKUP_FORMAT_VERSION,
        counts: {
          jobs: jobRows.length,
          rounds: roundRows.length,
          sheets: sheetList.length,
          sheetRows: gridRows.length,
        },
        hashes: backup.hashes,
        storageMode: storage.mode(),
      },
    })
    .returning();

  return {
    id: row.id,
    checksum: row.checksum,
    storageKey: row.storageKey,
    byteSize: row.byteSize,
  };
}

export async function readSnapshotPayload(periodKey: string): Promise<string | null> {
  const [meta] = await db
    .select()
    .from(dataSnapshots)
    .where(eq(dataSnapshots.periodKey, periodKey));
  if (!meta) {
    try {
      return await readFile(
        path.join(process.cwd(), ".data", "snapshots", `${periodKey}.json`),
        "utf8",
      );
    } catch {
      return null;
    }
  }
  const storage = getArtifactStorage();
  const bytes = await storage.get(meta.storageKey);
  if (!bytes) return null;
  return new TextDecoder().decode(bytes);
}

export async function verifyBackupIntegrity(periodKey: string): Promise<{
  ok: boolean;
  checksumMatch: boolean;
  counts: Record<string, number>;
}> {
  const payload = await readSnapshotPayload(periodKey);
  if (!payload) return { ok: false, checksumMatch: false, counts: {} };
  const [meta] = await db
    .select()
    .from(dataSnapshots)
    .where(eq(dataSnapshots.periodKey, periodKey));
  const checksum = createHash("sha256").update(payload).digest("hex");
  const backup = JSON.parse(payload) as LogicalBackup;
  const counts = {
    jobs: backup.records.jobs.length,
    estimateRounds: backup.records.estimateRounds.length,
    sheets: backup.records.sheets.length,
    sheetRows: backup.records.sheetRows.length,
  };
  return {
    ok: Boolean(meta && meta.checksum === checksum && backup.formatVersion === BACKUP_FORMAT_VERSION),
    checksumMatch: Boolean(meta && meta.checksum === checksum),
    counts,
  };
}

/** Restore into an isolated empty target is handled by scripts/verify-restore.mjs. */
export async function materializeBackupForRestore(periodKey: string, targetDir: string) {
  const payload = await readSnapshotPayload(periodKey);
  if (!payload) throw DomainError.notFound("Backup not found");
  await mkdir(targetDir, { recursive: true });
  const out = path.join(targetDir, `${periodKey}.json`);
  await writeFile(out, payload, "utf8");
  return out;
}

export async function recordReportArtifact(input: {
  reportKey: string;
  bytes: Uint8Array;
  region?: string | null;
  ownerId?: number | null;
  parameters?: Record<string, unknown>;
  contentType?: string;
}) {
  const storage = getArtifactStorage();
  const contentType = input.contentType ?? "application/pdf";
  const key = `reports/${input.reportKey}/${Date.now()}.pdf`;
  const stored = await storage.put(key, input.bytes, contentType);
  const [row] = await db
    .insert(reportArtifacts)
    .values({
      reportKey: input.reportKey,
      checksum: stored.checksum,
      byteSize: stored.byteSize,
      contentType,
      storageKey: stored.storageKey,
      region: input.region ?? null,
      ownerId: input.ownerId ?? null,
      parameters: input.parameters ?? {},
    })
    .returning();
  return row;
}
