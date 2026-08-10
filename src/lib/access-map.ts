import type { Role } from "@/db/schema";

export type AccessSettings = {
  /** IdP group (or role claim) → application role. */
  groupRoles: Record<string, Role>;
  /** IdP group → Region, for people whose Region is not on their profile. */
  groupRegions: Record<string, string>;
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
  defaultRole: "pcm",
};

export type SsoIdentity = {
  email: string;
  name: string;
  groups: string[];
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
  access: AccessSettings,
): { role: Role; region: string | null } {
  const matched = identity.groups
    .map((g) => access.groupRoles[g])
    .filter((r): r is Role => Boolean(r));
  const role =
    ROLE_PRIVILEGE.find((r) => matched.includes(r)) ?? access.defaultRole;

  const region =
    identity.groups.map((g) => access.groupRegions[g]).find(Boolean) ?? null;

  return { role, region };
}

const REGION_BOUND_ROLES: Role[] = ["pcm", "estimate_lead", "admin_jsa", "rpd"];

export type StrictIdentityMapping =
  | { ok: true; role: Role; region: string | null }
  | { ok: false; reason: "unmapped-role" | "missing-region" };

/** Production mapping never falls back to a default role. */
export function mapIdentityStrict(
  identity: SsoIdentity,
  access: AccessSettings,
): StrictIdentityMapping {
  const matched = identity.groups
    .map((group) => access.groupRoles[group])
    .filter((role): role is Role => Boolean(role));
  const role = ROLE_PRIVILEGE.find((candidate) => matched.includes(candidate));
  if (!role) return { ok: false, reason: "unmapped-role" };
  const region = identity.groups.map((group) => access.groupRegions[group]).find(Boolean) ?? null;
  if (REGION_BOUND_ROLES.includes(role) && !region) {
    return { ok: false, reason: "missing-region" };
  }
  return { ok: true, role, region };
}
