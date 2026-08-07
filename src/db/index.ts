import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";

/**
 * Local demo uses PGlite. Hosted Postgres cutover: set DATABASE_URL and follow
 * docs/postgres-cutover.md (swap this module to drizzle-orm/postgres-js).
 */
const globalForDb = globalThis as unknown as {
  __pglite?: PGlite;
};

const client = globalForDb.__pglite ?? new PGlite("./.pglite/data");
globalForDb.__pglite = client;

export const db = drizzle(client, { schema });
export * as schema from "./schema";
