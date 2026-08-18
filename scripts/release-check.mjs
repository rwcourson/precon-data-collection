#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);
const required = [
  "verify:web",
  "verify:expo",
  "verify:ios",
  "verify:all",
  "verify:restore",
  "verify:artifacts",
  "contract:check",
  "perf:check",
  "security:check",
  "release:check",
  "docs:check",
  "e2e",
];
const missing = required.filter((s) => !pkg.scripts?.[s]);
if (missing.length) {
  process.stderr.write(
    `release:check missing scripts: ${missing.join(", ")}\n`
  );
  process.exit(1);
}
const docs = ["docs/security/sso-proxy-trust.md", "ROADMAP.md", "README.md"];
for (const d of docs) {
  if (!fs.existsSync(path.join(root, d))) {
    process.stderr.write(`release:check missing doc ${d}\n`);
    process.exit(1);
  }
}
process.stdout.write(
  `release:check passed (${required.length} scripts, ${docs.length} docs)\n`
);
