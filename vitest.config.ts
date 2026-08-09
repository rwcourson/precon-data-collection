import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Isolate PGlite so migrate() does not fight a dirty local .pglite used by `next dev`.
const pgliteTestDir = path.join(os.tmpdir(), `precon-vitest-${process.pid}`);
fs.mkdirSync(pgliteTestDir, { recursive: true });
process.env.PGLITE_DATA_DIR = pgliteTestDir;

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    passWithNoTests: false,
    testTimeout: 60_000,
    hookTimeout: 90_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next.js server boundary marker — empty stub for unit tests.
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
      // Server actions call revalidatePath; stub for node test env.
      "next/cache": path.resolve(__dirname, "./src/test/next-cache-stub.ts"),
      "next/headers": path.resolve(__dirname, "./src/test/next-headers-stub.ts"),
    },
  },
});
