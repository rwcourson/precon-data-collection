import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Isolate PGlite so migrations never touch the developer's local data.
// Use a unique directory per process; never share with Next build or smoke.
const pgliteTestDir = path.join(
  os.tmpdir(),
  `precon-vitest-${process.pid}-${Date.now()}`,
);
fs.mkdirSync(pgliteTestDir, { recursive: true });
process.env.PGLITE_DATA_DIR = pgliteTestDir;
delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;
Object.assign(process.env, {
  APP_ENV: "demo",
  AUTH_MODE: "demo",
  DATABASE_MODE: "pglite",
  APP_ORIGIN: "http://127.0.0.1:3000",
  ALLOWED_ORIGINS: "http://127.0.0.1:3000",
  EMAIL_MODE: "stub",
  PRIVATE_STORAGE_MODE: "local",
  CONNECT_MODE: "mock",
  SMARTSHEET_MODE: "disabled",
  DATABRICKS_MODE: "disabled",
  API_TOKEN_MAX_TTL_DAYS: "90",
});

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    passWithNoTests: false,
    testTimeout: 60_000,
    hookTimeout: 90_000,
    // PGlite file DB and WASM cannot safely be shared across worker processes.
    fileParallelism: false,
    maxWorkers: 1,
    globalSetup: ["src/test/global-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "server-only": path.resolve(import.meta.dirname, "./src/test/server-only-stub.ts"),
      "next/cache": path.resolve(import.meta.dirname, "./src/test/next-cache-stub.ts"),
      "next/headers": path.resolve(import.meta.dirname, "./src/test/next-headers-stub.ts"),
    },
  },
});
