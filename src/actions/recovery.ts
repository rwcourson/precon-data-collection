"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import type { Principal } from "@/lib/authorization/types";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import {
  createDataSnapshot,
  listTrash,
  permanentDelete,
  restoreEntity,
  softDeleteJob,
  softDeleteRound,
  softDeleteSheet,
  softDeleteSheetRow,
  type TrashItem,
} from "@/lib/recovery";

export async function trashJob(jobId: number, principal?: Principal) {
  const actor = principal ?? (await getWebPrincipal());
  await softDeleteJob(actor, jobId);
  await db.insert(auditLog).values({
    entity: "job",
    entityId: jobId,
    action: "soft_deleted",
    userId: actor.user.id,
  });
  revalidatePath("/bid-schedule");
  revalidatePath("/trash");
}

export async function trashRound(roundId: number, principal?: Principal) {
  const actor = principal ?? (await getWebPrincipal());
  await softDeleteRound(actor, roundId);
  await db.insert(auditLog).values({
    entity: "round",
    entityId: roundId,
    action: "soft_deleted",
    userId: actor.user.id,
  });
  revalidatePath("/bid-schedule");
  revalidatePath("/trash");
}

export async function trashSheet(sheetId: number, principal?: Principal) {
  const actor = principal ?? (await getWebPrincipal());
  await softDeleteSheet(actor, sheetId);
  revalidatePath("/sheets");
  revalidatePath("/trash");
}

export async function trashSheetRow(rowId: number, principal?: Principal) {
  const actor = principal ?? (await getWebPrincipal());
  await softDeleteSheetRow(actor, rowId);
  revalidatePath("/sheets");
  revalidatePath("/trash");
}

export async function restoreTrashItem(
  entityType: TrashItem["entityType"],
  entityId: number,
  principal?: Principal
) {
  const actor = principal ?? (await getWebPrincipal());
  await restoreEntity(actor, entityType, entityId);
  await db.insert(auditLog).values({
    entity: entityType,
    entityId,
    action: "restored",
    userId: actor.user.id,
  });
  revalidatePath("/trash");
  revalidatePath("/bid-schedule");
  revalidatePath("/sheets");
}

/**
 * Permanent delete of an already soft-deleted item.
 * Requires corporate_admin, typed "PERMANENTLY DELETE", FK-safe cleanup,
 * and for API callers a consumed one-time destructive challenge.
 */
export async function permanentlyDeleteTrashItem(
  entityType: TrashItem["entityType"],
  entityId: number,
  confirmation: string,
  principal?: Principal,
  apiDestructive?: {
    token: import("@/db/schema").ApiToken;
    challenge: string;
  } | null,
  options?: { requireApiChallenge?: boolean }
) {
  const actor = principal ?? (await getWebPrincipal());
  await permanentDelete({
    principal: actor,
    entityType,
    entityId,
    confirmation,
    apiDestructive: apiDestructive ?? null,
    requireApiChallenge: options?.requireApiChallenge ?? false,
  });
  await db.insert(auditLog).values({
    entity: entityType,
    entityId,
    action: "permanently_deleted",
    userId: actor.user.id,
  });
  revalidatePath("/trash");
}

export async function getTrashItems(principal?: Principal) {
  const actor = principal ?? (await getWebPrincipal());
  return listTrash(actor);
}

export async function runSnapshotNow(periodKey?: string) {
  const principal = await getWebPrincipal();
  if (principal.user.role !== "corporate_admin") {
    throw new Error("Permission denied.");
  }
  const key = periodKey ?? new Date().toISOString().slice(0, 10);
  return createDataSnapshot(key);
}
