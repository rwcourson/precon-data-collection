import type { ApiTokenScope } from "@/domain/contracts";
import type { Role, RoundStatus, User } from "@/db/schema";

export type AuthSource = "demo_session" | "sso" | "api_token" | "service";
export type Capability =
  | "read"
  | "edit"
  | "manage"
  | "approve"
  | "distribute"
  | "integrate"
  | "restore"
  | "permanent-delete";
export type ResourceType =
  | "job"
  | "round"
  | "sheet"
  | "dashboard"
  | "report"
  | "admin"
  | "trash";

export type EffectiveWorkspace =
  | { kind: "corporate"; region: null }
  | { kind: "region"; region: string };

export type TokenConstraints = {
  tokenId: number;
  scopes: readonly ApiTokenScope[];
  regionAllowlist: readonly string[];
  expiresAt: Date | null;
};

export type Principal = {
  authSource: AuthSource;
  user: User;
  workspace: EffectiveWorkspace;
  /** `all` is explicit cross-Region scope, never an omitted constraint. */
  allowedRegions: "all" | readonly string[];
  token: TokenConstraints | null;
};

export type SheetAclGrant = {
  userId: number | null;
  grantRole: Role | null;
  acl: "viewer" | "editor" | "manager";
  regionAllowlist: string[] | null;
};

export type FieldWriteOverride = {
  role: Role;
  allowedStatuses: string[];
  regionScoped: boolean;
};

export type ResourceDescriptor = {
  type: ResourceType;
  id: number | string;
  region: string | null;
  ownerId: number | null;
  published: boolean;
  deleted: boolean;
  parent?: Pick<ResourceDescriptor, "type" | "id" | "region" | "ownerId" | "published" | "deleted">;
  dashboardScope?: "personal" | "region" | "corporate";
  sharedWithUserIds?: readonly number[];
  sharedWithRegions?: readonly string[];
  sheetAcls?: readonly SheetAclGrant[];
  round?: { status: RoundStatus; region: string };
  fieldKey?: string;
  fieldPolicy?: FieldWriteOverride | null;
  adminSection?: string;
};

export type AuthorizationDecision =
  | { allowed: true; capability: Capability }
  | {
      allowed: false;
      capability: Capability;
      reason:
        | "deleted-state"
        | "region"
        | "token"
        | "ownership"
        | "publication"
        | "acl"
        | "role"
        | "field-policy"
        | "unsupported";
    };
