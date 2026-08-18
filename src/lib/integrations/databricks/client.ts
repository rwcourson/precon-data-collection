import "server-only";

/**
 * Thin wrapper over the Databricks SQL Statement Execution API. B&G already
 * runs the Pre-Con Time Tool warehouse, so the feed writes through SQL rather
 * than adding a second ingestion mechanism for IT to operate.
 *
 * Configure with `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, and
 * `DATABRICKS_WAREHOUSE_ID`; without all three the feed stays in preview mode
 * and only renders the payload it would have written.
 */

export type DatabricksConfig = {
  host: string;
  token: string;
  warehouseId: string;
  /** Fully-qualified target, e.g. `domain.preconstruction.precon_data_rounds`. */
  table: string;
};

export function databricksConfig(): DatabricksConfig | null {
  const host = process.env.DATABRICKS_HOST;
  const token = process.env.DATABRICKS_TOKEN;
  const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID;
  if (!host || !token || !warehouseId) return null;
  return {
    host: host.replace(/\/$/, ""),
    token,
    warehouseId,
    table:
      process.env.DATABRICKS_TABLE ??
      "domain.preconstruction.precon_data_rounds",
  };
}

type StatementResponse = {
  statement_id?: string;
  status?: { state?: string; error?: { message?: string } };
  result?: { data_array?: string[][] };
};

/** Runs one statement and waits for it inline; the feed is small enough. */
export async function runStatement(
  cfg: DatabricksConfig,
  statement: string,
  parameters?: { name: string; value: string | null; type?: string }[]
): Promise<StatementResponse> {
  const res = await fetch(`${cfg.host}/api/2.0/sql/statements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      warehouse_id: cfg.warehouseId,
      statement,
      parameters,
      wait_timeout: "50s",
      on_wait_timeout: "CANCEL",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Databricks responded ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as StatementResponse;
  if (body.status?.state === "FAILED" || body.status?.error) {
    throw new Error(
      body.status?.error?.message ?? "Databricks statement failed"
    );
  }
  return body;
}
