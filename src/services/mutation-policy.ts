import "server-only";
import { DomainError } from "@/domain/errors";
import { authorize } from "@/lib/authorization/kernel";
import { principalAllowsRegion } from "@/lib/authorization/principal";
import type {
  Capability,
  Principal,
  ResourceDescriptor,
} from "@/lib/authorization/types";

/** Throw not-found for unauthorized resource IDs (enumeration-safe). */
export function requireAuthorized(
  principal: Principal,
  capability: Capability,
  resource: ResourceDescriptor,
  label = "Resource"
): void {
  const decision = authorize(principal, capability, resource);
  if (!decision.allowed) {
    if (decision.reason === "region" || decision.reason === "deleted-state") {
      throw DomainError.notFound(`${label} not found`);
    }
    throw DomainError.forbidden(
      `Not permitted to ${capability} ${label.toLowerCase()}`,
      `Authorization denied (${decision.reason}).`
    );
  }
}

/** Create-time region gate used when no row yet exists. */
export function requireTargetRegion(
  principal: Principal,
  region: string | null,
  label: string
): void {
  if (!principalAllowsRegion(principal, region)) {
    throw DomainError.notFound(`${label} not found`);
  }
}

export function assertPrincipalCanCreatePursuit(
  principal: Principal,
  region: string
): void {
  requireTargetRegion(principal, region, "Job");
  requireAuthorized(
    principal,
    "edit",
    {
      type: "job",
      id: "new",
      region,
      ownerId: principal.user.id,
      published: true,
      deleted: false,
    },
    "Job"
  );
}

export function assertPrincipalCanDistribute(
  principal: Principal,
  region: string | null
): void {
  requireTargetRegion(principal, region, "Distribution list");
  requireAuthorized(
    principal,
    "distribute",
    {
      type: "admin",
      id: "distribution",
      region,
      ownerId: null,
      published: true,
      deleted: false,
      adminSection: "distribution",
    },
    "Distribution list"
  );
}

export function assertPrincipalCanIntegrate(
  principal: Principal,
  region: string | null
): void {
  requireTargetRegion(principal, region, "Integration");
  requireAuthorized(
    principal,
    "integrate",
    {
      type: "admin",
      id: "integrations",
      region,
      ownerId: null,
      published: true,
      deleted: false,
      adminSection: "integrations",
    },
    "Integration"
  );
}

export function assertPrincipalAdmin(
  principal: Principal,
  section: string,
  capability: Capability = "edit",
  label = "Admin"
): void {
  requireAuthorized(
    principal,
    capability,
    {
      type: "admin",
      id: section,
      region: principal.workspace.region,
      ownerId: null,
      published: true,
      deleted: false,
      adminSection: section,
    },
    label
  );
}
