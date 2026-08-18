import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { users } from "@/db/schema";

describe("db-bootstrap lifecycle", () => {
  it("a forward-migrated empty database stays empty until explicit seeding", async () => {
    const client = new PGlite("memory://");
    const isolated = drizzle(client);
    await migrate(isolated, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    const [row] = await isolated.select({ value: count() }).from(users);
    expect(row.value).toBe(0);
    await client.close();
  });

  it("request and identity modules contain no migration or seed imports", () => {
    for (const file of [
      "src/db/index.ts",
      "src/lib/current-user.ts",
      "src/lib/mobile-auth.ts",
    ]) {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/migrator|seedDemoData|@\/db\/seed/);
    }
  });
});
