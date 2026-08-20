#!/usr/bin/env node
/**
 * Read-only Databricks COUNT(*) probes.
 * Usage: node --env-file=.env.local scripts/probe-databricks.mjs
 */
const host = process.env.DATABRICKS_HOST?.replace(/\/$/, "");
const token = process.env.DATABRICKS_TOKEN;
const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID;

const TABLES = [
  "domain.preconstruction.destiniestimates",
  "domain.preconstruction.destinicalculatedmetrics",
  "domain.general.buildprojectdetails",
  "domain.general.buildprojectteam",
  "domain.general.division_structure_current",
  "standardized.buildingconnected.projects",
  "production.curated_tables.potential_awards",
];

if (!host || !token || !warehouseId) {
  console.error(
    "Need DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_WAREHOUSE_ID"
  );
  process.exit(1);
}

console.log(`Host configured: ${Boolean(host)}`);
console.log(`Warehouse ID configured: ${Boolean(warehouseId)}`);
console.log(`Writes allowed: ${process.env.DATABRICKS_ALLOW_WRITE === "true"}`);

for (const table of TABLES) {
  process.stdout.write(`  ${table}… `);
  try {
    const res = await fetch(`${host}/api/2.0/sql/statements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        warehouse_id: warehouseId,
        statement: `SELECT COUNT(*) AS n FROM ${table}`,
        wait_timeout: "50s",
        on_wait_timeout: "CANCEL",
      }),
    });
    const body = await res.json();
    if (!res.ok || body.status?.state === "FAILED") {
      console.log(`FAIL ${body.status?.error?.message ?? res.status}`);
      continue;
    }
    const n = body.result?.data_array?.[0]?.[0];
    console.log(n != null ? `${Number(n).toLocaleString()} rows` : "ok");
  } catch (e) {
    console.log(`ERR ${e instanceof Error ? e.message : e}`);
  }
}
