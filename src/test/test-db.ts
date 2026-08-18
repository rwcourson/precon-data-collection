/**
 * Vitest database wiring. Isolated from runtime-config so the config file can
 * apply it before any app module reads process.env.
 */

export type TestDbWiring =
  | {
      mode: "pglite";
      pgliteDataDir: string;
    }
  | {
      mode: "postgres";
      adminUrl: string;
      databaseUrl: string;
      databaseName: string;
    };

const PG_NAME = /^[a-z][a-z0-9_]*$/;

export function uniqueTestDatabaseName(
  pid: number = process.pid,
  now: number = Date.now()
): string {
  const name = `precon_test_${pid}_${now}`;
  if (!PG_NAME.test(name)) {
    throw new Error(`Refusing unsafe test database name: ${name}`);
  }
  return name;
}

export function replaceDatabaseName(url: string, databaseName: string): string {
  if (!PG_NAME.test(databaseName)) {
    throw new Error(`Refusing unsafe test database name: ${databaseName}`);
  }
  const parsed = new URL(url);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

export function deriveTestDatabaseWiring(
  env: Record<string, string | undefined>,
  options?: { pid?: number; now?: number; pgliteDataDir?: string }
): TestDbWiring {
  const testUrl = env.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    const pgliteDataDir =
      options?.pgliteDataDir ??
      // Callers that need a real tmpdir pass one in; tests may stub it.
      env.PGLITE_DATA_DIR?.trim() ??
      "";
    return { mode: "pglite", pgliteDataDir };
  }
  const databaseName = uniqueTestDatabaseName(options?.pid, options?.now);
  return {
    mode: "postgres",
    adminUrl: testUrl,
    databaseUrl: replaceDatabaseName(testUrl, databaseName),
    databaseName,
  };
}

export function applyTestDatabaseWiring(
  wiring: TestDbWiring,
  env: Record<string, string | undefined> = process.env
): void {
  Object.assign(env, {
    APP_ENV: "demo",
    AUTH_MODE: "demo",
    APP_ORIGIN: "http://127.0.0.1:3000",
    ALLOWED_ORIGINS: "http://127.0.0.1:3000",
    EMAIL_MODE: "stub",
    PRIVATE_STORAGE_MODE: "local",
    CONNECT_MODE: "mock",
    SMARTSHEET_MODE: "disabled",
    DATABRICKS_MODE: "disabled",
    API_TOKEN_MAX_TTL_DAYS: "90",
  });
  if (wiring.mode === "pglite") {
    env.DATABASE_MODE = "pglite";
    env.PGLITE_DATA_DIR = wiring.pgliteDataDir;
    delete env.DATABASE_URL;
    delete env.DATABASE_URL_UNPOOLED;
    delete env.TEST_DATABASE_NAME;
    delete env.TEST_DATABASE_ADMIN_URL;
    return;
  }
  env.DATABASE_MODE = "postgres";
  env.DATABASE_URL = wiring.databaseUrl;
  env.DATABASE_URL_UNPOOLED = wiring.databaseUrl;
  env.TEST_DATABASE_NAME = wiring.databaseName;
  env.TEST_DATABASE_ADMIN_URL = wiring.adminUrl;
}
