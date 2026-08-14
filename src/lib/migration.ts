import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, dataQualityFlags } from "@/db/schema";
import { IMPORT_SOURCE_KEY, type ImportSource } from "./migration-source";
import { METRIC_DEFS } from "./metrics";
import { getMultiValuesForRounds, getRoundsWithJobs } from "./queries";
import { requiredCompletion } from "./validation";
import type { Workspace } from "./workspace";

/**
 * Cutover support (BRD Section 17). Migrating multiple Smartsheet years is only
 * defensible if someone can see, per Region and Bid Year, how much of the old
 * sheet actually landed and which calculated columns can be reproduced. This
 * builds that reconciliation rather than asserting the import "worked".
 */

export type YearRow = {
  bidYear: number;
  region: string;
  rounds: number;
  linkedJobs: number;
  lockedRounds: number;
  /** Mean share of applicable required fields that carry a value. */
  completeness: number;
  openFlags: number;
  estimateValueCoverage: number;
};

export type MetricCoverage = {
  key: string;
  label: string;
  group: string;
  /** Share of post-bid rounds where the formula produces a number. */
  computable: number;
};

export type MigrationReport = {
  scope: string;
  totalRounds: number;
  totalJobs: number;
  linkedPct: number;
  openFlags: number;
  years: YearRow[];
  metrics: MetricCoverage[];
  /** Field keys that are blank on every migrated round in scope. */
  neverPopulated: { key: string; label: string }[];
};

export async function getImportSource(): Promise<ImportSource | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, IMPORT_SOURCE_KEY));
  return row ? (row.value as ImportSource) : null;
}

export async function buildMigrationReport(workspace: Workspace): Promise<MigrationReport> {
  const rows = await getRoundsWithJobs(workspace);
  const multiMap = await getMultiValuesForRounds(rows.map((r) => r.round.id));
  const flags = await db.select().from(dataQualityFlags);

  const inScope = new Set(rows.map((r) => r.round.id));
  const openByRound = new Map<number, number>();
  for (const f of flags) {
    if (f.resolvedAt != null || !inScope.has(f.roundId)) continue;
    openByRound.set(f.roundId, (openByRound.get(f.roundId) ?? 0) + 1);
  }

  const buckets = new Map<string, YearRow>();
  for (const { round, job } of rows) {
    const key = `${round.bidYear}\u241F${round.region}`;
    const b =
      buckets.get(key) ??
      {
        bidYear: round.bidYear,
        region: round.region,
        rounds: 0,
        linkedJobs: 0,
        lockedRounds: 0,
        completeness: 0,
        openFlags: 0,
        estimateValueCoverage: 0,
      };
    b.rounds++;
    if (job.isLinked) b.linkedJobs++;
    if (round.status === "locked") b.lockedRounds++;
    if (round.estimateValue != null) b.estimateValueCoverage++;
    const { done, total } = requiredCompletion(round, multiMap.get(round.id) ?? {}, {
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      estimateLeadName: round.estimateLeadId ? "assigned" : null,
    });
    b.completeness += total ? done / total : 0;
    b.openFlags += openByRound.get(round.id) ?? 0;
    buckets.set(key, b);
  }

  const years = [...buckets.values()]
    .map((b) => ({
      ...b,
      completeness: b.rounds ? b.completeness / b.rounds : 0,
      estimateValueCoverage: b.rounds ? b.estimateValueCoverage / b.rounds : 0,
    }))
    .sort((a, b) => b.bidYear - a.bidYear || a.region.localeCompare(b.region));

  // Metric reproducibility is only meaningful once a round has post-bid data.
  const postBid = rows.filter((r) => ["submitted", "post_bid", "locked"].includes(r.round.status));
  const metrics: MetricCoverage[] = METRIC_DEFS.map((def) => {
    const computable = postBid.filter((r) => {
      const v = def.calc(r.round);
      return v != null && Number.isFinite(v);
    }).length;
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      computable: postBid.length ? computable / postBid.length : 0,
    };
  }).sort((a, b) => a.computable - b.computable);

  const neverPopulated = metrics
    .filter((m) => m.computable === 0)
    .map((m) => ({ key: m.key, label: m.label }));

  const jobIds = new Set(rows.map((r) => r.job.id));
  const linked = new Set(rows.filter((r) => r.job.isLinked).map((r) => r.job.id));

  return {
    scope: workspace.region ?? "Corporate (all Regions)",
    totalRounds: rows.length,
    totalJobs: jobIds.size,
    linkedPct: jobIds.size ? linked.size / jobIds.size : 0,
    openFlags: [...openByRound.values()].reduce((a, b) => a + b, 0),
    years,
    metrics,
    neverPopulated,
  };
}

export type ChecklistItem = {
  label: string;
  detail: string;
  done: boolean;
  blocker?: boolean;
};

/** Cutover gates, evaluated against live state rather than kept in a doc. */
export function cutoverChecklist(
  report: MigrationReport,
  ctx: { authMode: string; connectMode: string; warehouseConfigured: boolean; emailProvider: string },
): ChecklistItem[] {
  const worstYear = report.years.reduce<YearRow | null>(
    (worst, y) => (worst == null || y.completeness < worst.completeness ? y : worst),
    null,
  );

  return [
    {
      label: "Historical years imported",
      detail: `${report.totalRounds.toLocaleString()} rounds across ${new Set(report.years.map((y) => y.bidYear)).size} bid years in ${report.scope}.`,
      done: report.totalRounds > 0,
    },
    {
      label: "Import flags triaged",
      detail:
        report.openFlags === 0
          ? "No open data-quality flags."
          : `${report.openFlags.toLocaleString()} flags still open — clear or confirm them in Needs Review.`,
      done: report.openFlags === 0,
    },
    {
      label: "Jobs linked to Connect",
      detail: `${Math.round(report.linkedPct * 100)}% of jobs carry a Connect / Salesforce id.`,
      done: report.linkedPct >= 0.95,
    },
    {
      label: "Required-field completeness",
      detail: worstYear
        ? `Weakest bucket: ${worstYear.region} ${worstYear.bidYear} at ${Math.round(worstYear.completeness * 100)}%.`
        : "No rounds in scope.",
      done: (worstYear?.completeness ?? 0) >= 0.9,
    },
    {
      label: "Calculated columns reproducible",
      detail:
        report.neverPopulated.length === 0
          ? "Every metric computes on at least some post-bid rounds."
          : `${report.neverPopulated.length} metrics never compute — the source columns were not collected.`,
      done: report.neverPopulated.length === 0,
    },
    {
      label: "SSO enforced",
      detail:
        ctx.authMode === "sso"
          ? "Identity comes from the B&G identity provider."
          : "Still on demo personas — set AUTH_MODE=sso before go-live.",
      done: ctx.authMode === "sso",
      blocker: true,
    },
    {
      label: "B&G Connect live",
      detail:
        ctx.connectMode === "rest"
          ? "Pursuit lookup reads the live Connect facade."
          : "Lookup still reads the seeded mirror — set CONNECT_MODE=rest.",
      done: ctx.connectMode === "rest",
      blocker: true,
    },
    {
      label: "Warehouse feed configured",
      detail: ctx.warehouseConfigured
        ? "Databricks credentials present; feed can push."
        : "No Databricks credentials — feed runs in preview only.",
      done: ctx.warehouseConfigured,
      blocker: true,
    },
    {
      label: "Email delivery configured",
      detail:
        ctx.emailProvider === "resend"
          ? "Reminders send through the configured provider."
          : "Reminders write to the outbox only — confirm the channel with IT.",
      done: ctx.emailProvider !== "stub",
    },
    {
      label: "SME room: Brian + Jay + form-filler",
      detail:
        "Confirm the live Bid Schedule grid replaces the sheet (Drawings Due and Bid Review are optional operational dates, not lock-gate). Do not add resource Gantt, a company-required Owner/client field, or Georgia ATL division codes until that room says so.",
      done: false,
    },
  ];
}
