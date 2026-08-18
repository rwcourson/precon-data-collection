#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const openapi = path.join(root, "contracts/openapi.json");
const shaFile = path.join(root, "contracts/openapi.sha256");
const before = fs.existsSync(openapi) ? fs.readFileSync(openapi, "utf8") : "";
const beforeSha = fs.existsSync(shaFile)
  ? fs.readFileSync(shaFile, "utf8")
  : "";

const gen = spawnSync(
  process.execPath,
  [path.join(root, "scripts/generate-openapi.mjs")],
  {
    cwd: root,
    encoding: "utf8",
  }
);
process.stdout.write(gen.stdout || "");
process.stderr.write(gen.stderr || "");
if (gen.status !== 0) process.exit(gen.status || 1);

const after = fs.readFileSync(openapi, "utf8");
const afterSha = fs.readFileSync(shaFile, "utf8");
if (before && before !== after) {
  process.stderr.write(
    "contract:check failed — openapi.json drifted. Commit regenerated contracts.\n"
  );
  process.exit(1);
}
if (beforeSha && beforeSha !== afterSha) {
  process.stderr.write("contract:check failed — openapi.sha256 drifted.\n");
  process.exit(1);
}
// Fresh generation when no committed file yet is allowed once; require presence after.
if (!fs.existsSync(openapi)) {
  process.stderr.write(
    "contract:check failed — missing contracts/openapi.json\n"
  );
  process.exit(1);
}
const doc = JSON.parse(after);
const ops = Object.values(doc.paths).flatMap((p) => Object.keys(p)).length;
process.stdout.write(
  `contract:check passed (${Object.keys(doc.paths).length} paths, ${ops} operations)\n`
);
