"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { reportScheduleService } from "@/services/report-schedule-service";

const createSchema = z.object({
  savedReportId: z.number().int().positive(),
  weekday: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  timezone: z.string().min(1).optional(),
});

const listIdSchema = z.object({
  listId: z.number().int().positive(),
});

export async function listMyReportSchedules() {
  const principal = await getWebPrincipal();
  const rows = await reportScheduleService.listMine(principal);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    savedReportId: row.savedReportId,
    weekday: row.weekday,
    hour: row.hour,
    timezone: row.timezone,
    paused: row.paused,
    lastSentAt: row.lastSentAt?.toISOString() ?? null,
    lastPeriodKey: row.lastPeriodKey,
  }));
}

export async function createReportSchedule(raw: unknown) {
  const input = createSchema.parse(raw);
  const principal = await getWebPrincipal();
  const row = await reportScheduleService.create(principal, input);
  revalidatePath("/reports");
  return { id: row.id };
}

export async function pauseReportSchedule(raw: unknown) {
  const { listId } = listIdSchema.parse(raw);
  const principal = await getWebPrincipal();
  await reportScheduleService.setPaused(principal, listId, true);
  revalidatePath("/reports");
}

export async function resumeReportSchedule(raw: unknown) {
  const { listId } = listIdSchema.parse(raw);
  const principal = await getWebPrincipal();
  await reportScheduleService.setPaused(principal, listId, false);
  revalidatePath("/reports");
}

export async function deleteReportSchedule(raw: unknown) {
  const { listId } = listIdSchema.parse(raw);
  const principal = await getWebPrincipal();
  await reportScheduleService.remove(principal, listId);
  revalidatePath("/reports");
}
