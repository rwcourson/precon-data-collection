"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { savedReports, type SavedReportConfig } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import {
  getAllCustomColumns,
  getCustomValuesForRounds,
  getMultiValuesForRounds,
  getRoundsWithJobs,
} from "@/lib/queries";
import {
  buildFieldCatalog,
  flattenRound,
  runReportEngine,
  type ReportResult,
} from "@/lib/report-engine";
import { getWorkspace } from "@/lib/workspace-server";

export async function runReport(config: SavedReportConfig): Promise<ReportResult> {
  const workspace = await getWorkspace();
  const [rows, customCols] = await Promise.all([
    getRoundsWithJobs(workspace),
    getAllCustomColumns(),
  ]);
  const ids = rows.map((r) => r.round.id);
  const [multiMap, customMap] = await Promise.all([
    getMultiValuesForRounds(ids),
    getCustomValuesForRounds(ids),
  ]);

  const flat = rows.map((r) =>
    flattenRound(
      r.round,
      r.job,
      r.estimateLeadName,
      multiMap.get(r.round.id) ?? {},
      customMap.get(r.round.id) ?? {},
    ),
  );
  const catalog = buildFieldCatalog(customCols);
  const result = runReportEngine(flat, config, catalog);
  // Cap on-screen rows for responsiveness
  return { ...result, rows: result.rows.slice(0, 500) };
}

export async function saveReport(
  name: string,
  config: SavedReportConfig,
  existingId?: number,
) {
  const user = await getCurrentUser();
  if (!name.trim()) throw new Error("Report name is required");

  if (existingId) {
    const [existing] = await db
      .select()
      .from(savedReports)
      .where(eq(savedReports.id, existingId));
    if (!existing) throw new Error("Report not found");
    if (existing.ownerId !== user.id)
      throw new Error("Only the report owner can modify it");
    await db
      .update(savedReports)
      .set({ name: name.trim(), config, updatedAt: new Date() })
      .where(eq(savedReports.id, existingId));
    revalidatePath("/reports");
    return existingId;
  }

  const [row] = await db
    .insert(savedReports)
    .values({ name: name.trim(), ownerId: user.id, config })
    .returning();
  revalidatePath("/reports");
  return row.id;
}

export async function deleteReport(id: number) {
  const user = await getCurrentUser();
  const [existing] = await db.select().from(savedReports).where(eq(savedReports.id, id));
  if (!existing) return;
  if (existing.ownerId !== user.id) throw new Error("Only the report owner can delete it");
  await db.delete(savedReports).where(eq(savedReports.id, id));
  revalidatePath("/reports");
}

export async function shareReport(
  id: number,
  sharedWithRegions: string[],
  sharedWithUserIds: number[],
) {
  const user = await getCurrentUser();
  const [existing] = await db.select().from(savedReports).where(eq(savedReports.id, id));
  if (!existing) throw new Error("Report not found");
  if (existing.ownerId !== user.id) throw new Error("Only the report owner can share it");
  await db
    .update(savedReports)
    .set({ sharedWithRegions, sharedWithUserIds, updatedAt: new Date() })
    .where(eq(savedReports.id, id));
  revalidatePath("/reports");
}
