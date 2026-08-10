"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { authMode } from "@/lib/auth";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { DEMO_USER_COOKIE, getCurrentUser } from "@/lib/current-user";
import {
  canViewCorporate,
  CORPORATE,
  resolveWorkspace,
  WORKSPACE_COOKIE,
} from "@/lib/workspace";
import { and, eq, isNull } from "drizzle-orm";

export async function switchUser(userId: number) {
  if (getRuntimeConfig().appEnv !== "demo" || authMode() !== "demo") {
    throw new Error("Personas are a demo feature — identity comes from SSO here.");
  }
  const store = await cookies();
  store.set(DEMO_USER_COOKIE, String(userId), { path: "/" });
  // A new persona has its own Region, so the workspace must re-resolve.
  store.delete(WORKSPACE_COOKIE);
  revalidatePath("/", "layout");
}

/** Switch the active Region workspace; `corporate` means all Regions. */
export async function switchWorkspace(region: string) {
  const user = await getCurrentUser();
  const allowed =
    region === CORPORATE
      ? canViewCorporate(user)
      : resolveWorkspace(user, region).region === region;
  if (!allowed) throw new Error("You do not have access to that Region workspace.");

  const store = await cookies();
  store.set(WORKSPACE_COOKIE, region, { path: "/" });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  revalidatePath("/", "layout");
}
