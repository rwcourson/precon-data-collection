import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL?.trim();
const usePostgres = Boolean(databaseUrl && !databaseUrl.startsWith("pglite:"));

export default defineConfig(
  usePostgres
    ? {
        dialect: "postgresql",
        schema: "./src/db/schema.ts",
        out: "./drizzle",
        dbCredentials: {
          // Prefer unpooled for migrations/push against Neon.
          url: process.env.DATABASE_URL_UNPOOLED?.trim() || databaseUrl!,
        },
      }
    : {
        dialect: "postgresql",
        driver: "pglite",
        schema: "./src/db/schema.ts",
        out: "./drizzle",
        dbCredentials: {
          url: "./.pglite/data",
        },
      },
);
