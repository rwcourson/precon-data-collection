import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, type Role, type User, users } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import {
  type AccessSettings,
  DEFAULT_ACCESS,
  mapIdentity,
  mapIdentityStrict,
  type SsoIdentity,
} from "@/lib/access-map";
import { ROLE_LABELS } from "@/lib/labels";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { readForwardedSsoIdentity, ssoHeaderNames } from "@/lib/sso-trust";
import {
  isSuperAdminEmail,
  SUPER_ADMIN_ROLE,
  SUPER_ADMIN_TITLE,
} from "@/lib/super-admin";

/**
 * Identity seam: demo personas vs SSO (Better Auth Microsoft, or legacy proxy headers).
 *
 * SSO primary path: Better Auth session → email/groups → resolveSsoUser().
 * Roster match key is email (case-insensitive). Name/title prefer Entra, then
 * existing seed/roster values, then role label — never stuck on a placeholder.
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
  const saved = row.value as Partial<AccessSettings>;
  return {
    ...DEFAULT_ACCESS,
    ...saved,
    groupRoles: { ...DEFAULT_ACCESS.groupRoles, ...saved.groupRoles },
    groupRegions: { ...DEFAULT_ACCESS.groupRegions, ...saved.groupRegions },
    titleRoles: { ...DEFAULT_ACCESS.titleRoles, ...saved.titleRoles },
    managerRoles: { ...DEFAULT_ACCESS.managerRoles, ...saved.managerRoles },
    emailRoles: { ...DEFAULT_ACCESS.emailRoles, ...saved.emailRoles },
    emailRegions: { ...DEFAULT_ACCESS.emailRegions, ...saved.emailRegions },
  };
}

const PLACEHOLDER_TITLES = new Set([
  "signed in via sso",
  "microsoft user",
  "user",
]);

function isPlaceholderTitle(title: string | null | undefined): boolean {
  if (!title?.trim()) return true;
  return PLACEHOLDER_TITLES.has(title.trim().toLowerCase());
}

/** Prefer IdP display name; keep roster name when IdP only has an email local-part. */
export function resolveDisplayName(
  identity: SsoIdentity,
  existing?: User | null
): string {
  const fromIdp = identity.name?.trim() ?? "";
  const looksLikeLocalPart =
    !fromIdp ||
    fromIdp.includes("@") ||
    fromIdp.toLowerCase() === "microsoft user" ||
    (identity.email &&
      fromIdp.toLowerCase() === identity.email.split("@")[0]?.toLowerCase());

  if (fromIdp && !looksLikeLocalPart) return fromIdp.slice(0, 160);
  if (existing?.name?.trim()) return existing.name.trim().slice(0, 160);
  if (fromIdp) return fromIdp.slice(0, 160);
  return (identity.email.split("@")[0] || "User").slice(0, 160);
}

/** Prefer Entra job title → existing roster title → role label. */
export function resolveJobTitle(
  identity: SsoIdentity,
  role: Role,
  existing?: User | null
): string {
  if (identity.title?.trim() && !isPlaceholderTitle(identity.title)) {
    return identity.title.trim().slice(0, 160);
  }
  if (existing?.title && !isPlaceholderTitle(existing.title)) {
    return existing.title.slice(0, 160);
  }
  return ROLE_LABELS[role] ?? "Preconstruction";
}

/**
 * Resolves an SSO identity to a row in `users`, creating it on first sign-in.
 * Match key: email (case-insensitive). Name/title/role/region refreshed each request.
 */
export async function resolveSsoUser(identity: SsoIdentity): Promise<User> {
  const access = await getAccessSettings();
  const config = getRuntimeConfig();
  const superAdmin = isSuperAdminEmail(identity.email);

  let role: Role;
  let region: string | null;

  if (superAdmin) {
    // Platform super admins always sit above group mapping.
    role = SUPER_ADMIN_ROLE;
    region = null;
  } else {
    let mapping = mapIdentityStrict(identity, access);
    if (!mapping.ok && config.appEnv === "local") {
      const loose = mapIdentity(identity, access);
      mapping = { ok: true, role: loose.role, region: loose.region };
    }
    if (!mapping.ok) {
      throw DomainError.unauthorized(
        mapping.reason === "unmapped-role"
          ? "SSO identity has no mapped application role. Ask a Precon admin to map your Entra groups."
          : "SSO identity is missing a required Region mapping."
      );
    }
    role = mapping.role;
    region = mapping.region;
  }

  const name = resolveDisplayName(identity, null);
  const title = superAdmin
    ? identity.title?.trim() || SUPER_ADMIN_TITLE
    : resolveJobTitle(identity, role, null);

  const [existing] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${identity.email}`)
    .limit(1);

  if (!existing) {
    const [created] = await db
      .insert(users)
      .values({
        name,
        title,
        role,
        region,
        email: identity.email,
      })
      .returning();
    return created;
  }

  const nextName = resolveDisplayName(identity, existing);
  const nextTitle = superAdmin
    ? existing.title && existing.title !== "Signed in via SSO"
      ? existing.title
      : SUPER_ADMIN_TITLE
    : resolveJobTitle(identity, role, existing);

  if (
    existing.role === role &&
    existing.region === region &&
    existing.name === nextName &&
    existing.title === nextTitle &&
    existing.email.toLowerCase() === identity.email
  ) {
    return existing;
  }

  const [updated] = await db
    .update(users)
    .set({
      role,
      region,
      name: nextName,
      title: nextTitle,
      // Normalize stored email to the canonical lowercase IdP address.
      email: identity.email,
    })
    .where(eq(users.id, existing.id))
    .returning();
  return updated;
}
