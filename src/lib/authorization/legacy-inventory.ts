/**
 * Frozen inventory of residual legacy callers. Architecture tests reject any new
 * caller. Later phases remove entries as admin/UI paths migrate fully.
 */
export const LEGACY_POLICY_CALLERS = [
  "src/actions/data-quality.ts",
  "src/actions/governance.ts",
  "src/actions/sheets.ts",
  "src/app/admin/page.tsx",
  "src/app/api/export/bid-schedule/route.ts",
  "src/app/api/v1/mobile/admin/route.ts",
  "src/app/api/v1/mobile/overview/route.ts",
  "src/app/bid-schedule/page.tsx",
  "src/app/jobs/[id]/page.tsx",
  "src/app/page.tsx",
  "src/app/rounds/[id]/page.tsx",
  "src/app/sheets/page.tsx",
  "src/components/app-header.tsx",
  "src/components/bid-schedule/status-menu.tsx",
  "src/components/role-switcher.tsx",
  "src/components/status-badge.tsx",
  "src/lib/outcome.ts",
  "src/services/pursuit-service.ts",
] as const;

export const LEGACY_DIRECT_ID_LOADERS = [
  "src/actions/admin.ts",
  "src/actions/api-tokens.ts",
  "src/actions/dashboards.ts",
  "src/actions/data-quality.ts",
  "src/actions/distribution.ts",
  "src/actions/governance.ts",
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
