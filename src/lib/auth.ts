import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, users, type User } from "@/db/schema";
import {
  DEFAULT_ACCESS,
  mapIdentity,
  mapIdentityStrict,
  type AccessSettings,
  type SsoIdentity,
} from "@/lib/access-map";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { DomainError } from "@/domain/errors";
import { readForwardedSsoIdentity, ssoHeaderNames } from "@/lib/sso-trust";

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
export const SSO_HEADERS = ssoHeaderNames();

export function authMode(): AuthMode {
  return getRuntimeConfig().authMode;
}

/** Reads the forwarded identity, or null when the proxy sent nothing usable. */
export function readSsoIdentity(headers: Headers): SsoIdentity | null {
  return readForwardedSsoIdentity(headers);
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
  const mapping = mapIdentityStrict(identity, access);
  if (!mapping.ok) {
    throw DomainError.unauthorized(
      mapping.reason === "unmapped-role"
        ? "SSO identity has no mapped application role."
        : "SSO identity is missing a required Region mapping.",
    );
  }
  const { role, region } = mapping;

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
