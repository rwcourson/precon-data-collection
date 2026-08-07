"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, estimateRounds, jobs, sheetRows, sheets } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import {
  listTrash,
  restoreEntity,
  softDeleteJob,
  softDeleteRound,
  softDeleteSheet,
  softDeleteSheetRow,
  createDataSnapshot,
  type TrashItem,
} from "@/lib/recovery";

function canManageTrash(role: string): boolean {
  return ["rpd", "corporate_admin", "admin_jsa"].includes(role);
}

export async function trashJob(jobId: number) {
  const user = await getCurrentUser();
  if (!canManageTrash(user.role)) throw new Error("Permission denied.");
  await softDeleteJob(jobId, user);
  await db.insert(auditLog).values({
    entity: "job",
    entityId: jobId,
    action: "soft_deleted",
    userId: user.id,
  });
  revalidatePath("/bid-schedule");
  revalidatePath("/trash");
}

export async function trashRound(roundId: number) {
  const user = await getCurrentUser();
  if (!canManageTrash(user.role)) throw new Error("Permission denied.");
  await softDeleteRound(roundId, user);
  await db.insert(auditLog).values({
    entity: "round",
    entityId: roundId,
    action: "soft_deleted",
    userId: user.id,
  });
  revalidatePath("/bid-schedule");
  revalidatePath("/trash");
}

export async function trashSheet(sheetId: number) {
  const user = await getCurrentUser();
  if (!canManageTrash(user.role)) throw new Error("Permission denied.");
  await softDeleteSheet(sheetId, user);
  revalidatePath("/sheets");
  revalidatePath("/trash");
}

export async function trashSheetRow(rowId: number) {
  const user = await getCurrentUser();
  if (!["rpd", "corporate_admin", "admin_jsa", "pcm", "estimate_lead"].includes(user.role)) {
    throw new Error("Permission denied.");
  }
  await softDeleteSheetRow(rowId, user);
  revalidatePath("/sheets");
  revalidatePath("/trash");
}

export async function restoreTrashItem(entityType: TrashItem["entityType"], entityId: number) {
  const user = await getCurrentUser();
  if (!canManageTrash(user.role)) throw new Error("Permission denied.");
  await restoreEntity(entityType, entityId);
  await db.insert(auditLog).values({
    entity: entityType,
    entityId,
    action: "restored",
    userId: user.id,
  });
  revalidatePath("/trash");
  revalidatePath("/bid-schedule");
  revalidatePath("/sheets");
}

export async function permanentlyDeleteTrashItem(
  entityType: TrashItem["entityType"],
  entityId: number,
  confirmation: string,
) {
  const user = await getCurrentUser();
  if (user.role !== "corporate_admin" && user.role !== "rpd") {
    throw new Error("Permission denied: permanent delete requires manager rights.");
  }
  if (confirmation !== "DELETE") {
    throw new Error('Type DELETE to permanently remove this item.');
  }

  if (entityType === "job") {
    await db.delete(estimateRounds).where(eq(estimateRounds.jobId, entityId));
    await db.delete(jobs).where(eq(jobs.id, entityId));
  } else if (entityType === "round") {
    await db.delete(estimateRounds).where(eq(estimateRounds.id, entityId));
  } else if (entityType === "sheet") {
    await db.delete(sheets).where(eq(sheets.id, entityId));
  } else {
    await db.delete(sheetRows).where(eq(sheetRows.id, entityId));
  }

  await db.insert(auditLog).values({
    entity: entityType,
    entityId,
    action: "permanently_deleted",
    userId: user.id,
  });
  revalidatePath("/trash");
}

export async function getTrashItems(region?: string | null) {
  await getCurrentUser();
  return listTrash(region);
}

export async function runSnapshotNow(periodKey?: string) {
  const user = await getCurrentUser();
  if (user.role !== "corporate_admin") {
    throw new Error("Permission denied.");
  }
  const key = periodKey ?? new Date().toISOString().slice(0, 10);
  return createDataSnapshot(key);
}
