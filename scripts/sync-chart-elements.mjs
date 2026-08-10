#!/usr/bin/env node
/**
 * Sync a built @rwcourson/chart-elements package into Untitled/vendor for
 * local + Vercel installs (file: dependency).
 *
 * Usage (from Untitled/):
 *   node scripts/sync-chart-elements.mjs
 *   node scripts/sync-chart-elements.mjs /path/to/chart-elements/packages/chart-elements
 */
import { cpSync, existsSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const untitledRoot = resolve(here, "..");
const defaultSource = resolve(
  untitledRoot,
  "../../chart-elements/packages/chart-elements",
);
const source = resolve(process.argv[2] ?? defaultSource);
const dest = join(untitledRoot, "vendor/chart-elements");

if (!existsSync(join(source, "package.json"))) {
  console.error(`chart-elements package not found at ${source}`);
  process.exit(1);
}
if (!existsSync(join(source, "dist/index.js"))) {
  console.error(
    `Built dist missing at ${source}/dist. Run: pnpm --filter @rwcourson/chart-elements build`,
  );
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

const keep = ["dist", "package.json", "README.md", "LICENSE", "NOTICE", "SBOM.cdx.json"];
for (const name of keep) {
  const from = join(source, name);
  if (!existsSync(from)) continue;
  cpSync(from, join(dest, name), { recursive: true });
}

const pkg = JSON.parse(readFileSync(join(dest, "package.json"), "utf8"));
console.log(`Synced ${pkg.name}@${pkg.version} → ${dest}`);
console.log("Run: npm install");
