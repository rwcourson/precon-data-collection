import type { EstimateRound, RoundStatus, User } from "@/db/schema";
import { isCorporateAdmin } from "@/lib/super-admin";
import type { Principal } from "./types";

const PRE_BID: RoundStatus[] = ["active", "upcoming", "outstanding"];
const BID_EDITOR_ROLES = new Set(["pcm", "estimate_lead", "admin_jsa", "rpd"]);
const SUBMITTER_ROLES = new Set(["estimate_lead", "admin_jsa", "rpd"]);

/** Statuses `actor` may move a round to from its current status. */
export function allowedTransitionsForUser(
  user: User,
  round: Pick<EstimateRound, "status">
): RoundStatus[] {
  const s = round.status;
  const targets: RoundStatus[] = [];
  const elevated = isCorporateAdmin(user);
  const canEditSchedule = elevated || BID_EDITOR_ROLES.has(user.role);

  if (PRE_BID.includes(s)) {
    if (canEditSchedule) {
      targets.push(...PRE_BID.filter((t) => t !== s));
    }
    if (elevated || SUBMITTER_ROLES.has(user.role)) {
      targets.push("submitted");
    }
  } else if (s === "submitted") {
    if (elevated || SUBMITTER_ROLES.has(user.role)) {
      targets.push("post_bid");
    }
  } else if (s === "post_bid") {
    if (elevated || user.role === "rpd") targets.push("locked");
  }
  return targets;
}

export function allowedTransitions(
  principal: Principal,
  round: Pick<EstimateRound, "status">
): RoundStatus[] {
  return allowedTransitionsForUser(principal.user, round);
}
