"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { appSettings, auditLog } from "@/db/schema";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import {
  DEFAULT_SETTINGS,
  getNotificationSettings,
  type NotificationSettings,
  runReminderSweep,
  SETTINGS_KEY,
  type SweepResult,
} from "@/lib/reminders";
import { assertPrincipalAdmin } from "@/services/mutation-policy";

export async function saveNotificationSettings(
  next: Partial<NotificationSettings>
) {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(
    principal,
    "notifications",
    "edit",
    "Notification settings"
  );
  const user = principal.user;

  const current = await getNotificationSettings();
  const merged: NotificationSettings = {
    ...DEFAULT_SETTINGS,
    ...current,
    ...next,
    graceDays: clampDays(next.graceDays ?? current.graceDays, 0, 60),
    escalateAfterDays: clampDays(
      next.escalateAfterDays ?? current.escalateAfterDays,
      1,
      180
    ),
  };

  await db
    .insert(appSettings)
    .values({
      key: SETTINGS_KEY,
      value: merged,
      updatedById: user.id,
      updatedAt: new Date(),
    })
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
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(
    principal,
    "notifications",
    "edit",
    "Notification settings"
  );
  const result = await runReminderSweep({ force: true });
  revalidatePath("/admin");
  revalidatePath("/", "layout");
  return result;
}

const clampDays = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min;
