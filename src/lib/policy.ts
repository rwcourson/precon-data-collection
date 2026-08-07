import type { EstimateRound, Role, RoundStatus, User } from "@/db/schema";
import { FIELD_DEFS } from "@/lib/fields";
import { canEditAfterLock, canEnterPostBid } from "@/lib/permissions";

/**
 * Central field + sheet authorization. All editors, imports, and APIs should
 * call these helpers rather than inventing per-action checks.
 */

const READ_ONLY_ROLES: Role[] = ["leadership"];

/** Default: who may write a field key given round lifecycle. */
export function canWriteField(
  user: User,
  fieldKey: string,
  round: Pick<EstimateRound, "status" | "region">,
): boolean {
  if (READ_ONLY_ROLES.includes(user.role)) return false;

  if (round.status === "locked") {
    return canEditAfterLock(user, round);
  }

  const def = FIELD_DEFS.find((f) => f.key === fieldKey);
  const isCustom = fieldKey.startsWith("custom:");
  const isCoreBid = Boolean(def?.core);
  const isPostBidField = Boolean(def && !def.core) || isCustom;

  if (isPostBidField) {
    return canEnterPostBid(user, round);
  }

  // Bid-schedule / core fields (and unknown keys treated as bid-schedule)
  if (["pcm", "estimate_lead", "admin_jsa", "rpd"].includes(user.role)) {
    if (user.role === "rpd" && user.region && user.region !== round.region) return false;
    if (isCoreBid || !def) {
      return ["active", "upcoming", "outstanding", "submitted"].includes(round.status);
    }
  }
  return false;
}

export type SheetCapability = "viewer" | "editor" | "manager";

export function sheetCapabilityRank(c: SheetCapability): number {
  return c === "manager" ? 3 : c === "editor" ? 2 : 1;
}

/**
 * Resolve effective sheet capability from ACL rows + defaults.
 * Corporate sheets (region null) default to corporate_admin as manager;
 * others fall back to role-based workspace rules.
 */
export function resolveSheetCapability(
  user: User,
  sheet: { region: string | null; ownerId: number | null },
  acls: {
    userId: number | null;
    grantRole: Role | null;
    acl: SheetCapability;
    regionAllowlist: string[] | null;
  }[],
): SheetCapability | null {
  let best: SheetCapability | null = null;

  for (const row of acls) {
    const userMatch = row.userId != null && row.userId === user.id;
    const roleMatch = row.grantRole != null && row.grantRole === user.role;
    if (!userMatch && !roleMatch) continue;
    const allow = row.regionAllowlist ?? [];
    if (allow.length > 0 && user.region && !allow.includes(user.region)) continue;
    if (!best || sheetCapabilityRank(row.acl) > sheetCapabilityRank(best)) {
      best = row.acl;
    }
  }

  if (best) return best;

  // Defaults
  if (sheet.region == null) {
    return user.role === "corporate_admin" ? "manager" : "viewer";
  }
  if (user.role === "corporate_admin") return "manager";
  if (user.role === "rpd" && user.region === sheet.region) return "manager";
  if (sheet.ownerId === user.id) return "manager";
  if (["pcm", "estimate_lead", "admin_jsa"].includes(user.role)) {
    if (!user.region || user.region === sheet.region) return "editor";
  }
  if (user.role === "leadership") return "viewer";
  return null;
}

export function assertCanWriteField(
  user: User,
  fieldKey: string,
  round: Pick<EstimateRound, "status" | "region">,
): void {
  if (!canWriteField(user, fieldKey, round)) {
    throw new Error(
      `Permission denied: cannot write field "${fieldKey}" as ${user.role} while status is ${round.status}. Ask an RPD/SPD or Corporate Admin if you need access.`,
    );
  }
}

export function assertSheetCapability(
  user: User,
  sheet: { region: string | null; ownerId: number | null },
  acls: {
    userId: number | null;
    grantRole: Role | null;
    acl: SheetCapability;
    regionAllowlist: string[] | null;
  }[],
  needed: SheetCapability,
): void {
  const have = resolveSheetCapability(user, sheet, acls);
  if (!have || sheetCapabilityRank(have) < sheetCapabilityRank(needed)) {
    throw new Error(
      `Permission denied: sheet requires ${needed} access (you have ${have ?? "none"}). Ask a sheet manager or Corporate Admin.`,
    );
  }
}

/** Statuses where a role may generally edit post-bid values (for tests/matrix). */
export function defaultAllowedStatusesForRole(role: Role): RoundStatus[] {
  switch (role) {
    case "estimate_lead":
    case "admin_jsa":
      return ["submitted", "post_bid"];
    case "rpd":
      return ["submitted", "post_bid", "locked", "active", "upcoming", "outstanding"];
    case "pcm":
      return ["active", "upcoming", "outstanding"];
    case "corporate_admin":
      return [];
    case "leadership":
      return [];
  }
}
