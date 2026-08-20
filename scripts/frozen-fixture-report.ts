import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AWARDABLE_REPORTING_GRAIN,
  type AwardableReportingRow,
  buildAwardableCandidateReport,
  formatAwardableShadowBrief,
} from "../src/lib/awardable-reporting";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "fixtures/roundtable-locked-frozen.json");
const packet = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  id: string;
  grain: typeof AWARDABLE_REPORTING_GRAIN;
  rows: AwardableReportingRow[];
};

const report = buildAwardableCandidateReport(packet.rows);
const brief = formatAwardableShadowBrief(packet.rows);
const grainMatch =
  JSON.stringify(packet.grain) === JSON.stringify(AWARDABLE_REPORTING_GRAIN);

const out = {
  fixture: packet.id,
  grainMatch,
  candidate: report,
  brief,
  lucySignedOff: process.env.LUCY_FROZEN_FIXTURE_SIGNED_OFF === "1",
  powerBiSignedOff: process.env.POWERBI_PARITY_SIGNED_OFF === "1",
  productionHitRateUnchanged: report.productionHitRateUnchanged,
  note: "Unsigned gates stay fail-closed. This script never switches production hit-rate.",
};

process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
if (!out.grainMatch || packet.id !== "roundtable-locked-frozen-v1") {
  process.exit(1);
}
