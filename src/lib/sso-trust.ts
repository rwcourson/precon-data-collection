import { createHash, timingSafeEqual } from "node:crypto";
import type { RuntimeConfig } from "@/lib/runtime-config";
import type { SsoIdentity } from "@/lib/access-map";

export const SSO_TRUST_HEADER = "x-precon-sso-trust";

type HeaderEnvironment = Record<string, string | undefined>;

export function ssoHeaderNames(env: HeaderEnvironment = process.env) {
  return {
    email: env.SSO_EMAIL_HEADER?.trim() || "x-forwarded-email",
    name: env.SSO_NAME_HEADER?.trim() || "x-forwarded-preferred-username",
    groups: env.SSO_GROUPS_HEADER?.trim() || "x-forwarded-groups",
  } as const;
}

function equalSecret(actual: string, expected: string): boolean {
  const actualHash = createHash("sha256").update(actual).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function readForwardedSsoIdentity(
  headers: Headers,
  env: HeaderEnvironment = process.env,
): SsoIdentity | null {
  const names = ssoHeaderNames(env);
  const email = headers.get(names.email)?.trim().toLowerCase();
  if (!email || email.length > 320) return null;
  const name = (headers.get(names.name)?.trim() || email.split("@")[0]).slice(0, 160);
  const groups = (headers.get(names.groups) ?? "")
    .split(/[,;]/)
    .map((group) => group.trim())
    .filter(Boolean)
    .slice(0, 100);
  return { email, name, groups };
}

export type SsoTrustResult =
  | { ok: true; identity: SsoIdentity }
  | {
      ok: false;
      reason: "trust-unavailable" | "untrusted-hop" | "missing-identity" | "unapproved-domain";
    };

/** Validates the authenticated proxy hop before any forwarded field is trusted. */
export function verifySsoRequest(
  headers: Headers,
  config: Pick<RuntimeConfig, "ssoTrustSecret" | "ssoAllowedDomains">,
  env: HeaderEnvironment = process.env,
): SsoTrustResult {
  if (!config.ssoTrustSecret) return { ok: false, reason: "trust-unavailable" };
  const presented = headers.get(SSO_TRUST_HEADER) ?? "";
  if (!equalSecret(presented, config.ssoTrustSecret)) {
    return { ok: false, reason: "untrusted-hop" };
  }
  const identity = readForwardedSsoIdentity(headers, env);
  if (!identity) return { ok: false, reason: "missing-identity" };
  const domain = identity.email.split("@").at(-1) ?? "";
  if (!config.ssoAllowedDomains.includes(domain)) {
    return { ok: false, reason: "unapproved-domain" };
  }
  return { ok: true, identity };
}
