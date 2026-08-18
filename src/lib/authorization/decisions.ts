import type { EstimateRound } from "@/db/schema";
import { authorize } from "./kernel";
import { principalAllowsRegion } from "./principal";
import type { Principal, ResourceDescriptor } from "./types";

function jobResource(
  principal: Principal,
  region: string | null
): ResourceDescriptor {
  return {
    type: "job",
    id: "new",
    region,
    ownerId: principal.user.id,
    published: true,
    deleted: false,
  };
}

function roundResource(
  round: Pick<EstimateRound, "id" | "status" | "region">,
  extra: Partial<ResourceDescriptor> = {}
): ResourceDescriptor {
  return {
    type: "round",
    id: round.id,
    region: round.region,
    ownerId: null,
    published: true,
    deleted: false,
    round: { status: round.status, region: round.region },
    ...extra,
  };
}

export function principalCanCreatePursuit(
  principal: Principal,
  region?: string | null
): boolean {
  const target = region ?? principal.workspace.region ?? principal.user.region;
  if (principal.user.role === "corporate_admin") {
    return principalAllowsRegion(principal, target ?? null);
  }
  return authorize(principal, "edit", jobResource(principal, target)).allowed;
}

export function principalCanEditBidSchedule(principal: Principal): boolean {
  if (principal.user.role === "corporate_admin") return true;
  return authorize(
    principal,
    "edit",
    jobResource(principal, principal.workspace.region ?? principal.user.region)
  ).allowed;
}

export function principalCanApproveLock(
  principal: Principal,
  round: Pick<EstimateRound, "id" | "status" | "region">
): boolean {
  return authorize(
    principal,
    "approve",
    roundResource({ ...round, status: "post_bid" })
  ).allowed;
}

export function principalCanEditAfterLock(
  principal: Principal,
  round: Pick<EstimateRound, "id" | "status" | "region">
): boolean {
  return authorize(
    principal,
    "edit",
    roundResource(round, { fieldKey: "outcome" })
  ).allowed;
}

export function principalCanEnterPostBid(
  principal: Principal,
  round: Pick<EstimateRound, "id" | "status" | "region">
): boolean {
  return authorize(
    principal,
    "edit",
    roundResource(round, { fieldKey: "estimateValue" })
  ).allowed;
}

export function principalCanManageCompanyColumns(
  principal: Principal
): boolean {
  return authorize(principal, "manage", {
    type: "admin",
    id: "columns",
    region: null,
    ownerId: null,
    published: true,
    deleted: false,
    adminSection: "columns",
  }).allowed;
}

export function principalCanManageRegionColumns(principal: Principal): boolean {
  return authorize(principal, "edit", {
    type: "admin",
    id: "columns",
    region: principal.workspace.region,
    ownerId: null,
    published: true,
    deleted: false,
    adminSection: "columns",
  }).allowed;
}

export function principalCanManageReferenceLists(
  principal: Principal
): boolean {
  return authorize(principal, "manage", {
    type: "admin",
    id: "lists",
    region: null,
    ownerId: null,
    published: true,
    deleted: false,
    adminSection: "lists",
  }).allowed;
}

export function principalCanViewAudit(principal: Principal): boolean {
  return authorize(principal, "read", {
    type: "admin",
    id: "audit",
    region: principal.workspace.region,
    ownerId: null,
    published: true,
    deleted: false,
    adminSection: "audit",
  }).allowed;
}

export function principalCanManagePeople(principal: Principal): boolean {
  return authorize(principal, "manage", {
    type: "admin",
    id: "people",
    region: null,
    ownerId: null,
    published: true,
    deleted: false,
    adminSection: "people",
  }).allowed;
}

export function principalCanCreateSheet(
  principal: Principal,
  region: string | null
): boolean {
  return authorize(principal, "edit", {
    type: "sheet",
    id: "new",
    region,
    ownerId: principal.user.id,
    published: true,
    deleted: false,
  }).allowed;
}

export function principalCanManageJobRegion(
  principal: Principal,
  region: string
): boolean {
  return authorize(principal, "visibility.manage-region", {
    type: "job",
    id: "visibility",
    region,
    ownerId: principal.user.id,
    published: true,
    deleted: false,
  }).allowed;
}

export function principalCanMarkStaffing(
  principal: Principal,
  round: Pick<EstimateRound, "id" | "status" | "region">
): boolean {
  return authorize(
    principal,
    "staffing.mark",
    roundResource(round, { visibilitySatisfied: true })
  ).allowed;
}

export function principalCanAssignJobUser(principal: Principal): boolean {
  return authorize(principal, "visibility.assign-user", {
    type: "job",
    id: "visibility",
    region: principal.workspace.region ?? principal.user.region,
    ownerId: principal.user.id,
    published: true,
    deleted: false,
  }).allowed;
}

export function principalCanIntegrate(principal: Principal): boolean {
  return authorize(principal, "integrate", {
    type: "admin",
    id: "integrations",
    region: principal.workspace.region ?? principal.user.region,
    ownerId: null,
    published: true,
    deleted: false,
    adminSection: "integrations",
  }).allowed;
}
