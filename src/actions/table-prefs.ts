"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { BID_SCHEDULE_SURFACE } from "@/lib/table-prefs";
import { tablePrefsService } from "@/services/table-prefs-service";

const prefsPatchSchema = z.object({
  columns: z.array(z.string()).optional(),
  density: z.enum(["summary", "detail"]).optional(),
  viewMode: z.enum(["table", "cards", "gantt"]).optional(),
  columnWidths: z.record(z.string(), z.number()).optional(),
  defaultViewId: z.number().int().positive().nullable().optional(),
});

const defaultViewSchema = z.object({
  viewId: z.number().int().positive().nullable(),
});

export async function saveBidScheduleTablePrefs(raw: unknown) {
  const patch = prefsPatchSchema.parse(raw);
  const principal = await getWebPrincipal();
  return tablePrefsService.save(principal, BID_SCHEDULE_SURFACE, patch);
}

export async function resetBidScheduleTablePrefs() {
  const principal = await getWebPrincipal();
  await tablePrefsService.reset(principal, BID_SCHEDULE_SURFACE);
  revalidatePath("/bid-schedule");
}

export async function setBidScheduleDefaultView(raw: unknown) {
  const { viewId } = defaultViewSchema.parse(raw);
  const principal = await getWebPrincipal();
  const next = await tablePrefsService.setDefaultView(principal, viewId);
  revalidatePath("/bid-schedule");
  return next;
}
