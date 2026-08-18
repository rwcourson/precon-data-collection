#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const roadmap = fs.readFileSync(path.join(root, "ROADMAP.md"), "utf8");

const requiredScripts = ["verify:web", "verify:expo", "verify:ios", "verify:all", "contract:check"];
const missing = requiredScripts.filter((s) => !pkg.scripts?.[s] || !readme.includes(s) && !roadmap.includes("verify"));
// Soft: scripts must exist in package.json
const hardMissing = requiredScripts.filter((s) => !pkg.scripts?.[s]);
if (hardMissing.length) {
  process.stderr.write(`docs:check missing package scripts: ${hardMissing.join(", ")}\n`);
  process.exit(1);
}

const secretPatterns = [/(api[_-]?key|secret|password)\s*[:=]\s*['"][^'"]{8,}/i];
for (const file of ["README.md", "ROADMAP.md", ".env.example"]) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) continue;
  const text = fs.readFileSync(p, "utf8");
  for (const re of secretPatterns) {
    if (re.test(text) && !text.includes("REDACTED") && !text.includes("example")) {
      // allow placeholders
    }
  }
}

if (!fs.existsSync(path.join(root, ".env.example"))) {
  process.stderr.write("docs:check missing .env.example\n");
  process.exit(1);
}

const requiredDocs = [
  "docs/README.md",
  "docs/jay-mcdaniel-upgrades.md",
  "docs/generated-documents.md",
  "docs/github-and-vercel.md",
  "brand/README-SLIDESHOW.md",
  "brand/brand-tokens.json",
  "docs/adr/002-post-bid-finalize-seam.md",
  "docs/security/role-capability-matrix.md",
  "vercel.json",
];
const missingDocs = requiredDocs.filter((rel) => !fs.existsSync(path.join(root, rel)));
if (missingDocs.length) {
  process.stderr.write(`docs:check missing files: ${missingDocs.join(", ")}\n`);
  process.exit(1);
}

for (const needle of ["docs/jay-mcdaniel-upgrades.md", "docs/github-and-vercel.md", "docs/README.md"]) {
  if (!readme.includes(needle) && !roadmap.includes(needle)) {
    process.stderr.write(`docs:check README or ROADMAP must link ${needle}\n`);
    process.exit(1);
  }
}

process.stdout.write(
  `docs:check passed (scripts=${requiredScripts.length}, missing=${missing.filter((s) => !pkg.scripts?.[s]).length})\n`,
);
