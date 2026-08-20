import type { Role } from "@/db/schema";
import type { AccessSettings, SsoIdentity } from "@/lib/access-map";
import { DEFAULT_ACCESS } from "@/lib/access-map";

export type IdentityMappingSource =
  | "email"
  | "title"
  | "manager"
  | "group"
  | "unmapped";

export type IdentityMappingPreview = {
  source: IdentityMappingSource;
  role: Role | null;
  region: string | null;
  matchedKey: string | null;
};

function lookupRole(
  map: Record<string, Role>,
  key: string | null | undefined
): { role: Role; matchedKey: string } | null {
  if (!key?.trim()) return null;
  const needle = key.trim().toLowerCase();
  const entry = Object.entries(map).find(
    ([candidate]) => candidate.trim().toLowerCase() === needle
  );
  return entry ? { role: entry[1], matchedKey: entry[0] } : null;
}

function lookupRegion(
  map: Record<string, string>,
  key: string | null | undefined
): string | null {
  if (!key?.trim()) return null;
  const needle = key.trim().toLowerCase();
  const entry = Object.entries(map).find(
    ([candidate]) => candidate.trim().toLowerCase() === needle
  );
  return entry?.[1] ?? null;
}

/**
 * Fail-closed title and reporting-chain mapping. Email overrides win, then
 * governed title, then manager email, then Entra groups as fallback.
 */
export function previewIdentityMapping(
  identity: SsoIdentity,
  access: AccessSettings = DEFAULT_ACCESS
): IdentityMappingPreview {
  const emailRole = lookupRole(access.emailRoles, identity.email);
  const titleRole = lookupRole(access.titleRoles, identity.title);
  const managerRole = lookupRole(access.managerRoles, identity.managerEmail);
  const groupRole = identity.groups
    .map((group) => {
      const hit = lookupRole(access.groupRoles, group);
      return hit ? { ...hit, group } : null;
    })
    .find((hit) => hit != null);

  const mapped =
    emailRole != null
      ? {
          source: "email" as const,
          role: emailRole.role,
          matchedKey: emailRole.matchedKey,
        }
      : titleRole != null
        ? {
            source: "title" as const,
            role: titleRole.role,
            matchedKey: titleRole.matchedKey,
          }
        : managerRole != null
          ? {
              source: "manager" as const,
              role: managerRole.role,
              matchedKey: managerRole.matchedKey,
            }
          : groupRole != null
            ? {
                source: "group" as const,
                role: groupRole.role,
                matchedKey: groupRole.group,
              }
            : {
                source: "unmapped" as const,
                role: null,
                matchedKey: null,
              };

  const region =
    lookupRegion(access.emailRegions, identity.email) ??
    identity.groups
      .map((group) => lookupRegion(access.groupRegions, group))
      .find((value): value is string => Boolean(value)) ??
    null;

  return { ...mapped, region };
}

function mappedRolesFromAdapter(
  identity: SsoIdentity,
  access: AccessSettings
): Role[] {
  const preview = previewIdentityMapping(identity, access);
  return preview.role ? [preview.role] : [];
}

export { mappedRolesFromAdapter };
