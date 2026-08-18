import { DomainError } from "@/domain/errors";
import type { Principal } from "@/lib/authorization/types";

/** Home region is the creator's workspace/user region, never the Salesforce house office. */
export function resolveCreatorHomeRegion(
  principal: Principal,
  requested?: string | null
): string {
  if (principal.workspace.kind === "region") return principal.workspace.region;
  if (principal.allowedRegions === "all" && requested?.trim())
    return requested.trim();
  if (principal.user.region) return principal.user.region;
  if (requested?.trim()) return requested.trim();
  throw DomainError.badRequest("Home region is required");
}
