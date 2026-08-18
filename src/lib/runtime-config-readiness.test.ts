import { describe, expect, it } from "vitest";
import { checkReadiness } from "@/lib/readiness";
import { inspectRuntimeConfig } from "@/lib/runtime-config";

const demoEnvironment = {
  APP_ENV: "demo",
  AUTH_MODE: "demo",
  DATABASE_MODE: "pglite",
  PGLITE_DATA_DIR: "memory://",
  APP_ORIGIN: "http://127.0.0.1",
  ALLOWED_ORIGINS: "http://127.0.0.1",
  EMAIL_MODE: "stub",
  PRIVATE_STORAGE_MODE: "local",
  CONNECT_MODE: "mock",
  SMARTSHEET_MODE: "disabled",
  DATABRICKS_MODE: "disabled",
  API_TOKEN_MAX_TTL_DAYS: "90",
} as const;

describe("readiness", () => {
  it("returns a healthy, sanitized response after a successful dependency probe", async () => {
    const result = await checkReadiness(
      async () => undefined,
      inspectRuntimeConfig(demoEnvironment)
    );
    expect(result).toMatchObject({
      status: 200,
      body: { ready: true, dependencies: { database: "ready" } },
    });
    expect(JSON.stringify(result)).not.toContain("password");
  });

  it("returns non-2xx and does not probe dependencies for invalid configuration", async () => {
    let probed = false;
    const result = await checkReadiness(
      async () => {
        probed = true;
      },
      inspectRuntimeConfig({
        APP_ENV: "production",
        DATABASE_URL: "contains-a-secret",
      })
    );
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({
      ready: false,
      dependencies: { database: "not-checked" },
    });
    expect(probed).toBe(false);
    expect(JSON.stringify(result)).not.toContain("contains-a-secret");
  });

  it("returns non-2xx without exposing a database failure", async () => {
    const result = await checkReadiness(async () => {
      throw new Error("postgresql://user:password@private-host/app");
    }, inspectRuntimeConfig(demoEnvironment));
    expect(result.status).toBe(503);
    expect(result.body.dependencies.database).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain("private-host");
  });
});
