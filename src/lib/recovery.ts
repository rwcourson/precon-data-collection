import "server-only";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { createHash } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { db } from "@/db";
import {
  dataSnapshots,
  entityVersions,
  estimateRounds,
  jobs,
  sheetRows,
  sheets,
  type User,
} from "@/db/schema";

const TRASH_RETENTION_DAYS = 30;

export type TrashItem = {
  entityType: "job" | "round" | "sheet" | "sheet_row";
  entityId: number;
  name: string;
  deletedAt: Date;
  deletedById: number | null;
  retentionDeadline: Date;
};

function deadline(deletedAt: Date): Date {
  const d = new Date(deletedAt);
  d.setDate(d.getDate() + TRASH_RETENTION_DAYS);
  return d;
}

export async function softDeleteJob(jobId: number, user: User): Promise<void> {
  const now = new Date();
  await db
    .update(jobs)
    .set({ deletedAt: now, deletedById: user.id })
    .where(and(eq(jobs.id, jobId), isNull(jobs.deletedAt)));
  await db
    .update(estimateRounds)
    .set({ deletedAt: now, deletedById: user.id })
    .where(and(eq(estimateRounds.jobId, jobId), isNull(estimateRounds.deletedAt)));
}

export async function softDeleteRound(roundId: number, user: User): Promise<void> {
  await db
    .update(estimateRounds)
    .set({ deletedAt: new Date(), deletedById: user.id })
    .where(and(eq(estimateRounds.id, roundId), isNull(estimateRounds.deletedAt)));
}

export async function softDeleteSheet(sheetId: number, user: User): Promise<void> {
  await db
    .update(sheets)
    .set({ deletedAt: new Date(), deletedById: user.id })
    .where(and(eq(sheets.id, sheetId), isNull(sheets.deletedAt)));
}

export async function softDeleteSheetRow(rowId: number, user: User): Promise<void> {
  await db
    .update(sheetRows)
    .set({ deletedAt: new Date(), deletedById: user.id })
    .where(and(eq(sheetRows.id, rowId), isNull(sheetRows.deletedAt)));
}

export async function restoreEntity(
  entityType: TrashItem["entityType"],
  entityId: number,
): Promise<void> {
  if (entityType === "job") {
    await db
      .update(jobs)
      .set({ deletedAt: null, deletedById: null })
      .where(eq(jobs.id, entityId));
    await db
      .update(estimateRounds)
      .set({ deletedAt: null, deletedById: null })
      .where(eq(estimateRounds.jobId, entityId));
    return;
  }
  if (entityType === "round") {
    await db
      .update(estimateRounds)
      .set({ deletedAt: null, deletedById: null })
      .where(eq(estimateRounds.id, entityId));
    return;
  }
  if (entityType === "sheet") {
    await db
      .update(sheets)
      .set({ deletedAt: null, deletedById: null })
      .where(eq(sheets.id, entityId));
    return;
  }
  await db
    .update(sheetRows)
    .set({ deletedAt: null, deletedById: null })
    .where(eq(sheetRows.id, entityId));
}

export async function listTrash(region?: string | null): Promise<TrashItem[]> {
  const [jobRows, roundRows, sheetRowsList] = await Promise.all([
    db.select().from(jobs).where(isNotNull(jobs.deletedAt)),
    db.select().from(estimateRounds).where(isNotNull(estimateRounds.deletedAt)),
    db.select().from(sheets).where(isNotNull(sheets.deletedAt)),
  ]);

  const items: TrashItem[] = [];
  for (const j of jobRows) {
    if (region && j.region !== region) continue;
    if (!j.deletedAt) continue;
    items.push({
      entityType: "job",
      entityId: j.id,
      name: `${j.jobNumber} — ${j.jobName}`,
      deletedAt: j.deletedAt,
      deletedById: j.deletedById,
      retentionDeadline: deadline(j.deletedAt),
    });
  }
  for (const r of roundRows) {
    if (region && r.region !== region) continue;
    if (!r.deletedAt) continue;
    items.push({
      entityType: "round",
      entityId: r.id,
      name: `Round #${r.roundNumber} (${r.estimatePhase})`,
      deletedAt: r.deletedAt,
      deletedById: r.deletedById,
      retentionDeadline: deadline(r.deletedAt),
    });
  }
  for (const s of sheetRowsList) {
    if (region && s.region && s.region !== region) continue;
    if (!s.deletedAt) continue;
    items.push({
      entityType: "sheet",
      entityId: s.id,
      name: s.name,
      deletedAt: s.deletedAt,
      deletedById: s.deletedById,
      retentionDeadline: deadline(s.deletedAt),
    });
  }
  return items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

export async function appendEntityVersion(
  entityType: string,
  entityId: number,
  snapshot: Record<string, unknown>,
  userId: number | null,
): Promise<void> {
  const existing = await db
    .select({ version: entityVersions.version })
    .from(entityVersions)
    .where(
      and(eq(entityVersions.entityType, entityType), eq(entityVersions.entityId, entityId)),
    );
  const next = existing.reduce((m, r) => Math.max(m, r.version), 0) + 1;
  await db.insert(entityVersions).values({
    entityType,
    entityId,
    version: next,
    snapshot,
    changedById: userId,
  });
}

/** Local filesystem snapshot port — ready to swap for object storage. */
export async function createDataSnapshot(periodKey: string): Promise<{
  id: number;
  checksum: string;
  storageKey: string;
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
    };
  }

  const [jobCount, roundCount] = await Promise.all([
    db.select().from(jobs).where(isNull(jobs.deletedAt)),
    db.select().from(estimateRounds).where(isNull(estimateRounds.deletedAt)),
  ]);

  const payload = JSON.stringify({
    periodKey,
    jobs: jobCount.length,
    rounds: roundCount.length,
    capturedAt: new Date().toISOString(),
  });
  const checksum = createHash("sha256").update(payload).digest("hex");
  const dir = path.join(process.cwd(), ".data", "snapshots");
  await mkdir(dir, { recursive: true });
  const storageKey = `snapshots/${periodKey}.json`;
  const filePath = path.join(dir, `${periodKey}.json`);
  await writeFile(filePath, payload, "utf8");

  const [row] = await db
    .insert(dataSnapshots)
    .values({
      periodKey,
      storageKey,
      checksum,
      byteSize: Buffer.byteLength(payload),
      manifest: {
        jobs: jobCount.length,
        rounds: roundCount.length,
        path: storageKey,
      },
    })
    .returning();

  return { id: row.id, checksum, storageKey };
}

export async function readSnapshotPayload(periodKey: string): Promise<string | null> {
  try {
    return await readFile(
      path.join(process.cwd(), ".data", "snapshots", `${periodKey}.json`),
      "utf8",
    );
  } catch {
    return null;
  }
}
