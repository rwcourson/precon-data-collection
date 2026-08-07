import path from "path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { count } from "drizzle-orm";
import * as schema from "./schema";
import { users } from "./schema";

/**
 * Local: `./.pglite/data`. On Vercel the app FS is read-only, so use `/tmp`.
 * Hosted Postgres cutover: set DATABASE_URL (see docs/postgres-cutover.md).
 */
function dataDir(): string {
  if (process.env.PGLITE_DATA_DIR) return process.env.PGLITE_DATA_DIR;
  if (process.env.VERCEL) return "/tmp/precon-pglite";
  return path.join(process.cwd(), ".pglite", "data");
}

const globalForDb = globalThis as unknown as {
  __pglite?: PGlite;
  __preconDbReady?: Promise<void>;
};

const client = globalForDb.__pglite ?? new PGlite(dataDir());
globalForDb.__pglite = client;

export const db = drizzle(client, { schema });
export * as schema from "./schema";

async function bootstrap(): Promise<void> {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
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
