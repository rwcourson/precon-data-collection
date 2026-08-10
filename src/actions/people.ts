"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, users, type Role, type User } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { canManagePeople, ROLE_LABELS } from "@/lib/permissions";
import { isSuperAdmin, isSuperAdminEmail } from "@/lib/super-admin";
import { REFERENCE_LISTS } from "@/lib/reference-data";

const ROLES: Role[] = [
  "pcm",
  "estimate_lead",
  "admin_jsa",
  "rpd",
  "leadership",
  "corporate_admin",
];

export type PeopleRow = {
  id: number;
  name: string;
  email: string;
  title: string;
  role: Role;
  region: string | null;
  isSuperAdmin: boolean;
};

export async function listPeople(): Promise<PeopleRow[]> {
  const me = await getCurrentUser();
  if (!canManagePeople(me)) throw new Error("Permission denied.");

  const rows = await db.select().from(users).orderBy(users.name);
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    title: u.title,
    role: u.role,
    region: u.region,
    isSuperAdmin: isSuperAdminEmail(u.email),
  }));
}

export async function updatePersonRole(input: {
  userId: number;
  role: Role;
  region: string | null;
}): Promise<User> {
  const me = await getCurrentUser();
  if (!canManagePeople(me)) throw new Error("Permission denied.");
  if (!ROLES.includes(input.role)) throw new Error("Invalid role.");

  const regions = REFERENCE_LISTS.region.values;
  if (input.region && !regions.includes(input.region)) {
    throw new Error("Invalid region.");
  }

  // Corporate / super admins are cross-region; region roles need a region.
  const regionBound: Role[] = ["pcm", "estimate_lead", "admin_jsa", "rpd"];
  let region = input.region;
  if (input.role === "corporate_admin" || input.role === "leadership") {
    region = null;
  } else if (regionBound.includes(input.role) && !region) {
    throw new Error(`${ROLE_LABELS[input.role]} requires a Region.`);
  }

  const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!target) throw new Error("User not found.");

  // Super-admin emails cannot be demoted or reassigned by anyone (including self demote).
  if (isSuperAdminEmail(target.email)) {
    if (input.role !== "corporate_admin" || region !== null) {
      throw new Error("Platform super admins cannot be demoted or region-scoped.");
    }
  }

  // Only super admins may grant corporate_admin to others (prevents privilege sprawl).
  if (input.role === "corporate_admin" && !isSuperAdmin(me) && target.role !== "corporate_admin") {
    throw new Error("Only a platform super admin can grant Corporate Precon Admin.");
  }

  const [updated] = await db
    .update(users)
    .set({ role: input.role, region })
    .where(eq(users.id, input.userId))
    .returning();

  await db.insert(auditLog).values({
    entity: "user",
    entityId: target.id,
    action: "role_updated",
    field: "role/region",
    oldValue: `${target.role}${target.region ? ` · ${target.region}` : ""}`,
    newValue: `${updated.role}${updated.region ? ` · ${updated.region}` : ""}`,
    userId: me.id,
  });

  revalidatePath("/admin");
  return updated;
}
