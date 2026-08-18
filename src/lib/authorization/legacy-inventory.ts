/**
 * Frozen inventory of residual legacy callers. Architecture tests reject any new
 * caller. Later phases remove entries as admin/UI paths migrate fully.
 *
 * Phase 1 (Jay McDaniel roadmap) migrated permission helpers to `authorize()`
 * and display labels to `src/lib/labels.ts`. The policy-caller list is empty.
 * Direct-by-ID loaders remain where a scoped loader is not yet the right
 * primitive (see docs/security/legacy-authorization-inventory.md).
 */
export const LEGACY_POLICY_CALLERS: readonly string[] = [];

export const LEGACY_DIRECT_ID_LOADERS = [
  "src/actions/admin.ts",
  "src/actions/api-tokens.ts",
  "src/actions/dashboards.ts",
  "src/actions/data-quality.ts",
  "src/actions/distribution.ts",
  "src/actions/governance.ts",
  "src/actions/people.ts",
  "src/actions/reports.ts",
  "src/actions/salesforce-inbox.ts",
  "src/actions/sheets.ts",
  "src/actions/templates.ts",
  "src/lib/auth.ts",
  "src/lib/email.ts",
  "src/lib/export-jobs.ts",
  "src/lib/mobile-auth.ts",
  "src/lib/queries.ts",
  "src/lib/recovery.ts",
] as const;

export const LEGACY_PERMISSION_SYMBOLS = [
  "canCreatePursuit",
  "canEditBidSchedule",
  "canEnterPostBid",
  "canApproveLock",
  "canEditAfterLock",
  "canManageCompanyColumns",
  "canManageRegionColumns",
  "canManageReferenceLists",
  "canViewAudit",
  "allowedTransitions",
  "canWriteField",
  "resolveSheetCapability",
  "assertCanWriteField",
  "assertSheetCapability",
  "canManageSheet",
  "canCreateSheet",
  "canEditRows",
] as const;
