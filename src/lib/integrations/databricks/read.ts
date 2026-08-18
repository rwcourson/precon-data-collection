import "server-only";
import { databricksConfig, runStatement } from "./client";
import { DATABRICKS_PROBE_SUMMARY } from "./field-map";

/**
 * Read-only Databricks probes. Never CREATE/TRUNCATE/INSERT.
 * Writes require explicit DATABRICKS_ALLOW_WRITE=true (disabled by default).
 */

export type DatabricksProbeRow = {
  table: string;
  role: string;
  ok: boolean;
  rowCount: number | null;
  error: string | null;
};

export function databricksWritesAllowed(): boolean {
  return process.env.DATABRICKS_ALLOW_WRITE === "true";
}

/** SELECT count(*) for known precon-adjacent tables. Safe / read-only. */
export async function probeDatabricksTables(): Promise<{
  configured: boolean;
  host: string | null;
  writesAllowed: boolean;
  tables: DatabricksProbeRow[];
}> {
  const cfg = databricksConfig();
  if (!cfg) {
    return {
      configured: false,
      host: null,
      writesAllowed: databricksWritesAllowed(),
      tables: [],
    };
  }

  const tables: DatabricksProbeRow[] = [];
  for (const t of DATABRICKS_PROBE_SUMMARY.tablesOfInterest) {
    try {
      const res = await runStatement(
        cfg,
        `SELECT COUNT(*) AS n FROM ${t.table}`
      );
      const raw = res.result?.data_array?.[0]?.[0];
      const n = raw == null ? null : Number(raw);
      tables.push({
        table: t.table,
        role: t.role,
        ok: true,
        rowCount: n != null && Number.isFinite(n) ? n : null,
        error: null,
      });
    } catch (e) {
      tables.push({
        table: t.table,
        role: t.role,
        ok: false,
        rowCount: null,
        error: e instanceof Error ? e.message : "probe failed",
      });
    }
  }

  return {
    configured: true,
    host: cfg.host,
    writesAllowed: databricksWritesAllowed(),
    tables,
  };
}

/** Pull a bounded sample of Destini estimate rows (read-only). */
export async function pullDestiniEstimateSample(limit = 25): Promise<{
  configured: boolean;
  columns: string[];
  rows: string[][];
  error?: string;
}> {
  const cfg = databricksConfig();
  if (!cfg) return { configured: false, columns: [], rows: [] };
  try {
    const res = await runStatement(
      cfg,
      `SELECT * FROM domain.preconstruction.destiniestimates LIMIT ${Math.min(Math.max(limit, 1), 100)}`
    );
    const rows = res.result?.data_array ?? [];
    return { configured: true, columns: [], rows };
  } catch (e) {
    return {
      configured: true,
      columns: [],
      rows: [],
      error: e instanceof Error ? e.message : "pull failed",
    };
  }
}
