import "server-only";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { METRIC_DEFS } from "@/lib/metrics";
import {
  getAllCustomColumns,
  getCustomValuesForRounds,
  getMultiValuesForRounds,
  getRoundsWithJobs,
} from "@/lib/queries";
import { databricksConfig, runStatement } from "./client";
import { databricksWritesAllowed } from "./read";

/**
 * Outbound feed of locked and in-flight rounds to the warehouse (BRD Section 12), so
 * Power BI reads Precon data from the same place as everything else at B&G.
 *
 * The payload is deliberately one wide row per estimate round — the shape the
 * Estimate Summary sheets already have — with the two-tier custom columns
 * carried as a JSON map so a Region adding a column never requires a schema
 * change on the warehouse side.
 *
 * Writes are OFF by default. Set DATABRICKS_ALLOW_WRITE=true to enable
 * CREATE/TRUNCATE/INSERT. Production should pull from Databricks only.
 */

export const FEED_STATE_KEY = "databricksFeed";

export type FeedState = {
  lastRunAt: string | null;
  lastRowCount: number;
  lastStatus: "never" | "preview" | "pushed" | "failed";
  lastError: string | null;
};

export const DEFAULT_FEED_STATE: FeedState = {
  lastRunAt: null,
  lastRowCount: 0,
  lastStatus: "never",
  lastError: null,
};

export async function getFeedState(): Promise<FeedState> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, FEED_STATE_KEY));
  if (!row) return DEFAULT_FEED_STATE;
  return { ...DEFAULT_FEED_STATE, ...(row.value as Partial<FeedState>) };
}

async function setFeedState(next: FeedState) {
  await db
    .insert(appSettings)
    .values({ key: FEED_STATE_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: next, updatedAt: new Date() },
    });
}

export type FeedRow = Record<string, string | number | boolean | null>;

/** Builds the full outbound row set. Read-only — safe to call for a preview. */
export async function buildFeedRows(): Promise<FeedRow[]> {
  const [rounds, customCols] = await Promise.all([getRoundsWithJobs(), getAllCustomColumns()]);
  const ids = rounds.map((r) => r.round.id);
  const [multiMap, customMap] = await Promise.all([
    getMultiValuesForRounds(ids),
    getCustomValuesForRounds(ids),
  ]);
  const colById = new Map(customCols.map((c) => [c.id, c]));

  return rounds.map(({ round, job, estimateLeadName }) => {
    const multi = multiMap.get(round.id) ?? {};
    const custom: Record<string, string | null> = {};
    for (const [colId, value] of Object.entries(customMap.get(round.id) ?? {})) {
      const col = colById.get(Number(colId));
      if (col) custom[col.label] = value;
    }

    const row: FeedRow = {
      round_id: round.id,
      job_number: job.jobNumber,
      job_name: job.jobName,
      salesforce_id: job.salesforceId,
      is_linked: job.isLinked,
      region: round.region,
      precon_department: round.preconDepartment,
      estimate_phase: round.estimatePhase,
      bid_year: round.bidYear,
      bid_due_date: round.bidDueDate,
      status: round.status,
      outcome: round.outcome,
      market_sector: round.marketSector,
      contract_type: round.contractType,
      procurement: round.procurement,
      estimate_lead: estimateLeadName,
      estimate_value: round.estimateValue,
      fee_expected: round.feeExpected,
      contingency_total: round.contingencyTotal,
      submitted_at: round.submittedAt?.toISOString() ?? null,
      locked_at: round.lockedAt?.toISOString() ?? null,
      updated_at: round.updatedAt.toISOString(),
      self_perform_work_types: (multi.selfPerformWorkType ?? []).join("; ") || null,
      utilized_support_services: (multi.utilizedSupportServices ?? []).join("; ") || null,
      custom_columns: JSON.stringify(custom),
    };

    for (const def of METRIC_DEFS) {
      const value = def.calc(round);
      row[`metric_${toSnake(def.key)}`] =
        value == null || !Number.isFinite(value) ? null : value;
    }
    return row;
  });
}

const toSnake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

export type FeedResult = {
  configured: boolean;
  rows: number;
  status: FeedState["lastStatus"];
  table?: string;
  error?: string;
  /** First rows of the payload, so an unconfigured run is still reviewable. */
  preview?: FeedRow[];
};

/**
 * Replaces the target table's contents with the current row set. A full
 * replace rather than an upsert: the volume is small and it removes any
 * chance of the warehouse drifting from the system of record.
 */
export async function runDatabricksFeed(
  opts: { previewOnly?: boolean } = {},
): Promise<FeedResult> {
  const rows = await buildFeedRows();
  const cfg = databricksConfig();
  const allowWrite = databricksWritesAllowed();

  if (!cfg || opts.previewOnly || !allowWrite) {
    const state: FeedState = {
      lastRunAt: new Date().toISOString(),
      lastRowCount: rows.length,
      lastStatus: "preview",
      lastError: !cfg
        ? "Databricks credentials are not configured."
        : !allowWrite
          ? "Warehouse writes disabled (DATABRICKS_ALLOW_WRITE≠true). Read-only mode."
          : null,
    };
    await setFeedState(state);
    return {
      configured: Boolean(cfg),
      rows: rows.length,
      status: "preview",
      table: cfg?.table,
      preview: rows.slice(0, 3),
      error: state.lastError ?? undefined,
    };
  }

  try {
    const columns = Object.keys(rows[0] ?? {});
    await runStatement(cfg, `CREATE TABLE IF NOT EXISTS ${cfg.table} (${ddl(columns)})`);
    await runStatement(cfg, `TRUNCATE TABLE ${cfg.table}`);

    // Chunked so a large year does not blow past the statement size limit.
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const values = chunk.map((r) => `(${columns.map((c) => sqlLiteral(r[c])).join(",")})`);
      await runStatement(
        cfg,
        `INSERT INTO ${cfg.table} (${columns.join(",")}) VALUES ${values.join(",")}`,
      );
    }

    const state: FeedState = {
      lastRunAt: new Date().toISOString(),
      lastRowCount: rows.length,
      lastStatus: "pushed",
      lastError: null,
    };
    await setFeedState(state);
    return { configured: true, rows: rows.length, status: "pushed", table: cfg.table };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await setFeedState({
      lastRunAt: new Date().toISOString(),
      lastRowCount: rows.length,
      lastStatus: "failed",
      lastError: message,
    });
    return {
      configured: true,
      rows: rows.length,
      status: "failed",
      table: cfg.table,
      error: message,
    };
  }
}

/** Everything lands as STRING or DOUBLE; the warehouse casts downstream. */
function ddl(columns: string[]): string {
  return columns
    .map((c) => `${c} ${c.startsWith("metric_") || NUMERIC.has(c) ? "DOUBLE" : "STRING"}`)
    .join(", ");
}

const NUMERIC = new Set([
  "round_id",
  "bid_year",
  "estimate_value",
  "fee_expected",
  "contingency_total",
]);

function sqlLiteral(v: string | number | boolean | null | undefined): string {
  if (v == null) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "'true'" : "'false'";
  return `'${v.replace(/'/g, "''")}'`;
}
