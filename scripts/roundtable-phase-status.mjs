#!/usr/bin/env node
/**
 * In-repo evidence for RPD Roundtable phases 0–16.
 * Software is proven by required files. Operational owner gates stay fail-closed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

const phases = [
  {
    id: 0,
    name: "Contract",
    files: [
      "docs/rpd-roundtable-product-contract.md",
      "docs/adr/003-canonical-one-job-schedule-projection.md",
      "docs/adr/004-approval-requests-separate-from-round-status.md",
      "docs/adr/005-organization-membership-vs-region-visibility.md",
      "docs/adr/006-versioned-lock-revisions-and-publication-outbox.md",
      "docs/adr/007-locked-only-databricks-publication.md",
      "docs/mocks/nested-self-perform.md",
      "src/lib/product.ts",
    ],
  },
  {
    id: 1,
    name: "Safety",
    files: [
      "src/lib/rollout.ts",
      "src/lib/rollout.test.ts",
      "src/lib/preview-isolation.ts",
      "src/lib/preview-isolation.test.ts",
      "docs/roundtable-rollback.md",
      "docs/checklists/roundtable-phases.md",
    ],
  },
  {
    id: 2,
    name: "Chrome",
    files: [
      "src/lib/navigation.ts",
      "src/lib/navigation.test.ts",
      "src/lib/route-access.ts",
      "src/lib/route-access.test.ts",
      "src/lib/title-mapping-adapter.ts",
      "src/lib/title-mapping-adapter.test.ts",
      "src/components/ui/field-help.tsx",
    ],
  },
  {
    id: 3,
    name: "Projection",
    files: [
      "src/lib/schedule-projection.ts",
      "src/lib/schedule-projection.test.ts",
      "src/lib/table-prefs.ts",
    ],
  },
  {
    id: 4,
    name: "Schedule UX",
    files: [
      "src/lib/bid-schedule.ts",
      "src/lib/bid-schedule.test.ts",
      "src/lib/overview-queues.ts",
      "src/components/bid-schedule/export-dialog.tsx",
    ],
  },
  {
    id: 5,
    name: "View modes",
    files: [
      "src/components/bid-schedule/schedule-modes.tsx",
      "src/components/bid-schedule/gantt-lazy.tsx",
      "scripts/ui-audit.mjs",
      "scripts/smoke.mjs",
    ],
  },
  {
    id: 6,
    name: "Phase form",
    files: ["src/components/rounds/entry-form.tsx", "src/lib/fields.ts"],
  },
  {
    id: 7,
    name: "Salesforce",
    files: [
      "src/lib/salesforce-link.ts",
      "src/lib/salesforce-link.test.ts",
      "src/lib/integrations/connect/normalize.ts",
      "src/lib/integrations/connect/fallback.ts",
    ],
  },
  {
    id: 8,
    name: "Groups",
    files: [
      "src/lib/organization-visibility.test.ts",
      "src/lib/job-parent.ts",
      "src/lib/job-parent.test.ts",
      "src/services/organization-service.ts",
      "src/components/jobs/group-membership-editor.tsx",
      "src/components/rounds/staffing-card.tsx",
    ],
  },
  {
    id: 9,
    name: "Approvals",
    files: [
      "src/lib/approval.integration.test.ts",
      "src/services/approval-service.ts",
      "src/lib/who-can-edit.ts",
      "src/components/bid-schedule/pending-approval-strip.tsx",
    ],
  },
  {
    id: 10,
    name: "Lock lifecycle",
    files: [
      "src/lib/lock-lifecycle.integration.test.ts",
      "src/lib/lock-revisions.ts",
      "src/services/lock-lifecycle-service.ts",
      "src/components/rounds/unlock-round-button.tsx",
    ],
  },
  {
    id: 11,
    name: "Field policy",
    files: [
      "src/lib/field-policy.test.ts",
      "src/lib/metrics.test.ts",
      "src/lib/validation.ts",
      "src/services/field-exceptions-service.ts",
    ],
  },
  {
    id: 12,
    name: "Change awareness",
    files: [
      "src/lib/change-watermarks.ts",
      "src/lib/change-watermarks.test.ts",
      "src/lib/change-awareness.integration.test.ts",
      "src/lib/date-shift-recipients.ts",
      "src/lib/date-shift-recipients.test.ts",
      "src/components/bid-schedule/acknowledge-changes-button.tsx",
      "src/components/bid-schedule/acknowledge-visible-button.tsx",
    ],
  },
  {
    id: 13,
    name: "Awardable reporting",
    files: [
      "src/lib/awardable-reporting.ts",
      "src/lib/awardable-reporting.test.ts",
      "fixtures/roundtable-locked-frozen.json",
      "scripts/frozen-fixture-report.ts",
    ],
    operational: "LUCY_FROZEN_FIXTURE_SIGNED_OFF",
  },
  {
    id: 14,
    name: "Ingestion",
    files: [
      "src/lib/destini-import.ts",
      "src/lib/destini-import.test.ts",
      "src/components/rounds/destini-round-import.tsx",
      "src/lib/smartsheet-dump.ts",
      "src/lib/smartsheet-dump.test.ts",
      "scripts/smartsheet-dump-counts.ts",
      "scripts/smartsheet-live-counts.ts",
      "docs/smartsheet-cutover.md",
      "docs/destini-adapter.md",
      "src/lib/time-card-join.ts",
    ],
    operational: "SMARTSHEET_DUMP_SIGNED_OFF",
  },
  {
    id: 15,
    name: "Warehouse",
    files: [
      "src/lib/integrations/databricks/publication-sql.ts",
      "src/lib/integrations/databricks/publication-sql.test.ts",
      "src/lib/integrations/databricks/feed.ts",
      "src/lib/integrations/databricks/feed.test.ts",
      "src/lib/magnus-scope.ts",
      "docs/adr/007-locked-only-databricks-publication.md",
      "scripts/warehouse-readiness.mjs",
    ],
    operational: ["DATABRICKS_MERGE_SIGNED_OFF", "POWERBI_PARITY_SIGNED_OFF"],
  },
  {
    id: 16,
    name: "Harden",
    files: [
      "docs/roundtable-cohort-rollout.md",
      "docs/security/roundtable-review.md",
      "docs/checklists/operational-signoff.md",
      "docs/checklists/roundtable-exit-audit.md",
      ".github/workflows/ci.yml",
      "scripts/run-isolated-smoke.mjs",
      "scripts/run-isolated-ui-audit.mjs",
    ],
  },
];

const rows = phases.map((phase) => {
  const missing = phase.files.filter((file) => !exists(file));
  const opsKeys = phase.operational
    ? Array.isArray(phase.operational)
      ? phase.operational
      : [phase.operational]
    : [];
  const ops = Object.fromEntries(
    opsKeys.map((key) => [key, process.env[key] === "1"])
  );
  return {
    phase: phase.id,
    name: phase.name,
    software: missing.length === 0,
    missing,
    operationalSigned: opsKeys.length === 0 ? null : ops,
  };
});

const softwareDone = rows.every((row) => row.software);
const operationalBlocking = rows.filter(
  (row) =>
    row.operationalSigned &&
    Object.values(row.operationalSigned).some((signed) => !signed)
);

const report = {
  softwareDone,
  operationalUnsigned: operationalBlocking.map((row) => ({
    phase: row.phase,
    name: row.name,
    operationalSigned: row.operationalSigned,
  })),
  phases: rows,
  note: "Operational gates stay fail-closed. This script never signs Lucy, Power BI, Smartsheet, or Databricks MERGE.",
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!softwareDone) process.exit(1);
