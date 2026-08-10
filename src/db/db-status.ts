/**
 * Print which database the current env targets and row counts (no secrets).
 *
 *   npm run db:status
 */
import { sql } from "drizzle-orm";

async function count(table: string): Promise<number | null> {
  try {
    const { db } = await import("./index");
    const result = await db.execute(sql.raw(`select count(*)::int as c from ${table}`));
    if (Array.isArray(result)) return Number((result[0] as { c: number }).c);
    const rows = (result as { rows?: { c: number }[] }).rows;
    return rows?.[0] ? Number(rows[0].c) : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const { inspectRuntimeConfig } = await import("@/lib/runtime-config");
  const status = inspectRuntimeConfig();
  if (!status.ok) {
    process.stdout.write(
      `Configuration invalid: ${status.issues.map((i) => i.key).join(", ")}\n`,
    );
    process.exitCode = 1;
    return;
  }
  const cfg = status.config;
  process.stdout.write("Runtime database target\n");
  process.stdout.write(`  APP_ENV:         ${cfg.appEnv}\n`);
  process.stdout.write(`  AUTH_MODE:       ${cfg.authMode}\n`);
  process.stdout.write(`  DATABASE_MODE:   ${cfg.database.mode}\n`);
  if (cfg.database.mode === "pglite") {
    process.stdout.write(`  PGLITE_DATA_DIR: ${cfg.database.dataDir}\n`);
  } else {
    process.stdout.write("  DATABASE_URL:    (postgres — host redacted)\n");
  }
  process.stdout.write(`  CONNECT_MODE:    ${cfg.integrations.connect}\n`);
  process.stdout.write(`  DATABRICKS_MODE: ${cfg.integrations.databricks}\n`);
  process.stdout.write(`  SMARTSHEET_MODE: ${cfg.integrations.smartsheet}\n`);

  const { closeDatabase } = await import("./index");
  try {
    const counts = {
      users: await count("users"),
      jobs: await count("jobs"),
      estimate_rounds: await count("estimate_rounds"),
      sheets: await count("sheets"),
      sheet_rows: await count("sheet_rows"),
      salesforce_jobs: await count("salesforce_jobs"),
    };
    process.stdout.write("\nRow counts\n");
    for (const [table, value] of Object.entries(counts)) {
      process.stdout.write(`  ${table.padEnd(18)} ${value ?? "n/a"}\n`);
    }
    const jobs = counts.jobs ?? 0;
    if (jobs > 0 && jobs < 100) {
      process.stdout.write(
        "\nNote: this looks like the synthetic demo seed (~42 jobs).\n",
      );
      process.stdout.write(
        "  Full data is on Neon (DATABASE_MODE=postgres) or via npm run db:bootstrap:smartsheet.\n",
      );
    } else if (jobs >= 500) {
      process.stdout.write("\nLooks like the full imported dataset. Good.\n");
    }
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "db:status failed"}\n`);
  process.exitCode = 1;
});
