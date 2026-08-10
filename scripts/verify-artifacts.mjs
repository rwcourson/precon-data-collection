#!/usr/bin/env node
/**
 * Isolated artifact + stub-outbox check for Phase 9.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(root, "..");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "precon-artifacts-db-"));

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

const runner = path.join(appRoot, "scripts", "_verify-artifacts-run.mts");
fs.writeFileSync(
  runner,
  `
import { eq } from "drizzle-orm";
import { migrateCurrentDatabase } from "../src/db/migrations.ts";
import { seedDemoData } from "../src/db/seed.ts";
import { db } from "../src/db/index.ts";
import { distributionLists, emailOutbox, users } from "../src/db/schema.ts";
import { createPrincipal } from "../src/lib/authorization/principal.ts";
import { distributionService } from "../src/services/distribution-service.ts";

await migrateCurrentDatabase();
await seedDemoData();
const [rpd] = await db.select().from(users).where(eq(users.role, "rpd")).limit(1);
const [list] = await db.insert(distributionLists).values({
  name: "verify-artifacts",
  region: rpd.region,
  emails: ["artifact@example.com"],
  cadence: "manual",
  reportKey: "bid-schedule",
  timezone: "America/Chicago",
  ownerId: rpd.id,
}).returning();
const principal = createPrincipal({ user: rpd, authSource: "demo_session", workspaceRegion: rpd.region });
const result = await distributionService.sendListNow(principal, list.id);
if (!result.artifact.checksum || result.artifact.byteSize < 20) throw new Error("missing pdf artifact");
if (result.delivery.sent !== 0) throw new Error("stub mode must not mark sent");
if (result.delivery.previewed < 1) throw new Error("stub mode must preview");
const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, result.outboxIds[0]));
if (row.status !== "previewed" || row.sentAt) throw new Error("outbox not previewed");
console.log(JSON.stringify({
  ok: true,
  checksum: result.artifact.checksum,
  byteSize: result.artifact.byteSize,
  storageKey: result.artifact.storageKey,
  contentType: result.artifact.contentType,
  outboxStatus: row.status,
  provider: result.provider,
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
    process.stderr.write("verify:artifacts failed\n");
    process.exit(result.status || 1);
  }
  process.stdout.write("verify:artifacts passed\n");
} finally {
  try {
    fs.unlinkSync(runner);
  } catch {
    /* ignore */
  }
}
