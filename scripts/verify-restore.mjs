#!/usr/bin/env node
/**
 * Isolated backup integrity check for Phase 8.
 * Creates a logical backup against a disposable PGlite DB and verifies checksum + full payload shape.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(root, "..");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "precon-restore-db-"));

const env = {
  ...process.env,
  APP_ENV: "demo",
  AUTH_MODE: "demo",
  DATABASE_MODE: "pglite",
  PGLITE_DATA_DIR: dataDir,
  APP_ORIGIN: "http://127.0.0.1:3000",
  ALLOWED_ORIGINS: "http://127.0.0.1:3000",
  EMAIL_MODE: "stub",
  PRIVATE_STORAGE_MODE: "local",
  CONNECT_MODE: "mock",
  SMARTSHEET_MODE: "disabled",
  DATABRICKS_MODE: "disabled",
  API_TOKEN_MAX_TTL_DAYS: "90",
};

const runner = path.join(appRoot, "scripts", "_verify-restore-run.mts");
fs.writeFileSync(
  runner,
  `
import { createHash } from "node:crypto";
import { migrateCurrentDatabase } from "../src/db/migrations.ts";
import { seedDemoData } from "../src/db/seed.ts";
import {
  BACKUP_FORMAT_VERSION,
  createDataSnapshot,
  readSnapshotPayload,
  verifyBackupIntegrity,
} from "../src/lib/recovery.ts";

await migrateCurrentDatabase();
await seedDemoData();
const periodKey = "verify-restore-" + Date.now();
const snap = await createDataSnapshot(periodKey);
const payload = await readSnapshotPayload(periodKey);
if (!payload) throw new Error("missing payload");
const parsed = JSON.parse(payload);
if (parsed.formatVersion !== BACKUP_FORMAT_VERSION) throw new Error("bad format version");
if (!parsed.records?.jobs?.length || !parsed.records?.estimateRounds?.length) {
  throw new Error("backup is count-only or empty");
}
const integrity = await verifyBackupIntegrity(periodKey);
if (!integrity.checksumMatch) throw new Error("checksum mismatch");
const rehash = createHash("sha256").update(payload).digest("hex");
if (rehash !== snap.checksum) throw new Error("payload rehash failed");
console.log(JSON.stringify({
  ok: true,
  periodKey,
  checksum: snap.checksum,
  byteSize: snap.byteSize,
  counts: integrity.counts,
  formatVersion: parsed.formatVersion,
}, null, 2));
`,
);

try {
  const result = spawnSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", runner],
    { cwd: appRoot, env, encoding: "utf8" },
  );
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) {
    process.stderr.write("verify:restore failed\n");
    process.exit(result.status || 1);
  }
  process.stdout.write("verify:restore passed\n");
} finally {
  try {
    fs.unlinkSync(runner);
  } catch {
    /* ignore */
  }
}
