#!/usr/bin/env node
/**
 * Fail-closed warehouse publication readiness.
 * Never prints DATABRICKS_HOST, tokens, warehouse IDs, or table names.
 * Never flips DATABRICKS_ALLOW_WRITE.
 */
const allowWrite = process.env.DATABRICKS_ALLOW_WRITE === "true";
const mergeSignedOff = process.env.DATABRICKS_MERGE_SIGNED_OFF === "1";
const powerBiSignedOff = process.env.POWERBI_PARITY_SIGNED_OFF === "1";

process.stdout.write(
  `${JSON.stringify(
    {
      failClosed: true,
      hostConfigured: Boolean(process.env.DATABRICKS_HOST),
      tokenConfigured: Boolean(process.env.DATABRICKS_TOKEN),
      warehouseIdConfigured: Boolean(process.env.DATABRICKS_WAREHOUSE_ID),
      tableConfigured: Boolean(process.env.DATABRICKS_TABLE),
      mode: process.env.DATABRICKS_MODE ?? "unset",
      allowWrite,
      mergeSignedOff,
      powerBiSignedOff,
      mayEnableDatabricksWrites: mergeSignedOff && powerBiSignedOff,
      note: "This status never prints DATABRICKS_HOST and never flips DATABRICKS_ALLOW_WRITE. Live MERGE still needs DATABRICKS_ALLOW_WRITE=true, warehousePublication.enabled, and owner sign-off.",
    },
    null,
    2
  )}\n`
);
