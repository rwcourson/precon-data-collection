import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { account } from "@/db/auth-schema";
import type { SsoIdentity } from "@/lib/access-map";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { DomainError } from "@/domain/errors";

export { BA_SESSION_COOKIE } from "@/lib/auth-constants";

export type MicrosoftTokenProfile = {
  groups: string[];
  /** Job title from Entra token when present. */
  jobTitle: string | null;
  /** Display name preferred over session if richer. */
  displayName: string | null;
  email: string | null;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part, "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function stringClaim(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function groupsFromPayload(payload: Record<string, unknown>): string[] {
  const raw = payload.groups ?? payload.roles;
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean).slice(0, 100);
}

/** Read Microsoft account id_token claims (groups, job title, name, email). */
export async function microsoftProfileFromAccount(
  userId: string,
): Promise<MicrosoftTokenProfile> {
  const empty: MicrosoftTokenProfile = {
    groups: [],
    jobTitle: null,
    displayName: null,
    email: null,
  };
  const [row] = await db
    .select({ idToken: account.idToken })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "microsoft")))
    .limit(1);
  if (!row?.idToken) return empty;
  const payload = decodeJwtPayload(row.idToken);
  if (!payload) return empty;

  return {
    groups: groupsFromPayload(payload),
    jobTitle: stringClaim(payload, "jobTitle", "job_title", "title"),
    displayName: stringClaim(payload, "name", "given_name"),
    email: stringClaim(
      payload,
      "email",
      "preferred_username",
      "upn",
      "unique_name",
    )?.toLowerCase() ?? null,
  };
}

/** @deprecated prefer microsoftProfileFromAccount */
export async function groupsFromMicrosoftAccount(userId: string): Promise<string[]> {
  return (await microsoftProfileFromAccount(userId)).groups;
}

export function assertAllowedEmailDomain(email: string): void {
  const domain = email.split("@").at(-1)?.toLowerCase() ?? "";
  const allowed = getRuntimeConfig().ssoAllowedDomains;
  if (!allowed.includes(domain)) {
    throw DomainError.unauthorized(
      `Email domain is not allowed for SSO (${domain || "unknown"}).`,
    );
  }
}

/**
 * Build app SSO identity from Better Auth session + optional Entra token claims.
 * Email is the join key to roster users; name/title prefer Entra, then session.
 */
export function identityFromBetterAuthUser(input: {
  email: string;
  name: string;
  groups: string[];
  title?: string | null;
}): SsoIdentity {
  const email = input.email.trim().toLowerCase();
  if (!email || email.length > 320) {
    throw DomainError.unauthorized("SSO session is missing a usable email.");
  }
  assertAllowedEmailDomain(email);

  const nameRaw = input.name.trim();
  const name =
    nameRaw && nameRaw !== "Microsoft user"
      ? nameRaw.slice(0, 160)
      : (email.split("@")[0] ?? "User").slice(0, 160);

  const title = input.title?.trim() ? input.title.trim().slice(0, 160) : undefined;

  return {
    email,
    name,
    groups: input.groups,
    ...(title ? { title } : {}),
  };
}
