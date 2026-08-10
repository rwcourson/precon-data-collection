import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

async function main(): Promise<void> {
  const deploySource = fs.readFileSync(path.join(process.cwd(), "src/db/migrate-deploy.ts"), "utf8");
  for (const contract of ["DATABASE_URL_UNPOOLED", "pg_advisory_lock", "pg_advisory_unlock"]) {
    if (!deploySource.includes(contract)) throw new Error(`Deploy migration contract is missing ${contract}.`);
  }

  const client = new PGlite("memory://");
  try {
    await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
    const result = await client.query<{ migration_count: number }>(
      "select count(*)::int as migration_count from drizzle.__drizzle_migrations",
    );
    const count = result.rows[0]?.migration_count ?? 0;
    if (count < 1) throw new Error("Forward migration rehearsal applied no migrations.");
    process.stdout.write(`Forward migration rehearsal: ${count} migration(s) applied.\n`);
    process.stdout.write("Deploy migration contract: unpooled URL + advisory lock verified.\n");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Migration check failed."}\n`);
  process.exitCode = 1;
});
