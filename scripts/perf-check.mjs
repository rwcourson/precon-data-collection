#!/usr/bin/env node
/**
 * Structural performance budget checks plus optional full-dump schedule timing.
 * Validates page size caps, export thresholds, and index presence evidence from migrations.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagination = fs.readFileSync(
  path.join(root, "src/lib/pagination.ts"),
  "utf8"
);
const exports = fs.readFileSync(
  path.join(root, "src/lib/export-jobs.ts"),
  "utf8"
);
const migration = fs.readFileSync(
  path.join(root, "drizzle/0002_atomic_persistence.sql"),
  "utf8"
);
const schema = fs.readFileSync(path.join(root, "src/db/schema.ts"), "utf8");

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

check(
  "page size max <= 200",
  /MAX_PAGE_SIZE = 200/.test(pagination),
  "MAX_PAGE_SIZE"
);
check(
  "default page size <= 50",
  /DEFAULT_PAGE_SIZE = 50/.test(pagination),
  "DEFAULT_PAGE_SIZE"
);
check(
  "async export row threshold 2000",
  /SYNC_EXPORT_ROW_LIMIT = 2000/.test(exports),
  "SYNC_EXPORT_ROW_LIMIT"
);
check(
  "async export byte threshold 25MiB",
  /25 \* 1024 \* 1024/.test(exports),
  "SYNC_EXPORT_BYTE_LIMIT"
);
check(
  "hot query indexes present",
  migration.includes("estimate_rounds_status_region_idx") &&
    migration.includes("round_multi_values_round_field_idx"),
  "migration 0002 indexes"
);
check(
  "roundtable hot indexes present",
  [
    "round_notes_round_created_idx",
    "job_group_memberships_group_idx",
    "approval_requests_region_status_idx",
    "round_lock_revisions_active_idx",
    "publication_outbox_status_available_idx",
  ].every((name) => schema.includes(name)),
  "schema.ts notes, groups, approvals, lock revisions, outbox"
);

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  process.stdout.write(`${c.ok ? "PASS" : "FAIL"} ${c.name} (${c.detail})\n`);
}
if (failed.length) {
  process.stderr.write(`perf:check failed (${failed.length})\n`);
  process.exit(1);
}

const fullDump = spawnSync(
  path.join(root, "node_modules", ".bin", "tsx"),
  ["scripts/schedule-full-perf.ts"],
  { cwd: root, encoding: "utf8" }
);
if (fullDump.stdout) process.stdout.write(fullDump.stdout);
if (fullDump.status !== 0) {
  if (fullDump.stderr) process.stderr.write(fullDump.stderr);
  process.stderr.write("perf:check full-dump schedule timing failed\n");
  process.exit(fullDump.status ?? 1);
}

process.stdout.write("perf:check passed\n");
