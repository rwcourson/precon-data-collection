import { and, eq, isNull } from "drizzle-orm";
import { db, ensureDbReady } from "@/db";
import { apiTokens, type User, users } from "@/db/schema";
import { type AuthedToken, authenticateBearer } from "@/lib/api-auth";
import { generateApiTokenSecret, tokenIsExpired } from "@/lib/api-tokens";
import { createPrincipal } from "@/lib/authorization/principal";
import type { Principal } from "@/lib/authorization/types";
import { getRuntimeConfig } from "@/lib/runtime-config";

const MOBILE_ALL_SCOPES = [
  "profile:read",
  "read:pursuits",
  "read:reports",
  "read:dashboards",
  "read:sheets",
  "read:notifications",
  "read:admin",
  "read:trash",
  "write:pursuits",
  "write:reports",
  "write:dashboards",
  "write:sheets",
  "write:notifications",
  "write:admin",
  "write:trash",
  "write:destructive",
  "integrate:connect",
  "admin:tokens",
] as const;

export type MobilePrincipal = {
  user: User;
  token: AuthedToken;
  source: "demo_session" | "api_token";
  authorization: Principal;
};

export function isDemoAuthAllowed(): boolean {
  const config = getRuntimeConfig();
  return config.appEnv === "demo" && config.authMode === "demo";
}

export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    title: user.title,
    role: user.role,
    region: user.region,
    preconDepartment: user.preconDepartment,
    email: user.email,
  };
}

/**
 * Issue (or reuse) a demo mobile session token bound to a persona via
 * createdById. Only valid when AUTH_MODE=demo.
 */
export async function issueDemoSession(
  userId: number
): Promise<
  { token: string; user: User } | { error: string; status: 403 | 404 }
> {
  await ensureDbReady();
  if (!isDemoAuthAllowed()) {
    return {
      error: "Demo auth is disabled (AUTH_MODE is not demo).",
      status: 403,
    };
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return { error: "User not found", status: 404 };

  const sessionName = `mobile-demo-session:${userId}`;
  const existing = await db
    .select()
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.createdById, userId),
        eq(apiTokens.name, sessionName),
        isNull(apiTokens.revokedAt)
      )
    );

  // Always mint a fresh secret so we can return plaintext once; revoke prior.
  for (const row of existing) {
    await db
      .update(apiTokens)
      .set({ revokedAt: new Date() })
      .where(eq(apiTokens.id, row.id));
  }

  const secret = generateApiTokenSecret();
  await db.insert(apiTokens).values({
    name: sessionName,
    tokenHash: secret.hash,
    tokenPrefix: secret.prefix,
    scopes: [...MOBILE_ALL_SCOPES],
    regionAllowlist: [],
    createdById: userId,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  });

  return { token: secret.plaintext, user };
}

/**
 * Resolve Authorization bearer into a User principal.
 * Demo sessions and personal API tokens both map to createdById.
 */
export async function resolveMobilePrincipal(
  authHeader: string | null
): Promise<
  | { ok: true; principal: MobilePrincipal }
  | { ok: false; status: 401 | 403; error: string }
> {
  await ensureDbReady();
  const auth = await authenticateBearer(authHeader);
  if (!auth.ok) return auth;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, auth.token.createdById));
  if (!user) {
    return { ok: false, status: 401, error: "Token owner not found" };
  }
  if (tokenIsExpired(auth.token.expiresAt)) {
    return { ok: false, status: 401, error: "Token expired" };
  }

  const source = auth.token.name.startsWith("mobile-demo-session:")
    ? ("demo_session" as const)
    : ("api_token" as const);
  if (source === "demo_session" && !isDemoAuthAllowed()) {
    return { ok: false, status: 401, error: "Demo session is disabled" };
  }

  return {
    ok: true,
    principal: {
      user,
      token: auth.token,
      source,
      authorization: createPrincipal({
        user,
        authSource: source,
        workspaceRegion: user.region,
        token: auth.token,
      }),
    },
  };
}

/** Pure helper for tests: demo gate predicate. */
export function demoAuthGate(mode: "demo" | "sso"): {
  allowed: boolean;
  reason?: string;
} {
  if (mode !== "demo") {
    return {
      allowed: false,
      reason: "Demo auth is disabled (AUTH_MODE is not demo).",
    };
  }
  return { allowed: true };
}
