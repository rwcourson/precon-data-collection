import { closeDatabase } from "@/db";
import { migrateCurrentDatabase } from "@/db/migrations";
import { seedDemoData } from "@/db/seed";

const PG_NAME = /^[a-z][a-z0-9_]*$/;

export default async function setup() {
  const mode = process.env.DATABASE_MODE;
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL?.trim();
  const databaseName = process.env.TEST_DATABASE_NAME?.trim();

  if (mode === "postgres") {
    if (!adminUrl || !databaseName || !PG_NAME.test(databaseName)) {
      throw new Error(
        "Postgres test mode requires TEST_DATABASE_ADMIN_URL and a safe TEST_DATABASE_NAME"
      );
    }
    const postgres = (await import("postgres")).default;
    const admin = postgres(adminUrl, { max: 1 });
    try {
      await admin.unsafe(`CREATE DATABASE ${databaseName}`);
    } finally {
      await admin.end({ timeout: 5 });
    }
  }

  await migrateCurrentDatabase();
  await seedDemoData();

  return async () => {
    await closeDatabase();
    if (
      mode === "postgres" &&
      adminUrl &&
      databaseName &&
      PG_NAME.test(databaseName)
    ) {
      const postgres = (await import("postgres")).default;
      const admin = postgres(adminUrl, { max: 1 });
      try {
        await admin.unsafe(
          `DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`
        );
      } finally {
        await admin.end({ timeout: 5 });
      }
    }
  };
}
