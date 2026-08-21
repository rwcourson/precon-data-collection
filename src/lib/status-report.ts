import "server-only";

import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  customColumns,
  dataQualityFlags,
  referenceLists,
  referenceListValues,
  savedReports,
  users,
} from "@/db/schema";
import { authMode } from "./auth";
import { emailProvider } from "./email";
import { FIELD_DEFS } from "./fields";
import { connectMode } from "./integrations/connect";
import { databricksConfig } from "./integrations/databricks/client";
import { METRIC_DEFS, METRIC_GROUPS } from "./metrics";
import {
  buildMigrationReport,
  type ChecklistItem,
  cutoverChecklist,
  getImportSource,
  type MigrationReport,
} from "./migration";
import {
  describeSheet,
  type ImportSource,
  sourceYears,
} from "./migration-source";
import type { Workspace } from "./workspace";

/**
 * Sponsor-facing status and roadmap document: what has been built, what is
 * waiting on B&G IT, and what still needs a decision from the business. Every
 * number is read from the running system at request time so the PDF cannot
 * drift from the app the way a hand-written status deck does.
 */

export type CapabilityRow = {
  area: string;
  /** Where it lives in the app, or what evidence backs the claim. */
  evidence: string;
  state: "live" | "live-mock" | "blocked";
};

export type OpenQuestion = {
  question: string;
  why: string;
  /** What the team does if no answer arrives before cutover. */
  fallback: string;
};

export type StatusReport = {
  scope: string;
  generatedAt: Date;
  migration: MigrationReport;
  checklist: ChecklistItem[];
  source: ImportSource | null;
  counts: {
    metrics: number;
    metricGroups: number;
    requiredFields: number;
    optionalFields: number;
    referenceLists: number;
    referenceValues: number;
    customColumns: number;
    savedReports: number;
    users: number;
    resolvedFlags: number;
  };
  capabilities: CapabilityRow[];
  decisions: { question: string; answer: string }[];
  questions: OpenQuestion[];
};

export async function buildStatusReport(
  workspace: Workspace
): Promise<StatusReport> {
  const [migration, source, lists, values, cols, reports, people, resolved] =
    await Promise.all([
      buildMigrationReport(workspace),
      getImportSource(),
      db.select({ n: count() }).from(referenceLists),
      db.select({ n: count() }).from(referenceListValues),
      db.select({ n: count() }).from(customColumns),
      db.select({ n: count() }).from(savedReports),
      db.select({ n: count() }).from(users),
      db
        .select({ n: count() })
        .from(dataQualityFlags)
        .where(eq(dataQualityFlags.kind, "missing_required")),
    ]);

  const mode = {
    auth: authMode(),
    connect: connectMode(),
    email: emailProvider(),
  };
  const warehouse = Boolean(databricksConfig());

  const checklist = cutoverChecklist(migration, {
    authMode: mode.auth,
    connectMode: mode.connect,
    warehouseConfigured: warehouse,
    emailProvider: mode.email,
  });

  const requiredFields = FIELD_DEFS.filter((f) => f.tier === "required").length;

  return {
    scope: migration.scope,
    generatedAt: new Date(),
    migration,
    checklist,
    source,
    counts: {
      metrics: METRIC_DEFS.length,
      metricGroups: METRIC_GROUPS.length,
      requiredFields,
      optionalFields: FIELD_DEFS.length - requiredFields,
      referenceLists: lists[0]?.n ?? 0,
      referenceValues: values[0]?.n ?? 0,
      customColumns: cols[0]?.n ?? 0,
      savedReports: reports[0]?.n ?? 0,
      users: people[0]?.n ?? 0,
      resolvedFlags: resolved[0]?.n ?? 0,
    },
    capabilities: capabilities({
      metrics: METRIC_DEFS.length,
      requiredFields,
      optionalFields: FIELD_DEFS.length - requiredFields,
      lists: lists[0]?.n ?? 0,
      values: values[0]?.n ?? 0,
      mode,
      warehouse,
    }),
    decisions: DECISIONS,
    questions: OPEN_QUESTIONS,
  };
}

/**
 * Sponsor answers already given, restated so the roadmap can be read without
 * the email thread that produced it.
 */
const DECISIONS: { question: string; answer: string }[] = [
  {
    question: "How many historical bid years migrate?",
    answer:
      "All of them. Every year Smartsheet holds moves across; the extract supplied so far covers 2026 only, so the remaining years need a fresh export before cutover.",
  },
  {
    question: "How are legacy import problems remediated?",
    answer:
      "Bulk-confirm. Imported values are accepted as history in one action, and validation applies to entries made from cutover forward rather than rewriting the past.",
  },
];

const OPEN_QUESTIONS: OpenQuestion[] = [
  {
    question: "Notification channel and reminder cadence",
    why: "Submitted-round alerts and overdue post-bid reminders are built and running, but they currently write to an in-app inbox and an email outbox rather than sending mail.",
    fallback:
      "Launch with in-app notifications only and turn on email by setting a provider key once IT approves the sender domain.",
  },
  {
    question: "Access to B&G CORP 2026 Estimate Metrics Capture",
    why: "The calculated columns were rebuilt from the Destini markup and the process deck. The Smartsheet metrics sheet is the only complete list of the formulas leadership sees today.",
    fallback:
      "Ship the current calculated set and reconcile against the sheet in a follow-up pass; the Migration tab already reports which columns reproduce from migrated data.",
  },
  {
    question:
      "Definitions for Business Strategy Values and Project Planning Precon Engagement",
    why: "Both appear in the Destini markup without a value list or format, so neither can be validated.",
    fallback:
      "Collect them as free text until a list is defined, then convert to a managed list.",
  },
];

function capabilities(ctx: {
  metrics: number;
  requiredFields: number;
  optionalFields: number;
  lists: number;
  values: number;
  mode: { auth: string; connect: string; email: string };
  warehouse: boolean;
}): CapabilityRow[] {
  return [
    {
      area: "Pursuit lifecycle and audit",
      evidence:
        "Active → Bid Complete → Submitted → Post-Bid → Locked, with every status change and post-lock edit written to the audit log.",
      state: "live",
    },
    {
      area: "Bid Schedule",
      evidence:
        "Standalone module with Region, department, phase and date filters, saved filter presets, and Excel / PDF export.",
      state: "live",
    },
    {
      area: "Post-bid data collection",
      evidence: `${ctx.requiredFields} required and ${ctx.optionalFields} optional fields from the Destini markup, with $0 accepted and blanks blocking approval.`,
      state: "live",
    },
    {
      area: "Conditional field logic",
      evidence:
        "Cost of Work Basis appears only for Rate Only rounds; IJV selection drives lead Region and department defaults.",
      state: "live",
    },
    {
      area: "Approval and lock",
      evidence:
        "RPD approves and locks a round; later edits require a reason and are attributed in the audit trail.",
      state: "live",
    },
    {
      area: "Calculated columns",
      evidence: `${ctx.metrics} calculated columns (fee, contingency, GC/GR, labor, productivity, per-square-foot and per-PM-month ratios) surfaced on round detail, dashboards, and the report builder.`,
      state: "live",
    },
    {
      area: "Region workspaces and Corporate rollup",
      evidence:
        "A workspace switcher scopes Bid Schedule, post-bid, dashboards and reports to one Region; Corporate sees every Region in one view — the rollup disconnected Smartsheets cannot produce.",
      state: "live",
    },
    {
      area: "Dashboards and Annual Regional Report",
      evidence:
        "Corporate, Region and department dashboards plus a leadership Annual Report with multi-year trend, sector and department breakdowns, and the year's wins, as real PDF and Excel.",
      state: "live",
    },
    {
      area: "Custom report builder",
      evidence:
        "Column, filter, grouping and sort control, saved and shared per person or Region.",
      state: "live",
    },
    {
      area: "Regional customization without IT",
      evidence: `Two-tier custom columns (Corporate-wide and Region-owned) and ${ctx.lists} managed reference lists holding ${ctx.values.toLocaleString()} values, all editable in the app.`,
      state: "live",
    },
    {
      area: "Import and data-quality remediation",
      evidence:
        "Smartsheet history imports with provenance, and every blank required field or off-list value lands in a Needs Review queue that can be cleared column by column or confirmed in bulk.",
      state: "live",
    },
    {
      area: "Notifications and reminder cadence",
      evidence:
        ctx.mode.email === "stub"
          ? "Submitted alerts and overdue post-bid reminders run on a configurable cadence into the in-app inbox and an email outbox; no mail leaves the system until a provider key is set."
          : "Submitted alerts and overdue reminders deliver through the configured email provider.",
      state: ctx.mode.email === "stub" ? "live-mock" : "live",
    },
    {
      area: "Identity and roles",
      evidence:
        ctx.mode.auth === "sso"
          ? "Identity and role come from the B&G identity provider; the demo persona picker is disabled."
          : "Role mapping from identity-provider groups is built and configurable; the app still runs on demo personas until SSO headers are wired.",
      state: ctx.mode.auth === "sso" ? "live" : "blocked",
    },
    {
      area: "B&G Connect / Salesforce",
      evidence:
        ctx.mode.connect === "rest"
          ? "Job lookup and match-and-merge read the live Connect facade."
          : "Job lookup, match-and-merge and unlinked-job handling all work against a seeded mirror; switching to the live API is a configuration change, not a rebuild.",
      state: ctx.mode.connect === "rest" ? "live" : "blocked",
    },
    {
      area: "Databricks / Power BI feed",
      evidence: ctx.warehouse
        ? "Scheduled feed pushes rounds, calculated columns and custom columns to the warehouse table."
        : "Feed and schedule endpoint are built and can be previewed row by row; pushing needs warehouse credentials.",
      state: ctx.warehouse ? "live" : "blocked",
    },
    {
      area: "Mobile access",
      evidence:
        "Responsive web covers phone and tablet entry today; native apps remain a later decision.",
      state: "live",
    },
  ];
}

// ---- HTML rendering (feeds the PDF engine and the on-screen preview) ----

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const STATE_LABEL: Record<CapabilityRow["state"], string> = {
  live: "Built",
  "live-mock": "Built · limited",
  blocked: "Built · needs IT",
};

export function renderStatusReportHtml(r: StatusReport): string {
  const years = [...new Set(r.migration.years.map((y) => y.bidYear))].sort(
    (a, b) => b - a
  );
  const blocked = r.checklist.filter((c) => c.blocker && !c.done);
  const extractYears = r.source ? sourceYears(r.source.filesUsed) : [];
  // Bid years that arrived on undated sheets, so the reader does not read the
  // metrics-sheet gap and the year table as contradicting each other.
  const strayYears = years
    .filter((y) => !extractYears.includes(y))
    .sort((a, b) => a - b);

  const kpis = [
    {
      label: "Estimate rounds migrated",
      value: r.migration.totalRounds.toLocaleString(),
    },
    { label: "Jobs", value: r.migration.totalJobs.toLocaleString() },
    {
      label: "Bid years present",
      value: years.length ? years.join(", ") : "—",
    },
    { label: "Calculated columns", value: String(r.counts.metrics) },
    {
      label: "Collected fields",
      value: `${r.counts.requiredFields} req · ${r.counts.optionalFields} opt`,
    },
    {
      label: "Managed list values",
      value: r.counts.referenceValues.toLocaleString(),
    },
    {
      label: "Values awaiting review",
      value: r.migration.openFlags.toLocaleString(),
    },
    {
      label: "Launch gates open",
      value: `${blocked.length} of ${r.checklist.length}`,
    },
  ];

  const capabilityRows = r.capabilities
    .map(
      (c) => `<tr>
      <td class="strong">${esc(c.area)}</td>
      <td><span class="pill ${c.state}">${esc(STATE_LABEL[c.state])}</span></td>
      <td>${esc(c.evidence)}</td>
    </tr>`
    )
    .join("");

  const yearRows = r.migration.years
    .map(
      (y) => `<tr>
      <td>${y.bidYear}</td>
      <td>${esc(y.region)}</td>
      <td class="num">${y.rounds.toLocaleString()}</td>
      <td class="num">${Math.round(y.completeness * 100)}%</td>
      <td class="num">${Math.round(y.estimateValueCoverage * 100)}%</td>
      <td class="num">${y.openFlags.toLocaleString()}</td>
    </tr>`
    )
    .join("");

  const checklistRows = r.checklist
    .map(
      (c) => `<tr>
      <td class="mark ${c.done ? "yes" : c.blocker ? "gate" : "todo"}">${c.done ? "Done" : c.blocker ? "Gate" : "Open"}</td>
      <td class="strong">${esc(c.label)}</td>
      <td>${esc(c.detail)}</td>
    </tr>`
    )
    .join("");

  const decisionRows = r.decisions
    .map(
      (d) => `<div class="callout">
      <p class="callout-q">${esc(d.question)}</p>
      <p class="callout-a">${esc(d.answer)}</p>
    </div>`
    )
    .join("");

  const questionRows = r.questions
    .map(
      (q) => `<tr>
      <td class="strong">${esc(q.question)}</td>
      <td>${esc(q.why)}</td>
      <td>${esc(q.fallback)}</td>
    </tr>`
    )
    .join("");

  const skipped = r.source
    ? r.source.filesSkipped
        .map((f) => {
          const { region, sheet } = describeSheet(f);
          return `${region} · ${sheet}`;
        })
        .slice(0, 8)
    : [];

  const roadmap = [
    {
      phase: "Complete",
      title: "Process parity and leadership deliverables",
      body: "Lifecycle, field dictionary, validation and lock, Region workspaces with Corporate rollup, the full calculated column set, dashboards, Annual Regional Report, custom report builder, PDF and Excel exports, import review queue, and reminder cadence.",
    },
    {
      phase: "Ready, awaiting IT",
      title: "Production spine",
      body: `Single sign-on with role mapping, the live Connect / Salesforce facade, and the Databricks feed are all built behind configuration. ${
        blocked.length === 0
          ? "All three are switched on."
          : `Still outstanding: ${blocked.map((b) => b.label).join(", ")}. Each is a credential or a forwarded header, not further development.`
      }`,
    },
    {
      phase: "Next",
      title: "Cutover",
      body: "Export the remaining Smartsheet bid years, confirm the legacy baseline, freeze Smartsheet entry, and run one bid cycle with both systems open before retiring the workspace.",
    },
    {
      phase: "Later",
      title: "Estimating system autofill",
      body: "Destini and InEight autofill for cost fields, BuildingConnected sub-quote and MWDBE pulls, and a native mobile decision once web usage patterns are known.",
    },
  ]
    .map(
      (p) => `<tr>
      <td class="strong">${esc(p.phase)}</td>
      <td class="strong">${esc(p.title)}</td>
      <td>${esc(p.body)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Precon Data Collection — Status &amp; Roadmap</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; margin: 30px; color: #16202b; }
  .cover { border-bottom: 3px solid #1e3a5f; padding-bottom: 14px; margin-bottom: 20px; }
  .eyebrow { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #64748b; margin: 0 0 6px; }
  h1 { font-size: 25px; margin: 0 0 4px; color: #1e3a5f; letter-spacing: -0.01em; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #1e3a5f; margin: 24px 0 9px; }
  .meta { font-size: 12px; color: #64748b; margin: 0; }
  .lede { font-size: 12px; line-height: 1.55; color: #334155; margin: 0 0 4px; max-width: 62em; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .kpi { border: 1px solid #dbe3ec; border-radius: 6px; padding: 9px 11px; }
  .kpi .label { font-size: 9.5px; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
  .kpi .value { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; margin-top: 2px; }
  table { border-collapse: collapse; width: 100%; font-size: 10.5px; }
  th { background: #1e3a5f; color: white; text-align: left; padding: 6px 8px; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; line-height: 1.45; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.strong { font-weight: 600; }
  .pill { display: inline-block; white-space: nowrap; border-radius: 3px; padding: 1.5px 6px; font-size: 9px; font-weight: 600; }
  .pill.live { background: #dcfce7; color: #14532d; }
  .pill.live-mock { background: #e0f2fe; color: #0c4a6e; }
  .pill.blocked { background: #fef3c7; color: #78350f; }
  td.mark { font-weight: 600; font-size: 9.5px; white-space: nowrap; }
  td.mark.yes { color: #15803d; }
  td.mark.gate { color: #b45309; }
  td.mark.todo { color: #64748b; }
  .callout { border-left: 3px solid #1e3a5f; background: #f6f8fb; padding: 8px 12px; margin-bottom: 7px; }
  .callout-q { font-size: 12px; font-weight: 600; margin: 0 0 2px; }
  .callout-a { font-size: 10.5px; color: #334155; margin: 0; line-height: 1.5; }
  .note { font-size: 9.5px; color: #94a3b8; margin-top: 6px; line-height: 1.5; }
  .toolbar { position: fixed; top: 12px; right: 12px; }
  .toolbar button { padding: 8px 16px; background: #1e3a5f; color: white; border: 0; border-radius: 6px; cursor: pointer; font-size: 13px; }
  @media print { .toolbar { display: none; } body { margin: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>

  <header class="cover">
    <p class="eyebrow">Brasfield &amp; Gorrie · Preconstruction</p>
    <h1>Precon Data Collection — Status &amp; Roadmap</h1>
    <p class="meta">${esc(r.scope)} · Generated ${r.generatedAt.toLocaleDateString("en-US", { dateStyle: "long" })} from live application data</p>
  </header>

  <p class="lede">
    The replacement for the Smartsheet <em>B&amp;G Precon Pursuits and Data</em> workspace is
    functionally complete. Bid Schedule, post-bid collection, approval and lock, Region workspaces,
    the calculated column set, dashboards, the Annual Regional Report and the custom report builder
    all run today against ${r.migration.totalRounds.toLocaleString()} migrated estimate rounds.
    ${
      blocked.length === 0
        ? "Every production integration is switched on."
        : `What remains is not development: ${blocked.length} ${blocked.length === 1 ? "integration is" : "integrations are"} written and waiting on credentials from B&amp;G IT.`
    }
  </p>

  <h2>Where it stands</h2>
  <div class="grid">
    ${kpis
      .map(
        (k) => `<div class="kpi">
      <div class="label">${esc(k.label)}</div>
      <div class="value">${esc(k.value)}</div>
    </div>`
      )
      .join("")}
  </div>

  <h2>What is built</h2>
  <table>
    <thead><tr><th style="width:20%">Capability</th><th style="width:12%">State</th><th>Evidence in the running app</th></tr></thead>
    <tbody>${capabilityRows}</tbody>
  </table>

  <h2>Decisions confirmed</h2>
  ${decisionRows}

  <h2>Migration status</h2>
  ${
    r.source
      ? `<p class="lede">${r.source.rounds.toLocaleString()} rounds and ${r.source.jobs.toLocaleString()} jobs were read from ${r.source.filesUsed.length} Smartsheet sheets on ${new Date(r.source.importedAt).toLocaleDateString("en-US", { dateStyle: "long" })}.        ${
          extractYears.length
            ? ` Only ${esc(extractYears.join(", "))} Estimate Metrics Capture sheets exist in that extract${
                strayYears.length
                  ? ` — the ${strayYears.join(" and ")} rounds below came in on bid schedule sheets, which are not dated`
                  : ""
              }, so the agreed "all years" scope needs a further export of the earlier bid years before cutover.`
            : ""
        }</p>`
      : ""
  }
  <table>
    <thead><tr>
      <th>Bid Year</th><th>Region</th><th class="num">Rounds</th>
      <th class="num">Required complete</th><th class="num">Has estimate value</th><th class="num">Awaiting review</th>
    </tr></thead>
    <tbody>${yearRows || `<tr><td colspan="6">No rounds in scope.</td></tr>`}</tbody>
  </table>
  ${
    skipped.length > 0
      ? `<p class="note">Sheets present in the extract but deliberately not imported, because they are dashboards, rollups, checklists or scope views derived from sheets already loaded: ${esc(skipped.join("; "))}${r.source && r.source.filesSkipped.length > skipped.length ? `, and ${r.source.filesSkipped.length - skipped.length} more` : ""}.</p>`
      : ""
  }

  <h2>Cutover checklist</h2>
  <table>
    <thead><tr><th style="width:8%">State</th><th style="width:22%">Gate</th><th>Detail</th></tr></thead>
    <tbody>${checklistRows}</tbody>
  </table>
  <p class="note">Evaluated against live application state at generation time, not maintained by hand. Items marked <strong>Gate</strong> cannot be cleared from inside the app and depend on B&amp;G IT.</p>

  <h2>Roadmap</h2>
  <table>
    <thead><tr><th style="width:14%">Phase</th><th style="width:22%">Focus</th><th>Scope</th></tr></thead>
    <tbody>${roadmap}</tbody>
  </table>

  <h2>Open questions for the business</h2>
  <table>
    <thead><tr><th style="width:22%">Question</th><th style="width:39%">Why it matters</th><th>If we do not hear back</th></tr></thead>
    <tbody>${questionRows}</tbody>
  </table>
</body>
</html>`;
}
