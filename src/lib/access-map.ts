import type { Role } from "@/db/schema";

export type AccessSettings = {
  /** IdP group (or role claim) → application role. */
  groupRoles: Record<string, Role>;
  /** IdP group → Region, for people whose Region is not on their profile. */
  groupRegions: Record<string, string>;
  /** Exact, case-insensitive title → role mapping from the governed roster feed. */
  titleRoles: Record<string, Role>;
  /** Exact manager email → inherited role mapping for reporting-chain pilots. */
  managerRoles: Record<string, Role>;
  /** Per-person role and Region overrides, keyed by lowercase email. */
  emailRoles: Record<string, Role>;
  emailRegions: Record<string, string>;
  /** Applied when no group matches; the least-privileged useful role. */
  defaultRole: Role;
};

export const DEFAULT_ACCESS: AccessSettings = {
  groupRoles: {
    "BG-Precon-CorporateAdmin": "corporate_admin",
    "BG-Precon-RPD": "rpd",
    /** SPD is an RPD-equivalent title — same role enum, no separate value. */
    "BG-Precon-SPD": "rpd",
    "BG-Precon-Leadership": "leadership",
    "BG-Precon-EstimateLead": "estimate_lead",
    "BG-Precon-AdminJSA": "admin_jsa",
    "BG-Precon-PCM": "pcm",
  },
  groupRegions: {
    "BG-Region-Carolinas": "Carolinas",
    "BG-Region-Central": "Central",
    "BG-Region-Florida": "Florida",
    "BG-Region-Georgia": "Georgia",
    "BG-Region-Texas": "Texas",
  },
  titleRoles: {},
  managerRoles: {},
  emailRoles: {},
  emailRegions: {},
  defaultRole: "pcm",
};

export type SsoIdentity = {
  email: string;
  name: string;
  groups: string[];
  /** Optional Entra / IdP job title — used when linking the roster row. */
  title?: string;
  /** Optional governed reporting-chain value from the directory adapter. */
  managerEmail?: string;
};

/** First matching group wins, ordered by privilege so the highest grant sticks. */
const ROLE_PRIVILEGE: Role[] = [
  "corporate_admin",
  "rpd",
  "leadership",
  "estimate_lead",
  "admin_jsa",
  "pcm",
];

export function mapIdentity(
  identity: SsoIdentity,
  access: AccessSettings
): { role: Role; region: string | null } {
  const matched = mappedRoles(identity, access);
  const role =
    ROLE_PRIVILEGE.find((r) => matched.includes(r)) ?? access.defaultRole;

  const region =
    access.emailRegions[identity.email.toLowerCase()] ??
    identity.groups.map((g) => access.groupRegions[g]).find(Boolean) ??
    null;

  return { role, region };
}

const REGION_BOUND_ROLES: Role[] = ["pcm", "estimate_lead", "admin_jsa", "rpd"];

export type StrictIdentityMapping =
  | { ok: true; role: Role; region: string | null }
  | { ok: false; reason: "unmapped-role" | "missing-region" };

/** Production mapping never falls back to a default role. */
export function mapIdentityStrict(
  identity: SsoIdentity,
  access: AccessSettings
): StrictIdentityMapping {
  const matched = mappedRoles(identity, access);
  const role = ROLE_PRIVILEGE.find((candidate) => matched.includes(candidate));
  if (!role) return { ok: false, reason: "unmapped-role" };
  const region =
    access.emailRegions[identity.email.toLowerCase()] ??
    identity.groups.map((group) => access.groupRegions[group]).find(Boolean) ??
    null;
  if (REGION_BOUND_ROLES.includes(role) && !region) {
    return { ok: false, reason: "missing-region" };
  }
  return { ok: true, role, region };
}

function mappedRoles(identity: SsoIdentity, access: AccessSettings): Role[] {
  const byKey = <T>(
    map: Record<string, T>,
    key: string | null | undefined
  ): T | undefined => {
    if (!key?.trim()) return undefined;
    const needle = key.trim().toLowerCase();
    const entry = Object.entries(map).find(
      ([candidate]) => candidate.trim().toLowerCase() === needle
    );
    return entry?.[1];
  };
  const emailRole = byKey(access.emailRoles, identity.email);
  if (emailRole) return [emailRole];
  const titleRole = byKey(access.titleRoles, identity.title);
  if (titleRole) return [titleRole];
  const managerRole = byKey(access.managerRoles, identity.managerEmail);
  if (managerRole) return [managerRole];
  return identity.groups
    .map((group) => access.groupRoles[group])
    .filter((role): role is Role => Boolean(role));
}
