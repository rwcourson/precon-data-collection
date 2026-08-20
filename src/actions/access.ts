"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { appSettings, auditLog, type Role } from "@/db/schema";
import {
  ACCESS_SETTINGS_KEY,
  type AccessSettings,
  DEFAULT_ACCESS,
  getAccessSettings,
} from "@/lib/auth";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { assertPrincipalAdmin } from "@/services/mutation-policy";

const ROLES: Role[] = [
  "pcm",
  "estimate_lead",
  "admin_jsa",
  "rpd",
  "leadership",
  "corporate_admin",
];

async function assertCorporateAdmin() {
  const principal = await getWebPrincipal();
  assertPrincipalAdmin(principal, "access", "manage", "Access mapping");
  return principal.user;
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
  const roleMap = (
    values: Record<string, Role> | undefined
  ): Record<string, Role> => {
    const out: Record<string, Role> = {};
    for (const [rawKey, role] of Object.entries(values ?? {})) {
      const key = rawKey.trim().toLowerCase();
      if (key && ROLES.includes(role)) out[key] = role;
    }
    return out;
  };
  const regionMap = (
    values: Record<string, string> | undefined
  ): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [rawKey, region] of Object.entries(values ?? {})) {
      const key = rawKey.trim().toLowerCase();
      if (key && region.trim()) out[key] = region.trim();
    }
    return out;
  };

  const merged: AccessSettings = {
    groupRoles,
    groupRegions,
    titleRoles: roleMap(next.titleRoles),
    managerRoles: roleMap(next.managerRoles),
    emailRoles: roleMap(next.emailRoles),
    emailRegions: regionMap(next.emailRegions),
    defaultRole: ROLES.includes(next.defaultRole)
      ? next.defaultRole
      : DEFAULT_ACCESS.defaultRole,
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
