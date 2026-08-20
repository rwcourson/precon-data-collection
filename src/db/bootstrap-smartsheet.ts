/**
 * Full local offline bootstrap from committed Smartsheet export.
 *
 *   pnpm run db:bootstrap:smartsheet
 *
 * Writes an isolated PGlite DB at .pglite/data-full (never Neon, never demo
 * .pglite/data). Source files: data/smartsheet/json (47 sheets on disk).
 *
 * Day-to-day full data: Neon already has the import — use DATABASE_MODE=postgres
 * in .env.local (configured when Neon URLs are present).
 */
import fs from "node:fs";
import path from "node:path";
import { DEMO_RUNTIME_DEFAULTS } from "./demo-env";

const FULL_DIR =
  process.env.PGLITE_FULL_DATA_DIR?.trim() || ".pglite/data-full";

function applyEnv(): void {
  for (const [key, value] of Object.entries(DEMO_RUNTIME_DEFAULTS)) {
    process.env[key] = value;
  }
  process.env.DATABASE_MODE = "pglite";
  process.env.PGLITE_DATA_DIR = FULL_DIR;
  process.env.APP_ENV = "demo";
  process.env.AUTH_MODE = "demo";
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL;
  delete process.env.POSTGRES_URL_NON_POOLING;
  delete process.env.POSTGRES_PRISMA_URL;
}

function wipe(dir: string): void {
  const absolute = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  if (!absolute.startsWith(process.cwd() + path.sep)) {
    throw new Error(`Refusing to wipe outside project: ${absolute}`);
  }
  if (fs.existsSync(absolute)) {
    fs.rmSync(absolute, { recursive: true, force: true });
    process.stdout.write(`Cleared ${absolute}\n`);
  }
  fs.mkdirSync(absolute, { recursive: true });
}

async function main(): Promise<void> {
  applyEnv();
  const jsonDir = path.join(process.cwd(), "data/smartsheet/json");
  if (!fs.existsSync(jsonDir)) {
    throw new Error(`Missing Smartsheet export at ${jsonDir}`);
  }
  const count = fs
    .readdirSync(jsonDir)
    .filter((f) => f.endsWith(".json")).length;
  process.stdout.write(
    `Full Smartsheet bootstrap (${count} JSON files) → PGlite ${FULL_DIR}\n`
  );
  wipe(FULL_DIR);

  const { closeDatabase } = await import("./index");
  const { migrateCurrentDatabase } = await import("./migrations");
  await migrateCurrentDatabase();
  await closeDatabase();
  process.stdout.write("Migrations applied. Importing Smartsheet JSON…\n");
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "src/db/seed-from-smartsheet.ts"],
    {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: "inherit",
    }
  );
  if (result.status !== 0) {
    throw new Error(`seed-from-smartsheet exited ${result.status ?? 1}`);
  }

  process.stdout.write("\nFull Smartsheet bootstrap complete.\n");
  process.stdout.write(`  Store: ${FULL_DIR}\n`);
  process.stdout.write("  To use it in the app, set in .env.local:\n");
  process.stdout.write("    DATABASE_MODE=pglite\n");
  process.stdout.write(`    PGLITE_DATA_DIR=${FULL_DIR}\n`);
  process.stdout.write(
    "  Recommended: keep DATABASE_MODE=postgres to use Neon (already fully loaded).\n"
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Smartsheet bootstrap failed."}\n`
  );
  process.exitCode = 1;
});
