"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { appSettings, auditLog } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import {
  DEFAULT_SETTINGS,
  getNotificationSettings,
  runReminderSweep,
  SETTINGS_KEY,
  type NotificationSettings,
  type SweepResult,
} from "@/lib/reminders";

function assertAdmin(role: string) {
  if (!["corporate_admin", "rpd"].includes(role))
    throw new Error("Only the Corporate Precon Admin or an RPD can change notification settings.");
}

export async function saveNotificationSettings(next: Partial<NotificationSettings>) {
  const user = await getCurrentUser();
  assertAdmin(user.role);

  const current = await getNotificationSettings();
  const merged: NotificationSettings = {
    ...DEFAULT_SETTINGS,
    ...current,
    ...next,
    graceDays: clampDays(next.graceDays ?? current.graceDays, 0, 60),
    escalateAfterDays: clampDays(next.escalateAfterDays ?? current.escalateAfterDays, 1, 180),
  };

  await db
    .insert(appSettings)
    .values({ key: SETTINGS_KEY, value: merged, updatedById: user.id, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: merged, updatedById: user.id, updatedAt: new Date() },
    });

  await db.insert(auditLog).values({
    entity: "settings",
    action: "notification_settings_updated",
    field: "cadence",
    oldValue: current.cadence,
    newValue: merged.cadence,
    userId: user.id,
  });

  revalidatePath("/admin");
  return merged;
}

export async function runRemindersNow(): Promise<SweepResult> {
  const user = await getCurrentUser();
  assertAdmin(user.role);
  const result = await runReminderSweep({ force: true });
  revalidatePath("/admin");
  revalidatePath("/", "layout");
  return result;
}

const clampDays = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min;
