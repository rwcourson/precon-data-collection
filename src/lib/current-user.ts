import { cache } from "react";
import { cookies, headers } from "next/headers";
import { db, ensureDbReady } from "@/db";
import { users } from "@/db/schema";
import { asc } from "drizzle-orm";
import type { User } from "@/db/schema";
import { authMode, resolveSsoUser } from "./auth";
import { getMobileContext } from "./mobile-context";
import { auth } from "@/lib/auth-server";
import {
  identityFromBetterAuthUser,
  microsoftProfileFromAccount,
} from "@/lib/sso-session";
import { pickDefaultDemoUser } from "@/lib/demo-identity";

const COOKIE = "demo-user-id";

/**
 * Identity resolution, memoized per request with React.cache so layout,
 * header, and page renders share one session/user lookup.
 * - SSO: Better Auth Microsoft session → app `users` via email + Entra profile.
 * - Demo: persona cookie / first seeded user.
 * - Mobile REST: AsyncLocalStorage principal.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<User> {
  await ensureDbReady();

  const mobile = getMobileContext();
  if (mobile?.user) return mobile.user;

  if (authMode() === "sso") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      throw new Error("Not signed in.");
    }

    const profile = await microsoftProfileFromAccount(session.user.id);
    const email = (
      session.user.email ||
      profile.email ||
      ""
    )
      .trim()
      .toLowerCase();
    if (!email) {
      throw new Error("Not signed in — Microsoft session has no email claim.");
    }

    const name =
      (profile.displayName && profile.displayName.trim()) ||
      session.user.name ||
      email;

    const identity = identityFromBetterAuthUser({
      email,
      name,
      groups: profile.groups,
      title: profile.jobTitle,
    });
    return resolveSsoUser(identity);
  }

  // Defense in depth: runtime-config already rejects demo auth on hosted
  // production, but never resolve a cookie-selected identity there either.
  // Preview deployments run demo personas behind Vercel Authentication.
  if (
    process.env.VERCEL_ENV === "production" ||
    (process.env.VERCEL && !process.env.VERCEL_ENV)
  ) {
    throw new Error("Demo authentication is forbidden on hosted production deployments.");
  }

  const store = await cookies();
  const id = Number(store.get(COOKIE)?.value);
  const all = await db.select().from(users).orderBy(asc(users.id));
  if (all.length === 0) {
    throw new Error("No users seeded — run `npm run db:seed` first.");
  }
  return all.find((u) => u.id === id) ?? pickDefaultDemoUser(all);
});

export const getAllUsers = cache(async function getAllUsers(): Promise<User[]> {
  await ensureDbReady();
  return db.select().from(users).orderBy(asc(users.id));
});

export const DEMO_USER_COOKIE = COOKIE;
