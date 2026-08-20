import { describe, expect, it } from "vitest";
import { previewDatabaseIsolationIssue } from "./preview-isolation";

describe("preview database isolation", () => {
  it("fails closed when Preview would share Production Neon", () => {
    expect(
      previewDatabaseIsolationIssue({
        VERCEL_ENV: "preview",
        DATABASE_MODE: "postgres",
        DATABASE_URL: "postgresql://app:secret@ep-prod.neon.tech/app",
        PRODUCTION_DATABASE_URL:
          "postgresql://app:secret@ep-prod.neon.tech/app",
      })?.reason
    ).toMatch(/isolated from Production/);
  });

  it("requires the Production comparison URL on Preview", () => {
    expect(
      previewDatabaseIsolationIssue({
        VERCEL_ENV: "preview",
        DATABASE_MODE: "postgres",
        DATABASE_URL: "postgresql://app:secret@ep-preview.neon.tech/app",
      })?.key
    ).toBe("PRODUCTION_DATABASE_URL");
  });

  it("accepts a distinct Preview branch URL", () => {
    expect(
      previewDatabaseIsolationIssue({
        VERCEL_ENV: "preview",
        DATABASE_MODE: "postgres",
        DATABASE_URL: "postgresql://app:secret@ep-preview.neon.tech/app",
        PRODUCTION_DATABASE_URL:
          "postgresql://app:secret@ep-prod.neon.tech/app",
      })
    ).toBeNull();
  });

  it("does not apply outside Preview", () => {
    expect(
      previewDatabaseIsolationIssue({
        VERCEL_ENV: "production",
        DATABASE_URL: "postgresql://app:secret@ep-prod.neon.tech/app",
        PRODUCTION_DATABASE_URL:
          "postgresql://app:secret@ep-prod.neon.tech/app",
      })
    ).toBeNull();
  });
});
