import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Expo app has its own toolchain; not linted by Next eslint
    "apps/**",
    // Vendored chart package is minified; hook-name rules do not apply
    "vendor/**",
    // Eve local runtime snapshots — not app source
    ".eve/**",
  ]),
]);

export default eslintConfig;
