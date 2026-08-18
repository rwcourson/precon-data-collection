import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { type DatabaseMode, getRuntimeConfig } from "@/lib/runtime-config";
import * as schema from "./schema";

export type AppDb = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __preconDb?: AppDb;
  __preconDbMode?: DatabaseMode;
  __preconDbReady?: Promise<void>;
  __preconPg?: import("postgres").Sql;
  __pglite?: import("@electric-sql/pglite").PGlite;
};

function createDb(): AppDb {
  const config = getRuntimeConfig();
  globalForDb.__preconDbMode = config.database.mode;

  if (config.database.mode === "postgres") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const postgres = require("postgres") as typeof import("postgres");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } =
      require("drizzle-orm/postgres-js") as typeof import("drizzle-orm/postgres-js");
    const client =
      globalForDb.__preconPg ??
      postgres(config.database.url, {
        prepare: false,
        // DATABASE_URL points at Neon's pooled (pgbouncer) endpoint, and a
        // Fluid compute instance serves many concurrent requests: max 1 would
        // serialize every query and can deadlock nested transactions.
        max: 10,
        idle_timeout: 20,
        connect_timeout: 15,
      });
    globalForDb.__preconPg = client;
    return drizzle(client, { schema }) as AppDb;
  }

  // PGlite is reachable only through an explicit, validated local/demo config.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } =
    require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } =
    require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  const client = globalForDb.__pglite ?? new PGlite(config.database.dataDir);
  globalForDb.__pglite = client;
  return drizzle(client, { schema }) as unknown as AppDb;
}

function database(): AppDb {
  globalForDb.__preconDb ??= createDb();
  return globalForDb.__preconDb;
}

/**
 * Lazy facade: importing a route during `next build` does not select a database.
 * The first real query validates runtime configuration and creates the client.
 */
export const db = new Proxy({} as AppDb, {
  get(_target, property) {
    const target = database() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export function getDatabaseMode(): DatabaseMode {
  database();
  return globalForDb.__preconDbMode!;
}

export * as schema from "./schema";

/** A request-safe connectivity probe. It never migrates or seeds. */
export function ensureDbReady(): Promise<void> {
  globalForDb.__preconDbReady ??= db
    .execute(sql`select 1 as ready`)
    .then(() => undefined)
    .catch((error) => {
      globalForDb.__preconDbReady = undefined;
      throw error;
    });
  return globalForDb.__preconDbReady;
}

/** Releases an explicitly bootstrapped process-local client. */
export async function closeDatabase(): Promise<void> {
  if (globalForDb.__preconPg) await globalForDb.__preconPg.end({ timeout: 5 });
  if (globalForDb.__pglite) await globalForDb.__pglite.close();
  globalForDb.__preconDb = undefined;
  globalForDb.__preconDbMode = undefined;
  globalForDb.__preconDbReady = undefined;
  globalForDb.__preconPg = undefined;
  globalForDb.__pglite = undefined;
}
