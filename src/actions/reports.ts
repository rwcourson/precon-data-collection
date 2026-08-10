"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { savedReports, type SavedReportConfig } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { getFlatDataset } from "@/lib/export-helpers";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import {
  runReportEngine,
  type ReportResult,
} from "@/lib/report-engine";

export async function runReport(config: SavedReportConfig): Promise<ReportResult> {
  const principal = await getWebPrincipal();
  const { rows, catalog } = await getFlatDataset(principal);
  const result = runReportEngine(rows, config, catalog);
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
