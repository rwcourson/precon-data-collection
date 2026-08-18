import { describe, expect, it } from "vitest";
import {
  applyTestDatabaseWiring,
  deriveTestDatabaseWiring,
  replaceDatabaseName,
  uniqueTestDatabaseName,
} from "./test-db";

describe("test database wiring", () => {
  it("uses PGlite and strips hosted URLs when TEST_DATABASE_URL is unset", () => {
    const env: Record<string, string | undefined> = {
      TEST_DATABASE_URL: undefined,
      DATABASE_URL: "postgresql://app:secret@ep-foo.neon.tech/app",
      DATABASE_URL_UNPOOLED: "postgresql://app:secret@ep-foo.neon.tech/app",
    };
    const wiring = deriveTestDatabaseWiring(env, {
      pgliteDataDir: "/tmp/precon-vitest-stub",
    });
    expect(wiring.mode).toBe("pglite");
    applyTestDatabaseWiring(wiring, env);
    expect(env.DATABASE_MODE).toBe("pglite");
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.DATABASE_URL_UNPOOLED).toBeUndefined();
    expect(env.PGLITE_DATA_DIR).toBe("/tmp/precon-vitest-stub");
  });

  it("derives postgres mode with a unique database name from TEST_DATABASE_URL", () => {
    const env: Record<string, string | undefined> = {
      TEST_DATABASE_URL:
        "postgresql://postgres:postgres@localhost:5432/postgres",
    };
    const wiring = deriveTestDatabaseWiring(env, { pid: 42, now: 99 });
    expect(wiring).toEqual({
      mode: "postgres",
      adminUrl: "postgresql://postgres:postgres@localhost:5432/postgres",
      databaseName: "precon_test_42_99",
      databaseUrl:
        "postgresql://postgres:postgres@localhost:5432/precon_test_42_99",
    });
    applyTestDatabaseWiring(wiring, env);
    expect(env.DATABASE_MODE).toBe("postgres");
    expect(env.DATABASE_URL).toContain("precon_test_42_99");
    expect(env.DATABASE_URL_UNPOOLED).toBe(env.DATABASE_URL);
    expect(env.TEST_DATABASE_NAME).toBe("precon_test_42_99");
  });

  it("replaces only the database path on the admin URL", () => {
    expect(
      replaceDatabaseName(
        "postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable",
        "precon_test_1_2"
      )
    ).toBe(
      "postgresql://postgres:postgres@127.0.0.1:5432/precon_test_1_2?sslmode=disable"
    );
    expect(uniqueTestDatabaseName(7, 8)).toBe("precon_test_7_8");
  });
});
