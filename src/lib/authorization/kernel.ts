import type { ApiTokenScope } from "@/domain/contracts";
import { FIELD_DEFS } from "@/lib/fields";
import { principalAllowsRegion } from "./principal";
import type {
  AuthorizationDecision,
  Capability,
  Principal,
  ResourceDescriptor,
  SheetAclGrant,
} from "./types";

const EDIT_ROLES = new Set(["pcm", "estimate_lead", "admin_jsa", "rpd"]);
const INTEGRATION_ROLES = new Set(["admin_jsa", "rpd", "corporate_admin"]);
const TRASH_ROLES = new Set(["admin_jsa", "rpd", "corporate_admin"]);
const CORPORATE_ADMIN_SECTIONS = new Set([
  "lists",
  "tokens",
  "access",
  "people",
  "migration",
  "status",
]);
const REGIONAL_ADMIN_SECTIONS = new Set([
  "columns",
  "promotions",
  "review",
  "notifications",
  "distribution",
  "salesforce",
  "audit",
  "integrations",
  "destini",
  "quality",
  "trash",
]);

function deny(
  capability: Capability,
  reason: Extract<AuthorizationDecision, { allowed: false }>["reason"]
): AuthorizationDecision {
  return { allowed: false, capability, reason };
}

function requiredTokenScope(
  capability: Capability,
  resource: ResourceDescriptor
): ApiTokenScope | null {
  if (capability === "permanent-delete") return "write:destructive";
  if (
    capability === "manage" &&
    resource.type === "admin" &&
    resource.adminSection === "tokens"
  ) {
    return "admin:tokens";
  }
  if (resource.type === "dashboard")
    return capability === "read" ? "read:dashboards" : "write:dashboards";
  if (resource.type === "report")
    return capability === "read" ? "read:reports" : "write:reports";
  if (resource.type === "sheet")
    return capability === "read" ? "read:sheets" : "write:sheets";
  if (resource.type === "admin")
    return capability === "read" ? "read:admin" : "write:admin";
  if (resource.type === "trash")
    return capability === "read" ? "read:trash" : "write:trash";
  if (["job", "round"].includes(resource.type)) {
    return capability === "read" ? "read:pursuits" : "write:pursuits";
  }
  return null;
}

function tokenAllows(
  principal: Principal,
  capability: Capability,
  resource: ResourceDescriptor
): boolean {
  if (!principal.token) return true;
  if (
    principal.token.expiresAt &&
    principal.token.expiresAt.getTime() <= Date.now()
  )
    return false;
  const scope = requiredTokenScope(capability, resource);
  return scope == null || principal.token.scopes.includes(scope);
}

export function sheetCapabilityRank(
  capability: "viewer" | "editor" | "manager"
): number {
  return capability === "manager" ? 3 : capability === "editor" ? 2 : 1;
}

export function resolveKernelSheetCapability(
  principal: Principal,
  resource: Pick<ResourceDescriptor, "region" | "ownerId" | "sheetAcls">
): "viewer" | "editor" | "manager" | null {
  let best: "viewer" | "editor" | "manager" | null = null;
  for (const row of resource.sheetAcls ?? []) {
    const matches =
      row.userId === principal.user.id || row.grantRole === principal.user.role;
    if (!matches) continue;
    const allowlist = row.regionAllowlist ?? [];
    if (
      allowlist.length > 0 &&
      !allowlist.some((region) => principalAllowsRegion(principal, region))
    )
      continue;
    if (!best || sheetCapabilityRank(row.acl) > sheetCapabilityRank(best))
      best = row.acl;
  }
  if (best) return best;
  if (resource.region == null)
    return principal.user.role === "corporate_admin" ? "manager" : "viewer";
  if (!principalAllowsRegion(principal, resource.region)) return null;
  if (principal.user.role === "corporate_admin") return "manager";
  if (resource.ownerId === principal.user.id) return "manager";
  if (principal.user.role === "rpd") return "manager";
  if (["pcm", "estimate_lead", "admin_jsa"].includes(principal.user.role))
    return "editor";
  if (principal.user.role === "leadership") return "viewer";
  return null;
}

function fieldWriteAllowed(
  principal: Principal,
  resource: ResourceDescriptor
): boolean {
  const round = resource.round;
  const fieldKey = resource.fieldKey;
  if (!round || !fieldKey) return false;
  const override = resource.fieldPolicy;
  if (override) {
    return (
      override.role === principal.user.role &&
      override.allowedStatuses.includes(round.status) &&
      (!override.regionScoped || principalAllowsRegion(principal, round.region))
    );
  }
  // Corporate / platform super admins may correct any field (full visibility + control).
  if (principal.user.role === "corporate_admin") return true;
  if (principal.user.role === "leadership") return false;
  if (
    !resource.visibilitySatisfied &&
    !principalAllowsRegion(principal, round.region)
  )
    return false;
  if (round.status === "locked") return principal.user.role === "rpd";
  const def = FIELD_DEFS.find((field) => field.key === fieldKey);
  const postBid = fieldKey.startsWith("custom:") || Boolean(def && !def.core);
  if (postBid) {
    return (
      ["submitted", "post_bid"].includes(round.status) &&
      ["estimate_lead", "admin_jsa", "rpd"].includes(principal.user.role)
    );
  }
  return (
    EDIT_ROLES.has(principal.user.role) &&
    ["active", "upcoming", "outstanding", "submitted"].includes(round.status)
  );
}

function canRead(
  principal: Principal,
  resource: ResourceDescriptor
): AuthorizationDecision {
  if (resource.type === "sheet") {
    return resolveKernelSheetCapability(principal, resource)
      ? { allowed: true, capability: "read" }
      : deny("read", "acl");
  }
  if (resource.type === "dashboard") {
    if (
      resource.ownerId === principal.user.id ||
      principal.user.role === "corporate_admin"
    )
      return { allowed: true, capability: "read" };
    return resource.published
      ? { allowed: true, capability: "read" }
      : deny("read", "publication");
  }
  if (resource.type === "report") {
    if (
      resource.ownerId === principal.user.id ||
      principal.user.role === "corporate_admin"
    )
      return { allowed: true, capability: "read" };
    if (resource.sharedWithUserIds?.includes(principal.user.id))
      return { allowed: true, capability: "read" };
    if (
      resource.sharedWithRegions?.some((region) =>
        principalAllowsRegion(principal, region)
      )
    )
      return { allowed: true, capability: "read" };
    return deny("read", "publication");
  }
  if (resource.type === "admin") {
    if (principal.user.role === "corporate_admin")
      return { allowed: true, capability: "read" };
    if (
      resource.adminSection &&
      REGIONAL_ADMIN_SECTIONS.has(resource.adminSection) &&
      ["admin_jsa", "rpd"].includes(principal.user.role)
    ) {
      return { allowed: true, capability: "read" };
    }
    if (
      resource.adminSection &&
      CORPORATE_ADMIN_SECTIONS.has(resource.adminSection)
    ) {
      return deny("read", "role");
    }
    return deny("read", "role");
  }
  if (resource.type === "trash") {
    return TRASH_ROLES.has(principal.user.role)
      ? { allowed: true, capability: "read" }
      : deny("read", "role");
  }
  return ["job", "round"].includes(resource.type)
    ? { allowed: true, capability: "read" }
    : deny("read", "unsupported");
}

/** The only capability decision API. Unknown combinations are denied. */
export function authorize(
  principal: Principal,
  capability: Capability,
  resource: ResourceDescriptor
): AuthorizationDecision {
  const deletedCapability =
    capability === "restore" ||
    capability === "permanent-delete" ||
    (capability === "read" && resource.type === "trash");
  if (resource.deleted !== deletedCapability)
    return deny(capability, "deleted-state");
  if (
    !resource.visibilitySatisfied &&
    !principalAllowsRegion(principal, resource.region)
  ) {
    return deny(capability, "region");
  }
  if (!tokenAllows(principal, capability, resource))
    return deny(capability, "token");
  if (capability === "read") return canRead(principal, resource);
  if (capability === "edit") {
    if (resource.type === "round" && resource.fieldKey) {
      return fieldWriteAllowed(principal, resource)
        ? { allowed: true, capability }
        : deny(capability, "field-policy");
    }
    if (resource.type === "sheet") {
      const have = resolveKernelSheetCapability(principal, resource);
      return have && sheetCapabilityRank(have) >= sheetCapabilityRank("editor")
        ? { allowed: true, capability }
        : deny(capability, "acl");
    }
    if (resource.type === "dashboard") {
      if (resource.isStandard) return deny(capability, "publication");
      return resource.ownerId === principal.user.id ||
        principal.user.role === "corporate_admin"
        ? { allowed: true, capability }
        : deny(capability, "ownership");
    }
    if (resource.type === "report") {
      return resource.ownerId === principal.user.id ||
        principal.user.role === "corporate_admin"
        ? { allowed: true, capability }
        : deny(capability, "ownership");
    }
    if (resource.type === "admin") {
      if (principal.user.role === "corporate_admin")
        return { allowed: true, capability };
      if (
        resource.adminSection &&
        REGIONAL_ADMIN_SECTIONS.has(resource.adminSection) &&
        ["admin_jsa", "rpd"].includes(principal.user.role)
      ) {
        if (
          ["columns", "promotions", "notifications"].includes(
            resource.adminSection
          ) &&
          principal.user.role === "admin_jsa"
        ) {
          return deny(capability, "role");
        }
        return { allowed: true, capability };
      }
      return deny(capability, "role");
    }
    return ["job", "round"].includes(resource.type) &&
      EDIT_ROLES.has(principal.user.role)
      ? { allowed: true, capability }
      : deny(capability, "role");
  }
  if (capability === "manage") {
    if (resource.type === "sheet") {
      return resolveKernelSheetCapability(principal, resource) === "manager"
        ? { allowed: true, capability }
        : deny(capability, "acl");
    }
    if (resource.type === "admin") {
      return principal.user.role === "corporate_admin"
        ? { allowed: true, capability }
        : deny(capability, "role");
    }
    return resource.ownerId === principal.user.id ||
      principal.user.role === "corporate_admin"
      ? { allowed: true, capability }
      : deny(capability, "ownership");
  }
  if (capability === "approve") {
    return resource.type === "round" &&
      resource.round?.status === "post_bid" &&
      (principal.user.role === "rpd" ||
        principal.user.role === "corporate_admin")
      ? { allowed: true, capability }
      : deny(capability, "role");
  }
  if (capability === "distribute") {
    return ["rpd", "corporate_admin"].includes(principal.user.role)
      ? { allowed: true, capability }
      : deny(capability, "role");
  }
  if (capability === "integrate") {
    return INTEGRATION_ROLES.has(principal.user.role)
      ? { allowed: true, capability }
      : deny(capability, "role");
  }
  if (capability === "restore") {
    return TRASH_ROLES.has(principal.user.role)
      ? { allowed: true, capability }
      : deny(capability, "role");
  }
  if (capability === "permanent-delete") {
    return principal.user.role === "corporate_admin"
      ? { allowed: true, capability }
      : deny(capability, "role");
  }
  if (capability === "notes.write" || capability === "notes.attach") {
    return ["job", "round"].includes(resource.type)
      ? { allowed: true, capability }
      : deny(capability, "unsupported");
  }
  if (capability === "visibility.manage-region") {
    return ["job", "round"].includes(resource.type) &&
      (EDIT_ROLES.has(principal.user.role) ||
        principal.user.role === "corporate_admin")
      ? { allowed: true, capability }
      : deny(capability, "role");
  }
  if (capability === "visibility.assign-user") {
    return ["job", "round"].includes(resource.type) &&
      principal.user.role === "corporate_admin"
      ? { allowed: true, capability }
      : deny(capability, "role");
  }
  if (capability === "staffing.mark") {
    return ["job", "round"].includes(resource.type) &&
      (EDIT_ROLES.has(principal.user.role) ||
        principal.user.role === "corporate_admin")
      ? { allowed: true, capability }
      : deny(capability, "role");
  }
  if (capability === "dashboards.manage-standard") {
    return resource.type === "dashboard" &&
      principal.user.role === "corporate_admin"
      ? { allowed: true, capability }
      : deny(capability, "role");
  }
  if (capability === "reports.schedule") {
    return resource.type === "report" && resource.ownerId === principal.user.id
      ? { allowed: true, capability }
      : deny(
          capability,
          resource.type === "report" ? "ownership" : "unsupported"
        );
  }
  return deny(capability, "unsupported");
}

export type { SheetAclGrant };
