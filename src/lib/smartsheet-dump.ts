import { createHash } from "node:crypto";
import { draftKey } from "./integrations/smartsheet/parse";

export type DumpRequiredFields = {
  status: string;
  region: string | null;
  preconDepartment: string | null;
  estimatePhase: string | null;
  bidDueDate: string | null;
  awardability: string | null;
  estimateValue: number | null;
  feeBackPage: number | null;
  feeExpected: number | null;
  estimateLeadName: string | null;
};

export type SmartsheetDumpCounts = {
  jobs: number;
  rounds: number;
  duplicates: number;
  requiredFieldFlags: number;
  checksum: string;
};

const COMPLETE_STATUSES = new Set(["submitted", "post_bid", "locked"]);

/** Extra keys beyond the unique set (0 after a successful merge/import). */
export function identityExtraCount(keys: string[]): number {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  let extras = 0;
  for (const count of counts.values()) extras += Math.max(0, count - 1);
  return extras;
}

/**
 * Dump-side missing-required flags for complete-status drafts. Live Precon
 * after import recounts the same fields on stored rounds.
 */
export function dumpRequiredFieldFlagCount(draft: DumpRequiredFields): number {
  if (!COMPLETE_STATUSES.has(draft.status)) return 0;
  let flags = 0;
  if (!draft.region) flags += 1;
  if (!draft.preconDepartment) flags += 1;
  if (!draft.estimatePhase) flags += 1;
  if (!draft.bidDueDate) flags += 1;
  if (!draft.awardability) flags += 1;
  if (draft.estimateValue == null) flags += 1;
  if (draft.feeBackPage == null) flags += 1;
  if (draft.feeExpected == null) flags += 1;
  if (!draft.estimateLeadName) flags += 1;
  return flags;
}

export function countSmartsheetDraftDump(
  drafts: Array<DumpRequiredFields & { jobNumber: string; key: string }>,
  rawDataRows: number
): Omit<SmartsheetDumpCounts, "checksum"> & { mergedExtras: number } {
  return {
    jobs: new Set(drafts.map((draft) => draft.jobNumber)).size,
    rounds: drafts.length,
    duplicates: identityExtraCount(drafts.map((draft) => draft.key)),
    requiredFieldFlags: drafts.reduce(
      (sum, draft) => sum + dumpRequiredFieldFlagCount(draft),
      0
    ),
    mergedExtras: Math.max(0, rawDataRows - drafts.length),
  };
}

export function countLivePreconDump(input: {
  jobNumbers: string[];
  rounds: Array<DumpRequiredFields & { identityKey: string }>;
  dumpChecksum: string;
}): SmartsheetDumpCounts {
  return {
    jobs: new Set(input.jobNumbers).size,
    rounds: input.rounds.length,
    duplicates: identityExtraCount(
      input.rounds.map((round) => round.identityKey)
    ),
    requiredFieldFlags: input.rounds.reduce(
      (sum, round) => sum + dumpRequiredFieldFlagCount(round),
      0
    ),
    checksum: input.dumpChecksum,
  };
}

export function liveRoundIdentityKey(input: {
  jobId: number;
  roundNumber: number;
}): string {
  return draftKey(String(input.jobId), String(input.roundNumber), "round");
}

/** SHA-256 of sorted file name + bytes. Stable across re-parses of the same dump. */
export function checksumSmartsheetDump(
  files: { name: string; bytes: string }[]
): string {
  const hash = createHash("sha256");
  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    hash.update(file.name);
    hash.update("\0");
    hash.update(file.bytes);
  }
  return hash.digest("hex");
}

export function buildSmartsheetDumpCounts(
  files: { name: string; bytes: string }[],
  drafts: Array<DumpRequiredFields & { jobNumber: string; key: string }>,
  rawDataRows: number
): SmartsheetDumpCounts & { mergedExtras: number } {
  const counted = countSmartsheetDraftDump(drafts, rawDataRows);
  return {
    ...counted,
    checksum: checksumSmartsheetDump(files),
  };
}

export type SmartsheetDumpReconciliation = {
  ok: boolean;
  mismatches: string[];
};

/**
 * Stage-one history dump vs live Precon counts. Reads stay on until this
 * report is green *and* an operational owner signs it off.
 */
export function reconcileSmartsheetDump(
  dump: SmartsheetDumpCounts,
  live: SmartsheetDumpCounts
): SmartsheetDumpReconciliation {
  const mismatches: string[] = [];
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

export function smartsheetReadsMayDisable(input: {
  ok: boolean;
  signedOff: boolean;
}): boolean {
  return input.ok && input.signedOff;
}
