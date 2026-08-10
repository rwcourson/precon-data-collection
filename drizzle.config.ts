import { defineConfig } from "drizzle-kit";

const mode = process.env.DATABASE_MODE?.trim();
const appEnv = process.env.APP_ENV?.trim();

if (mode !== "postgres" && mode !== "pglite") {
  throw new Error("DATABASE_MODE must be explicitly set to postgres or pglite.");
}
if (mode === "pglite" && appEnv !== "local" && appEnv !== "demo") {
  throw new Error("PGlite tooling is restricted to APP_ENV=local or APP_ENV=demo.");
}

const unpooledUrl = process.env.DATABASE_URL_UNPOOLED?.trim();
if (mode === "postgres" && (!unpooledUrl || !/^postgres(?:ql)?:\/\//i.test(unpooledUrl))) {
  throw new Error("Postgres tooling requires DATABASE_URL_UNPOOLED.");
}
const pgliteDataDir = process.env.PGLITE_DATA_DIR?.trim();
if (mode === "pglite" && !pgliteDataDir) {
  throw new Error("PGlite tooling requires PGLITE_DATA_DIR.");
}

const schema = ["./src/db/schema.ts", "./src/db/auth-schema.ts"];

export default defineConfig(
  mode === "postgres"
    ? {
        dialect: "postgresql",
        schema,
        out: "./drizzle",
        dbCredentials: {
          url: unpooledUrl!,
        },
      }
    : {
        dialect: "postgresql",
        driver: "pglite",
        schema,
        out: "./drizzle",
        dbCredentials: {
          url: pgliteDataDir!,
        },
      },
);
