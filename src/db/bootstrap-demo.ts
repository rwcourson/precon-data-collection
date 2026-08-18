/**
 * Demo-only migrate + seed against local PGlite.
 *
 * This does NOT load Smartsheet exports or touch Neon. It wipes the local
 * PGlite directory and seeds ~42 jobs / ~108 rounds for the role-switcher demo.
 *
 * Full data paths:
 *   - Neon (existing hosted DB): set DATABASE_MODE=postgres in .env.local → pnpm run dev
 *   - Local full import from data/smartsheet: pnpm run db:bootstrap:smartsheet
 *
 *   pnpm run db:demo:bootstrap
 *   pnpm run db:reset   # alias of demo bootstrap
 */
import fs from "node:fs";
import path from "node:path";
import { applyDemoBootstrapEnv } from "./demo-env";

applyDemoBootstrapEnv();

function wipePgliteDataDir(): void {
  const dataDir = process.env.PGLITE_DATA_DIR?.trim() || ".pglite/data";
  const absolute = path.isAbsolute(dataDir)
    ? dataDir
    : path.join(process.cwd(), dataDir);
  const projectRoot = process.cwd();
  const e2eRoot = process.env.E2E_PROJECT_DIR
    ? path.resolve(process.env.E2E_PROJECT_DIR)
    : null;
  const allowed =
    absolute === projectRoot ||
    absolute.startsWith(projectRoot + path.sep) ||
    (e2eRoot != null &&
      (absolute === e2eRoot || absolute.startsWith(e2eRoot + path.sep)));
  if (!allowed) {
    throw new Error(
      `Refusing to wipe PGlite dir outside the project: ${absolute}`
    );
  }
  if (fs.existsSync(absolute)) {
    fs.rmSync(absolute, { recursive: true, force: true });
    process.stdout.write(`Cleared local PGlite data dir: ${absolute}\n`);
  }
  fs.mkdirSync(absolute, { recursive: true });
}

async function main(): Promise<void> {
  process.stdout.write(
    "Demo bootstrap: synthetic seed only (not Smartsheet/Neon full data).\n"
  );
  wipePgliteDataDir();

  const { closeDatabase } = await import("@/db");
  const { migrateCurrentDatabase } = await import("@/db/migrations");
  const { seedDemoData } = await import("@/db/seed");
  try {
    await migrateCurrentDatabase();
    await seedDemoData();
    process.stdout.write("Demo database migration and seed completed.\n");
    process.stdout.write(
      `PGlite data dir: ${process.env.PGLITE_DATA_DIR ?? ".pglite/data"}\n`
    );
    process.stdout.write(
      "Tip: full Smartsheet import → pnpm run db:bootstrap:smartsheet\n"
    );
    process.stdout.write(
      "Tip: use hosted Neon data → DATABASE_MODE=postgres in .env.local (already configured if Neon URLs present)\n"
    );
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Demo bootstrap failed."}\n`
  );
  process.exitCode = 1;
});
