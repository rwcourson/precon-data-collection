import { describe, expect, it } from "vitest";
import {
  assertDemoSeedAllowed,
  getRuntimeConfig,
  inspectRuntimeConfig,
  RuntimeConfigError,
  runtimeDiagnostics,
} from "@/lib/runtime-config";

const demoEnv = {
  APP_ENV: "demo",
  AUTH_MODE: "demo",
  DATABASE_MODE: "pglite",
  PGLITE_DATA_DIR: "memory://",
  APP_ORIGIN: "http://127.0.0.1:3000",
  ALLOWED_ORIGINS: "http://127.0.0.1:3000",
  EMAIL_MODE: "stub",
  PRIVATE_STORAGE_MODE: "local",
  CONNECT_MODE: "mock",
  SMARTSHEET_MODE: "disabled",
  DATABRICKS_MODE: "disabled",
  API_TOKEN_MAX_TTL_DAYS: "90",
};

const productionEnv = {
  APP_ENV: "production",
  AUTH_MODE: "sso",
  DATABASE_MODE: "postgres",
  DATABASE_URL: "postgresql://app:secret@db.example.com/app?sslmode=require",
  DATABASE_URL_UNPOOLED:
    "postgresql://migrator:secret@db.example.com/app?sslmode=require",
  APP_ORIGIN: "https://precon.example.com",
  ALLOWED_ORIGINS: "https://precon.example.com",
  CRON_SECRET: "c".repeat(32),
  SSO_ALLOWED_DOMAINS: "example.com",
  BETTER_AUTH_SECRET: "b".repeat(32),
  BETTER_AUTH_URL: "https://precon.example.com",
  MICROSOFT_CLIENT_ID: "11111111-1111-1111-1111-111111111111",
  MICROSOFT_CLIENT_SECRET: "ms-client-secret-value",
  MICROSOFT_TENANT_ID: "22222222-2222-2222-2222-222222222222",
  API_TOKEN_MAX_TTL_DAYS: "90",
  EMAIL_MODE: "resend",
  RESEND_API_KEY: "re_123456789012",
  EMAIL_FROM: "precon@example.com",
  PRIVATE_STORAGE_MODE: "vercel-blob",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_token_123",
  CONNECT_MODE: "disabled",
  SMARTSHEET_MODE: "disabled",
  DATABRICKS_MODE: "disabled",
};

const ssoOverrides = {
  AUTH_MODE: "sso",
  BETTER_AUTH_SECRET: "b".repeat(32),
  SSO_ALLOWED_DOMAINS: "example.com",
  MICROSOFT_CLIENT_ID: "11111111-1111-1111-1111-111111111111",
  MICROSOFT_CLIENT_SECRET: "ms-client-secret-value",
  MICROSOFT_TENANT_ID: "22222222-2222-2222-2222-222222222222",
};

describe("runtime-config environment matrix", () => {
  it("accepts an explicit isolated demo configuration", () => {
    const config = getRuntimeConfig(demoEnv);
    expect(config.appEnv).toBe("demo");
    expect(config.database).toEqual({ mode: "pglite", dataDir: "memory://" });
  });

  it("accepts a complete production configuration", () => {
    const config = getRuntimeConfig(productionEnv);
    expect(config.appEnv).toBe("production");
    expect(config.database.mode).toBe("postgres");
    expect(config.authMode).toBe("sso");
  });

  it("fails closed when production requirements are absent", () => {
    const status = inspectRuntimeConfig({ APP_ENV: "production" });
    expect(status.ok).toBe(false);
    if (!status.ok) {
      const keys = status.issues.map((issue) => issue.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          "AUTH_MODE",
          "DATABASE_MODE",
          "DATABASE_URL_UNPOOLED",
          "CRON_SECRET",
          "SSO_ALLOWED_DOMAINS",
          "PRIVATE_STORAGE_MODE",
          "APP_ORIGIN",
        ])
      );
    }
  });

  it("forbids PGlite in Vercel production", () => {
    const status = inspectRuntimeConfig({
      ...demoEnv,
      PGLITE_DATA_DIR: "/tmp/precon-data",
      VERCEL: "1",
      VERCEL_ENV: "production",
    });
    expect(status.ok).toBe(false);
    if (!status.ok)
      expect(status.issues.some((issue) => issue.key === "DATABASE_MODE")).toBe(
        true
      );
  });

  it("treats preview as explicit configuration rather than inferring from NODE_ENV", () => {
    const status = inspectRuntimeConfig({
      ...demoEnv,
      ...ssoOverrides,
      APP_ENV: "local",
      VERCEL_ENV: "preview",
    });
    expect(status.ok).toBe(true);
    if (status.ok) expect(status.config.appEnv).toBe("local");
  });

  it("forbids demo auth on hosted production deployments regardless of APP_ENV", () => {
    // VERCEL_ENV=production, and VERCEL set without VERCEL_ENV (fail closed).
    for (const hostedEnv of [
      { VERCEL: "1", VERCEL_ENV: "production" },
      { VERCEL: "1" },
    ]) {
      const status = inspectRuntimeConfig({
        ...demoEnv,
        APP_ENV: "local",
        ...hostedEnv,
      });
      expect(status.ok).toBe(false);
      if (!status.ok) {
        expect(status.issues).toEqual(
          expect.arrayContaining([
            {
              key: "AUTH_MODE",
              reason: "must be sso on hosted production deployments",
            },
          ])
        );
      }
    }
  });

  it("allows demo personas on Preview deployments (behind Vercel Authentication)", () => {
    const status = inspectRuntimeConfig({
      ...demoEnv,
      DATABASE_MODE: "postgres",
      DATABASE_URL: "postgresql://app:secret@db.example.com/app",
      DATABASE_URL_UNPOOLED:
        "postgresql://app:secret@db-direct.example.com/app",
      PGLITE_DATA_DIR: undefined,
      VERCEL: "1",
      VERCEL_ENV: "preview",
    });
    expect(status.ok).toBe(true);
  });

  it("still accepts demo auth locally with no Vercel markers", () => {
    const status = inspectRuntimeConfig({ ...demoEnv, APP_ENV: "local" });
    expect(status.ok).toBe(true);
  });

  it("derives Preview APP_ORIGIN from VERCEL_BRANCH_URL when unset", () => {
    const status = inspectRuntimeConfig({
      ...ssoOverrides,
      APP_ENV: "local",
      DATABASE_MODE: "postgres",
      DATABASE_URL: "postgresql://app:secret@db.example.com/app",
      EMAIL_MODE: "stub",
      PRIVATE_STORAGE_MODE: "local",
      CONNECT_MODE: "mock",
      SMARTSHEET_MODE: "disabled",
      DATABRICKS_MODE: "disabled",
      API_TOKEN_MAX_TTL_DAYS: "90",
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_BRANCH_URL:
        "precon-data-git-jay-mcdaniel-upgrades.magnus.brasfieldgorrie.app",
      VERCEL_URL: "precon-data-abc123.magnus.brasfieldgorrie.app",
    });
    expect(status.ok).toBe(true);
    if (status.ok) {
      expect(status.config.appOrigin).toBe(
        "https://precon-data-git-jay-mcdaniel-upgrades.magnus.brasfieldgorrie.app"
      );
      expect(status.config.allowedOrigins).toEqual([
        "https://precon-data-git-jay-mcdaniel-upgrades.magnus.brasfieldgorrie.app",
        "https://precon-data-abc123.magnus.brasfieldgorrie.app",
      ]);
    }
  });

  it("does not infer production APP_ORIGIN from Vercel hosts", () => {
    const status = inspectRuntimeConfig({
      ...productionEnv,
      APP_ORIGIN: undefined,
      ALLOWED_ORIGINS: undefined,
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_URL: "precon-data-abc123.magnus.brasfieldgorrie.app",
    });
    expect(status.ok).toBe(false);
    if (!status.ok) {
      expect(status.issues.some((issue) => issue.key === "APP_ORIGIN")).toBe(
        true
      );
    }
  });

  it("returns redacted diagnostics without URLs or secrets", () => {
    const diagnostics = JSON.stringify(
      runtimeDiagnostics(inspectRuntimeConfig(productionEnv))
    );
    expect(diagnostics).not.toContain("secret");
    expect(diagnostics).not.toContain("db.example.com");
    expect(diagnostics).not.toContain(productionEnv.CRON_SECRET);
  });
});

describe("runtime-config demo seed gate", () => {
  it("allows explicit demo PGlite only", () => {
    expect(() => assertDemoSeedAllowed(demoEnv)).not.toThrow();
  });

  it("refuses production and hosted Postgres targets", () => {
    expect(() => assertDemoSeedAllowed(productionEnv)).toThrow(
      RuntimeConfigError
    );
    expect(() =>
      assertDemoSeedAllowed({
        ...demoEnv,
        DATABASE_URL: "postgresql://user:password@hosted.example.com/prod",
      })
    ).toThrow(RuntimeConfigError);
  });
});
