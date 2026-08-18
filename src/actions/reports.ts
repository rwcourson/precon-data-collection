"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { type SavedReportConfig, savedReports } from "@/db/schema";
import { loadReportForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { getFlatDataset } from "@/lib/export-helpers";
import { type ReportResult, runReportEngine } from "@/lib/report-engine";

export async function runReport(
  config: SavedReportConfig
): Promise<ReportResult> {
  const principal = await getWebPrincipal();
  const { rows, catalog } = await getFlatDataset(principal);
  const result = runReportEngine(rows, config, catalog);
  return { ...result, rows: result.rows.slice(0, 500) };
}

export async function saveReport(
  name: string,
  config: SavedReportConfig,
  existingId?: number
) {
  const principal = await getWebPrincipal();
  const user = principal.user;
  if (!name.trim()) throw new Error("Report name is required");

  if (existingId) {
    const loaded = await loadReportForPrincipal(principal, existingId, "edit");
    if (!loaded) throw new Error("Report not found");
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
  const principal = await getWebPrincipal();
  const loaded = await loadReportForPrincipal(principal, id, "edit");
  if (!loaded) return;
  await db.delete(savedReports).where(eq(savedReports.id, id));
  revalidatePath("/reports");
}

export async function shareReport(
  id: number,
  sharedWithRegions: string[],
  sharedWithUserIds: number[]
) {
  const principal = await getWebPrincipal();
  const loaded = await loadReportForPrincipal(principal, id, "manage");
  if (!loaded) throw new Error("Report not found");
  await db
    .update(savedReports)
    .set({ sharedWithRegions, sharedWithUserIds, updatedAt: new Date() })
    .where(eq(savedReports.id, id));
  revalidatePath("/reports");
}
