import path from "node:path";
import { db, getDatabaseMode } from "@/db";

/** Explicit lifecycle hook used by tests and isolated local setup, never requests. */
export async function migrateCurrentDatabase(): Promise<void> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (getDatabaseMode() === "postgres") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder });
    return;
  }
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db as never, { migrationsFolder });
}
