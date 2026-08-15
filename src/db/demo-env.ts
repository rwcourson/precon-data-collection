/**
 * Demo/local bootstrap defaults. Applied before any runtime-config read so
 * `npm run db:reset` works without a hand-authored .env, and never seeds a
 * hosted Postgres URL that may be present in .env.local for production work.
 */
export const DEMO_RUNTIME_DEFAULTS: Record<string, string> = {
  APP_ENV: "demo",
  AUTH_MODE: "demo",
  DATABASE_MODE: "pglite",
  PGLITE_DATA_DIR: ".pglite/data",
  APP_ORIGIN: "http://127.0.0.1:3000",
  ALLOWED_ORIGINS: "http://127.0.0.1:3000",
  EMAIL_MODE: "stub",
  PRIVATE_STORAGE_MODE: "local",
  CONNECT_MODE: "mock",
  SMARTSHEET_MODE: "disabled",
  DATABRICKS_MODE: "disabled",
  API_TOKEN_MAX_TTL_DAYS: "90",
};

/** Force a safe isolated demo environment for migrate+seed CLIs. */
export function applyDemoBootstrapEnv(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  for (const [key, value] of Object.entries(DEMO_RUNTIME_DEFAULTS)) {
    if (key === "PGLITE_DATA_DIR" && env.PGLITE_DATA_DIR) continue;
    env[key] = value;
  }
  // Demo seeding refuses any hosted Postgres URL even when mode is pglite.
  delete env.DATABASE_URL;
  delete env.DATABASE_URL_UNPOOLED;
  delete env.POSTGRES_URL;
  delete env.POSTGRES_URL_NON_POOLING;
  delete env.POSTGRES_PRISMA_URL;
  return env;
}
