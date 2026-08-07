import type { EstimateRound, Role, RoundStatus, User } from "@/db/schema";

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

export function canCreatePursuit(user: User): boolean {
  return ["pcm", "estimate_lead", "admin_jsa", "rpd"].includes(user.role);
}

export function canEditBidSchedule(user: User): boolean {
  return ["pcm", "estimate_lead", "admin_jsa", "rpd"].includes(user.role);
}

export function canEnterPostBid(user: User, round: Pick<EstimateRound, "status">): boolean {
  if (round.status === "locked") return user.role === "rpd";
  if (!["submitted", "post_bid"].includes(round.status)) return false;
  return ["estimate_lead", "admin_jsa", "rpd"].includes(user.role);
}

export function canApproveLock(user: User, round: Pick<EstimateRound, "region">): boolean {
  return user.role === "rpd" && (user.region == null || user.region === round.region);
}

/** RPD retains direct-correction rights after lock; all edits audit-logged. */
export function canEditAfterLock(user: User, round: Pick<EstimateRound, "region">): boolean {
  return canApproveLock(user, round);
}

export function canManageCompanyColumns(user: User): boolean {
  return user.role === "corporate_admin";
}

export function canManageRegionColumns(user: User): boolean {
  return user.role === "rpd" || user.role === "corporate_admin";
}

export function canManageReferenceLists(user: User): boolean {
  return user.role === "corporate_admin";
}

export function canViewAudit(user: User): boolean {
  return user.role === "rpd" || user.role === "corporate_admin";
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

  if (PRE_BID.includes(s)) {
    // Pre-bid statuses transition freely between each other (PCM/EL/Admin/RPD)
    if (canEditBidSchedule(user)) {
      targets.push(...PRE_BID.filter((t) => t !== s));
    }
    // → Submitted: Estimate Lead, Admin (and RPD as regional owner)
    if (["estimate_lead", "admin_jsa", "rpd"].includes(user.role)) {
      targets.push("submitted");
    }
  } else if (s === "submitted") {
    if (["estimate_lead", "admin_jsa", "rpd"].includes(user.role)) {
      targets.push("post_bid");
    }
  } else if (s === "post_bid") {
    if (user.role === "rpd") targets.push("locked");
  }
  // locked: terminal — RPD corrections happen via direct field edits, not transitions
  return targets;
}
