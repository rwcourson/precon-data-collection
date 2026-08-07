import path from "path";
import { count } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { users } from "./schema";

export type AppDb = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __preconDb?: AppDb;
  __preconDbReady?: Promise<void>;
  __preconPg?: import("postgres").Sql;
  __pglite?: import("@electric-sql/pglite").PGlite;
};

function usingPostgres(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  return Boolean(url && !url.startsWith("pglite:"));
}

function createDb(): AppDb {
  if (usingPostgres()) {
    // Neon pooled connections require prepare: false (PgBouncer transaction mode).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const postgres = require("postgres") as typeof import("postgres");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/postgres-js") as typeof import("drizzle-orm/postgres-js");
    const client =
      globalForDb.__preconPg ??
      postgres(process.env.DATABASE_URL!, {
        prepare: false,
        max: process.env.VERCEL ? 1 : 10,
        idle_timeout: 20,
        connect_timeout: 15,
      });
    globalForDb.__preconPg = client;
    return drizzle(client, { schema }) as AppDb;
  }

  // Local fallback without DATABASE_URL: embedded PGlite (cast for shared AppDb surface).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  const dataDir =
    process.env.PGLITE_DATA_DIR ??
    (process.env.VERCEL ? "/tmp/precon-pglite" : path.join(process.cwd(), ".pglite", "data"));
  const client = globalForDb.__pglite ?? new PGlite(dataDir);
  globalForDb.__pglite = client;
  return drizzle(client, { schema }) as unknown as AppDb;
}

export const db: AppDb = globalForDb.__preconDb ?? createDb();
globalForDb.__preconDb = db;
export * as schema from "./schema";

async function bootstrap(): Promise<void> {
  if (usingPostgres()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { migrate } = require("drizzle-orm/postgres-js/migrator") as typeof import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { migrate } = require("drizzle-orm/pglite/migrator") as typeof import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  }

  const [{ n }] = await db.select({ n: count() }).from(users);
  if ((n ?? 0) === 0) {
    const { seedDemoData } = await import("./seed");
    await seedDemoData();
  }
}

/** Ensures schema + demo seed exist (idempotent). Safe to call per-request. */
export function ensureDbReady(): Promise<void> {
  globalForDb.__preconDbReady ??= bootstrap().catch((err) => {
    globalForDb.__preconDbReady = undefined;
    throw err;
  });
  return globalForDb.__preconDbReady;
}
