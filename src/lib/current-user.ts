import { cookies, headers } from "next/headers";
import { db, ensureDbReady } from "@/db";
import { users } from "@/db/schema";
import { asc } from "drizzle-orm";
import type { User } from "@/db/schema";
import { authMode, readSsoIdentity, resolveSsoUser } from "./auth";

const COOKIE = "demo-user-id";

/**
 * Identity resolution. In production (`AUTH_MODE=sso`) the signed-in user comes
 * from the identity provider via the authenticating proxy. In demo mode the
 * role switcher sets a cookie and server code reads it here, falling back to
 * the first seeded persona (PCM).
 */
export async function getCurrentUser(): Promise<User> {
  await ensureDbReady();

  if (authMode() === "sso") {
    const identity = readSsoIdentity(await headers());
    if (!identity) throw new Error("Not signed in.");
    return resolveSsoUser(identity);
  }

  const store = await cookies();
  const id = Number(store.get(COOKIE)?.value);
  const all = await db.select().from(users).orderBy(asc(users.id));
  if (all.length === 0) {
    throw new Error("No users seeded — run `npm run db:seed` first.");
  }
  return all.find((u) => u.id === id) ?? all[0];
}

export async function getAllUsers(): Promise<User[]> {
  await ensureDbReady();
  return db.select().from(users).orderBy(asc(users.id));
}

export const DEMO_USER_COOKIE = COOKIE;
