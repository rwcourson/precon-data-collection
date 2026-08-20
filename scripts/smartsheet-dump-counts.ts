/**
 * Parse a staged Smartsheet JSON dump into job/round/duplicate/flag counts.
 * Never changes SMARTSHEET_MODE. Writes gitignored dump-counts.json by default.
 *
 * Usage: pnpm smartsheet:dump-counts [jsonDir] [outJson]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isSmartsheetHistoryDumpFile,
  parseSmartsheetDumpSheets,
  type SmartsheetSheetJson,
} from "../src/lib/integrations/smartsheet/parse";
import { buildSmartsheetDumpCounts } from "../src/lib/smartsheet-dump";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonDir = path.resolve(root, process.argv[2] ?? "data/smartsheet/json");
const outPath = path.resolve(
  root,
  process.argv[3] ?? "data/smartsheet/dump-counts.json"
);

if (!fs.existsSync(jsonDir)) {
  process.stderr.write(
    `No dump directory at ${path.relative(root, jsonDir)}. Run pnpm smartsheet:pull first.\n`
  );
  process.exit(2);
}

const names = fs
  .readdirSync(jsonDir)
  .filter((name) => name.endsWith(".json"))
  .filter(isSmartsheetHistoryDumpFile)
  .sort();

const files = names.map((name) => {
  const bytes = fs.readFileSync(path.join(jsonDir, name), "utf8");
  return {
    name,
    bytes,
    sheet: JSON.parse(bytes) as SmartsheetSheetJson,
  };
});

const first = parseSmartsheetDumpSheets(
  files.map((file) => ({ fileName: file.name, sheet: file.sheet }))
);
const replay = parseSmartsheetDumpSheets(
  files.map((file) => ({ fileName: file.name, sheet: file.sheet }))
);
const dump = buildSmartsheetDumpCounts(files, first.drafts, first.rawDataRows);
const replayDump = buildSmartsheetDumpCounts(
  files,
  replay.drafts,
  replay.rawDataRows
);

if (
  dump.checksum !== replayDump.checksum ||
  dump.rounds !== replayDump.rounds
) {
  process.stderr.write("Parser replay did not match the first pass.\n");
  process.exit(1);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const artifact = {
  ...dump,
  files: files.length,
  rawDataRows: first.rawDataRows,
  parserReplayMatched: true,
  signedOff: process.env.SMARTSHEET_DUMP_SIGNED_OFF === "1",
  note: "This script never changes SMARTSHEET_MODE. Reads stay on until dump-report is green and SMARTSHEET_DUMP_SIGNED_OFF=1.",
};
fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);

process.stdout.write(
  `${JSON.stringify(
    {
      out: path.relative(root, outPath),
      files: files.length,
      jobs: dump.jobs,
      rounds: dump.rounds,
      duplicates: dump.duplicates,
      mergedExtras: dump.mergedExtras,
      requiredFieldFlags: dump.requiredFieldFlags,
      checksum: dump.checksum,
      parserReplayMatched: true,
      signedOff: artifact.signedOff,
      mayDisableReads: false,
    },
    null,
    2
  )}\n`
);
