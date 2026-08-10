"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { appSettings, auditLog, type Role } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import {
  ACCESS_SETTINGS_KEY,
  DEFAULT_ACCESS,
  getAccessSettings,
  type AccessSettings,
} from "@/lib/auth";

const ROLES: Role[] = [
  "pcm",
  "estimate_lead",
  "admin_jsa",
  "rpd",
  "leadership",
  "corporate_admin",
];

async function assertCorporateAdmin() {
  const user = await getCurrentUser();
  const { isCorporateAdmin } = await import("@/lib/super-admin");
  if (!isCorporateAdmin(user))
    throw new Error("Only the Corporate Precon Admin can change identity mappings.");
  return user;
}

/**
 * Group mappings are edited here rather than in code so a new IdP group can be
 * onboarded without a deploy — the same reason B&G wanted user-managed columns.
 */
export async function saveAccessSettings(next: AccessSettings) {
  const user = await assertCorporateAdmin();
  const current = await getAccessSettings();

  const groupRoles: Record<string, Role> = {};
  for (const [group, role] of Object.entries(next.groupRoles ?? {})) {
    const key = group.trim();
    if (key && ROLES.includes(role)) groupRoles[key] = role;
  }
  const groupRegions: Record<string, string> = {};
  for (const [group, region] of Object.entries(next.groupRegions ?? {})) {
    const key = group.trim();
    if (key && region.trim()) groupRegions[key] = region.trim();
  }

  const merged: AccessSettings = {
    groupRoles,
    groupRegions,
    defaultRole: ROLES.includes(next.defaultRole) ? next.defaultRole : DEFAULT_ACCESS.defaultRole,
  };

  await db
    .insert(appSettings)
    .values({
      key: ACCESS_SETTINGS_KEY,
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
    action: "access_mapping_updated",
    field: "group mappings",
    oldValue: `${Object.keys(current.groupRoles).length} role, ${Object.keys(current.groupRegions).length} region`,
    newValue: `${Object.keys(merged.groupRoles).length} role, ${Object.keys(merged.groupRegions).length} region`,
    userId: user.id,
  });

  revalidatePath("/admin");
  return merged;
}
