import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, users, type User } from "@/db/schema";
import {
  DEFAULT_ACCESS,
  mapIdentity,
  type AccessSettings,
  type SsoIdentity,
} from "@/lib/access-map";

/**
 * Identity seam between the demo persona switcher and B&G's identity provider
 * (BRD Section 3). Nothing here talks to an IdP directly: the app is expected to sit
 * behind the same authenticating reverse proxy B&G already runs, which
 * terminates SSO and forwards the signed-in identity as request headers. That
 * keeps the app free of a second credential store while making the cutover a
 * configuration change rather than a rewrite.
 *
 * The proxy MUST strip these headers from inbound client requests — otherwise
 * anyone could name themselves Corporate Precon Admin. `src/proxy.ts` refuses
 * to serve SSO mode over a non-forwarded request as a second line of defence.
 */

export type AuthMode = "demo" | "sso";

export const ACCESS_SETTINGS_KEY = "access";

export type { AccessSettings, SsoIdentity };
export { DEFAULT_ACCESS, mapIdentity };

/** Header names, overridable because every proxy spells these differently. */
export const SSO_HEADERS = {
  email: process.env.SSO_EMAIL_HEADER ?? "x-forwarded-email",
  name: process.env.SSO_NAME_HEADER ?? "x-forwarded-preferred-username",
  groups: process.env.SSO_GROUPS_HEADER ?? "x-forwarded-groups",
} as const;

export function authMode(): AuthMode {
  return process.env.AUTH_MODE === "sso" ? "sso" : "demo";
}

/** Reads the forwarded identity, or null when the proxy sent nothing usable. */
export function readSsoIdentity(headers: Headers): SsoIdentity | null {
  const email = headers.get(SSO_HEADERS.email)?.trim().toLowerCase();
  if (!email) return null;
  const name = headers.get(SSO_HEADERS.name)?.trim() || email.split("@")[0];
  const groups = (headers.get(SSO_HEADERS.groups) ?? "")
    .split(/[,;]/)
    .map((g) => g.trim())
    .filter(Boolean);
  return { email, name, groups };
}

export async function getAccessSettings(): Promise<AccessSettings> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, ACCESS_SETTINGS_KEY));
  if (!row) return DEFAULT_ACCESS;
  return { ...DEFAULT_ACCESS, ...(row.value as Partial<AccessSettings>) };
}

/**
 * Resolves the forwarded identity to a row in `users`, creating it on first
 * sign-in. Role and Region are re-applied on every request so a change in the
 * IdP takes effect immediately rather than at the next manual edit.
 */
export async function resolveSsoUser(identity: SsoIdentity): Promise<User> {
  const access = await getAccessSettings();
  const { role, region } = mapIdentity(identity, access);

  const [existing] = await db.select().from(users).where(eq(users.email, identity.email));
  if (!existing) {
    const [created] = await db
      .insert(users)
      .values({
        name: identity.name,
        title: "Signed in via SSO",
        role,
        region,
        email: identity.email,
      })
      .returning();
    return created;
  }

  if (existing.role === role && existing.region === region && existing.name === identity.name) {
    return existing;
  }
  const [updated] = await db
    .update(users)
    .set({ role, region, name: identity.name })
    .where(eq(users.id, existing.id))
    .returning();
  return updated;
}
