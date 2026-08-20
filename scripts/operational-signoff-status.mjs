#!/usr/bin/env node
/**
 * Fail-closed operational sign-off status. Unsigned unless the env value is "1".
 * Always exits 0 so CI stays green while owners have not signed.
 * This script never flips SMARTSHEET_MODE or DATABRICKS_ALLOW_WRITE.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const signed = {
  LUCY_FROZEN_FIXTURE_SIGNED_OFF:
    process.env.LUCY_FROZEN_FIXTURE_SIGNED_OFF === "1",
  POWERBI_PARITY_SIGNED_OFF: process.env.POWERBI_PARITY_SIGNED_OFF === "1",
  SMARTSHEET_DUMP_SIGNED_OFF: process.env.SMARTSHEET_DUMP_SIGNED_OFF === "1",
  DATABRICKS_MERGE_SIGNED_OFF: process.env.DATABRICKS_MERGE_SIGNED_OFF === "1",
};

function readCounts(file) {
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    jobs: Number(raw.jobs),
    rounds: Number(raw.rounds),
    duplicates: Number(raw.duplicates),
    requiredFieldFlags: Number(raw.requiredFieldFlags),
    checksum: String(raw.checksum),
  };
}

const dump = readCounts(path.join(root, "data/smartsheet/dump-counts.json"));
const live = readCounts(path.join(root, "data/smartsheet/live-counts.json"));
const dumpReportGreen = Boolean(
  dump &&
    live &&
    dump.checksum === live.checksum &&
    dump.jobs === live.jobs &&
    dump.rounds === live.rounds &&
    dump.duplicates === live.duplicates &&
    dump.requiredFieldFlags === live.requiredFieldFlags
);

process.stdout.write(
  `${JSON.stringify(
    {
      failClosed: true,
      signed,
      allSigned: Object.values(signed).every(Boolean),
      dumpReportGreen,
      dump,
      live,
      mayDisableSmartsheetReads:
        dumpReportGreen && signed.SMARTSHEET_DUMP_SIGNED_OFF,
      mayEnableDatabricksWrites:
        signed.DATABRICKS_MERGE_SIGNED_OFF && signed.POWERBI_PARITY_SIGNED_OFF,
      databricksAllowWrite: process.env.DATABRICKS_ALLOW_WRITE === "true",
      note: "This status never flips SMARTSHEET_MODE or DATABRICKS_ALLOW_WRITE. Dump-report green plus owner sign-off is required before reads go off. Warehouse writes still need DATABRICKS_ALLOW_WRITE=true.",
    },
    null,
    2
  )}\n`
);
