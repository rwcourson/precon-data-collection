import type { EstimateRound, Role, RoundStatus, User } from "@/db/schema";
import { authorize, resolveKernelSheetCapability, sheetCapabilityRank as kernelSheetCapabilityRank } from "@/lib/authorization/kernel";
import { createPrincipal } from "@/lib/authorization/principal";

/**
 * Central field + sheet authorization. All editors, imports, and APIs should
 * call these helpers rather than inventing per-action checks.
 */

const policyPrincipal = (user: User) =>
  createPrincipal({ user, authSource: "service", workspaceRegion: user.region });

/** Default: who may write a field key given round lifecycle. */
export function canWriteField(
  user: User,
  fieldKey: string,
  round: Pick<EstimateRound, "status" | "region">,
): boolean {
  return authorize(policyPrincipal(user), "edit", {
    type: "round",
    id: 0,
    region: round.region,
    ownerId: null,
    published: false,
    deleted: false,
    round,
    fieldKey,
    fieldPolicy: null,
  }).allowed;
}

export type SheetCapability = "viewer" | "editor" | "manager";

export function sheetCapabilityRank(c: SheetCapability): number {
  return kernelSheetCapabilityRank(c);
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
  return resolveKernelSheetCapability(policyPrincipal(user), {
    region: sheet.region,
    ownerId: sheet.ownerId,
    sheetAcls: acls,
  });
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
