#!/usr/bin/env node
/**
 * Structural performance budget checks for phase 11.
 * Validates page size caps, export thresholds, and index presence evidence from migrations.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagination = fs.readFileSync(path.join(root, "src/lib/pagination.ts"), "utf8");
const exports = fs.readFileSync(path.join(root, "src/lib/export-jobs.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "drizzle/0002_atomic_persistence.sql"), "utf8");

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

check("page size max <= 200", /MAX_PAGE_SIZE = 200/.test(pagination), "MAX_PAGE_SIZE");
check("default page size <= 50", /DEFAULT_PAGE_SIZE = 50/.test(pagination), "DEFAULT_PAGE_SIZE");
check(
  "async export row threshold 2000",
  /SYNC_EXPORT_ROW_LIMIT = 2000/.test(exports),
  "SYNC_EXPORT_ROW_LIMIT",
);
check(
  "async export byte threshold 25MiB",
  /25 \* 1024 \* 1024/.test(exports),
  "SYNC_EXPORT_BYTE_LIMIT",
);
check(
  "hot query indexes present",
  migration.includes("estimate_rounds_status_region_idx") &&
    migration.includes("round_multi_values_round_field_idx"),
  "migration 0002 indexes",
);

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  process.stdout.write(`${c.ok ? "PASS" : "FAIL"} ${c.name} (${c.detail})\n`);
}
if (failed.length) {
  process.stderr.write(`perf:check failed (${failed.length})\n`);
  process.exit(1);
}
process.stdout.write("perf:check passed\n");
