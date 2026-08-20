#!/usr/bin/env node
/**
 * Stage a Smartsheet dump reconciliation report. This never flips SMARTSHEET_MODE.
 * Reads stay on until the report is green *and* an operational owner signs it off.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dumpPath = process.argv[2];
const livePath = process.argv[3];

function readCounts(file) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    jobs: Number(raw.jobs),
    rounds: Number(raw.rounds),
    duplicates: Number(raw.duplicates),
    requiredFieldFlags: Number(raw.requiredFieldFlags),
    checksum: String(raw.checksum),
  };
}

function reconcile(dump, live) {
  const mismatches = [];
  if (dump.checksum !== live.checksum)
    mismatches.push("checksum does not match the staged dump artifact");
  if (dump.jobs !== live.jobs)
    mismatches.push(`job count dump=${dump.jobs} live=${live.jobs}`);
  if (dump.rounds !== live.rounds)
    mismatches.push(`round count dump=${dump.rounds} live=${live.rounds}`);
  if (dump.duplicates !== live.duplicates)
    mismatches.push(
      `duplicate count dump=${dump.duplicates} live=${live.duplicates}`
    );
  if (dump.requiredFieldFlags !== live.requiredFieldFlags)
    mismatches.push(
      `required-field flags dump=${dump.requiredFieldFlags} live=${live.requiredFieldFlags}`
    );
  return { ok: mismatches.length === 0, mismatches };
}

if (!dumpPath || !livePath) {
  process.stdout.write(
    "Usage: node scripts/smartsheet-dump-report.mjs <dump.json> <live.json>\n"
  );
  process.exit(2);
}

const dump = readCounts(path.resolve(root, dumpPath));
const live = readCounts(path.resolve(root, livePath));
const result = reconcile(dump, live);
const signedOff = process.env.SMARTSHEET_DUMP_SIGNED_OFF === "1";
const report = {
  ok: result.ok,
  mismatches: result.mismatches,
  signedOff,
  mayDisableReads: result.ok && signedOff,
  note: "This script never changes SMARTSHEET_MODE. Disable reads only after a signed green report.",
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(result.ok ? 0 : 1);
