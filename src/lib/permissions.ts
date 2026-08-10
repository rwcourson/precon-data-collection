import type { EstimateRound, Role, RoundStatus, User } from "@/db/schema";
import { isCorporateAdmin, isSuperAdmin } from "@/lib/super-admin";

/** RBAC per the BRD Section 3 role matrix. Checked server-side in every action. */

export const ROLE_LABELS: Record<Role, string> = {
  pcm: "PCM (Preconstruction Manager)",
  estimate_lead: "Estimate Lead",
  admin_jsa: "Admin / JSA",
  /** Bryan: RPD and SPD are synonymous for approval / post-lock corrections. */
  rpd: "RPD / SPD",
  leadership: "Division / Region Leadership",
  corporate_admin: "Corporate Precon Admin",
};

export { isCorporateAdmin, isSuperAdmin };

export function canCreatePursuit(user: User): boolean {
  if (isCorporateAdmin(user)) return true;
  return ["pcm", "estimate_lead", "admin_jsa", "rpd"].includes(user.role);
}

export function canEditBidSchedule(user: User): boolean {
  if (isCorporateAdmin(user)) return true;
  return ["pcm", "estimate_lead", "admin_jsa", "rpd"].includes(user.role);
}

export function canEnterPostBid(user: User, round: Pick<EstimateRound, "status">): boolean {
  if (isCorporateAdmin(user)) return true;
  if (round.status === "locked") return user.role === "rpd";
  if (!["submitted", "post_bid"].includes(round.status)) return false;
  return ["estimate_lead", "admin_jsa", "rpd"].includes(user.role);
}

export function canApproveLock(user: User, round: Pick<EstimateRound, "region">): boolean {
  if (isCorporateAdmin(user)) return true;
  return user.role === "rpd" && (user.region == null || user.region === round.region);
}

/** RPD retains direct-correction rights after lock; all edits audit-logged. */
export function canEditAfterLock(user: User, round: Pick<EstimateRound, "region">): boolean {
  return canApproveLock(user, round);
}

export function canManageCompanyColumns(user: User): boolean {
  return isCorporateAdmin(user);
}

export function canManageRegionColumns(user: User): boolean {
  return user.role === "rpd" || isCorporateAdmin(user);
}

export function canManageReferenceLists(user: User): boolean {
  return isCorporateAdmin(user);
}

export function canViewAudit(user: User): boolean {
  return user.role === "rpd" || isCorporateAdmin(user);
}

/** Assign roles / regions to other roster users. */
export function canManagePeople(user: User): boolean {
  return isCorporateAdmin(user);
}

// ---- Status lifecycle state machine (BRD Section 4) ----

const PRE_BID: RoundStatus[] = ["active", "upcoming", "outstanding"];

export const STATUS_LABELS: Record<RoundStatus, string> = {
  active: "Active",
  upcoming: "Upcoming",
  outstanding: "Outstanding",
  submitted: "Submitted",
  post_bid: "Post-Bid Data Entry",
  locked: "RPD / SPD Approved / Locked",
};

export const STATUS_ORDER: RoundStatus[] = [
  "active",
  "upcoming",
  "outstanding",
  "submitted",
  "post_bid",
  "locked",
];

/** Returns the statuses `user` may move a round to from its current status. */
export function allowedTransitions(user: User, round: Pick<EstimateRound, "status">): RoundStatus[] {
  const s = round.status;
  const targets: RoundStatus[] = [];
  const elevated = isCorporateAdmin(user);

  if (PRE_BID.includes(s)) {
    // Pre-bid statuses transition freely between each other (PCM/EL/Admin/RPD)
    if (canEditBidSchedule(user)) {
      targets.push(...PRE_BID.filter((t) => t !== s));
    }
    // → Submitted: Estimate Lead, Admin (and RPD as regional owner)
    if (elevated || ["estimate_lead", "admin_jsa", "rpd"].includes(user.role)) {
      targets.push("submitted");
    }
  } else if (s === "submitted") {
    if (elevated || ["estimate_lead", "admin_jsa", "rpd"].includes(user.role)) {
      targets.push("post_bid");
    }
  } else if (s === "post_bid") {
    if (elevated || user.role === "rpd") targets.push("locked");
  }
  // locked: terminal — RPD corrections happen via direct field edits, not transitions
  return targets;
}

