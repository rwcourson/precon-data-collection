import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";
import {
  applyTestDatabaseWiring,
  deriveTestDatabaseWiring,
} from "./src/test/test-db";

const pgliteTestDir = path.join(
  os.tmpdir(),
  `precon-vitest-${process.pid}-${Date.now()}`
);

const wiring = deriveTestDatabaseWiring(process.env, {
  pgliteDataDir: pgliteTestDir,
});
if (wiring.mode === "pglite") {
  fs.mkdirSync(pgliteTestDir, { recursive: true });
}
applyTestDatabaseWiring(wiring);
if (wiring.mode === "postgres") {
  process.stderr.write(
    `vitest database: postgres ${wiring.databaseName} (DATABASE_MODE=${process.env.DATABASE_MODE})\n`
  );
} else {
  process.stderr.write(
    `vitest database: pglite ${pgliteTestDir} (DATABASE_MODE=${process.env.DATABASE_MODE})\n`
  );
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // These import apps/mobile (Expo tsconfig). Web CI does not install Expo.
    exclude: [
      "src/lib/mobile-theme.test.ts",
      "src/theme/mobile-tokens.test.ts",
    ],
    passWithNoTests: false,
    testTimeout: 60_000,
    hookTimeout: 90_000,
    // PGlite file DB and WASM cannot safely be shared across worker processes.
    // Postgres lane keeps the same single-worker semantics.
    fileParallelism: false,
    maxWorkers: 1,
    globalSetup: ["src/test/global-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "server-only": path.resolve(
        import.meta.dirname,
        "./src/test/server-only-stub.ts"
      ),
      "next/cache": path.resolve(
        import.meta.dirname,
        "./src/test/next-cache-stub.ts"
      ),
      "next/headers": path.resolve(
        import.meta.dirname,
        "./src/test/next-headers-stub.ts"
      ),
    },
  },
});
