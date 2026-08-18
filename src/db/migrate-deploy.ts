import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const MIGRATION_LOCK_ID = 73_308_421;

async function main(): Promise<void> {
  if (process.env.APP_ENV !== "production") {
    throw new Error("Deploy migrations require APP_ENV=production.");
  }
  const url = process.env.DATABASE_URL_UNPOOLED?.trim();
  if (!url || !/^postgres(?:ql)?:\/\//i.test(url)) {
    throw new Error("DATABASE_URL_UNPOOLED must be a valid Postgres URL.");
  }

  const client = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
  let locked = false;
  try {
    await client`select pg_advisory_lock(${MIGRATION_LOCK_ID})`;
    locked = true;
    await migrate(drizzle(client), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    const rows = await client<{ hash: string; created_at: number }[]>`
      select hash, created_at
      from drizzle.__drizzle_migrations
      order by created_at asc
    `;
    process.stdout.write(`Applied migration count: ${rows.length}\n`);
    for (const row of rows)
      process.stdout.write(`- ${row.hash} (${row.created_at})\n`);
  } finally {
    if (locked) await client`select pg_advisory_unlock(${MIGRATION_LOCK_ID})`;
    await client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Migration failed."}\n`
  );
  process.exitCode = 1;
});
