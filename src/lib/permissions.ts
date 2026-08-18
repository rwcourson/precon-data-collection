/**
 * Compatibility wrappers for tests and any leftover UI. Production code must
 * call `authorize()` / `src/lib/authorization/decisions.ts` instead.
 */
import type { EstimateRound, User } from "@/db/schema";
import {
  principalCanApproveLock,
  principalCanCreatePursuit,
  principalCanEditAfterLock,
  principalCanEditBidSchedule,
  principalCanEnterPostBid,
  principalCanManageCompanyColumns,
  principalCanManagePeople,
  principalCanManageReferenceLists,
  principalCanManageRegionColumns,
  principalCanViewAudit,
} from "@/lib/authorization/decisions";
import { allowedTransitionsForUser } from "@/lib/authorization/lifecycle";
import { createPrincipal } from "@/lib/authorization/principal";
import { isCorporateAdmin, isSuperAdmin } from "@/lib/super-admin";

export { ROLE_LABELS, STATUS_LABELS, STATUS_ORDER } from "@/lib/labels";
export { isCorporateAdmin, isSuperAdmin };

function asPrincipal(user: User) {
  return createPrincipal({
    user,
    authSource: "service",
    workspaceRegion: user.region,
  });
}

export function canCreatePursuit(user: User): boolean {
  return principalCanCreatePursuit(asPrincipal(user), user.region);
}

export function canEditBidSchedule(user: User): boolean {
  return principalCanEditBidSchedule(asPrincipal(user));
}

export function canEnterPostBid(
  user: User,
  round: Pick<EstimateRound, "status"> & { id?: number; region?: string | null }
): boolean {
  return principalCanEnterPostBid(asPrincipal(user), {
    id: round.id ?? 0,
    status: round.status,
    region: round.region ?? user.region ?? "Central",
  });
}

export function canApproveLock(
  user: User,
  round: Pick<EstimateRound, "region"> & { id?: number }
): boolean {
  return principalCanApproveLock(asPrincipal(user), {
    id: round.id ?? 0,
    status: "post_bid",
    region: round.region,
  });
}

export function canEditAfterLock(
  user: User,
  round: Pick<EstimateRound, "region"> & { id?: number }
): boolean {
  return principalCanEditAfterLock(asPrincipal(user), {
    id: round.id ?? 0,
    status: "locked",
    region: round.region,
  });
}

export function canManageCompanyColumns(user: User): boolean {
  return principalCanManageCompanyColumns(asPrincipal(user));
}

export function canManageRegionColumns(user: User): boolean {
  return principalCanManageRegionColumns(asPrincipal(user));
}

export function canManageReferenceLists(user: User): boolean {
  return principalCanManageReferenceLists(asPrincipal(user));
}

export function canViewAudit(user: User): boolean {
  return principalCanViewAudit(asPrincipal(user));
}

export function canManagePeople(user: User): boolean {
  return principalCanManagePeople(asPrincipal(user));
}

export function allowedTransitions(
  user: User,
  round: Pick<EstimateRound, "status">
) {
  return allowedTransitionsForUser(user, round);
}
