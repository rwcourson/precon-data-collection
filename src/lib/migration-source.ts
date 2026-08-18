/**
 * Provenance of the Smartsheet import, written by the importer and read by the
 * Migration tab. Kept in its own module so the seed script (plain Node) and the
 * app can share the key without pulling in server-only code.
 */

export const IMPORT_SOURCE_KEY = "importSource";

export type ImportSource = {
  importedAt: string;
  directory: string;
  filesUsed: string[];
  filesSkipped: string[];
  jobs: number;
  rounds: number;
};

/**
 * Bid years named in the imported filenames. The trailing Smartsheet sheet id
 * is stripped first, otherwise a 16-digit id contributes phantom years.
 */
export function sourceYears(files: string[]): number[] {
  const years = new Set<number>();
  for (const file of files) {
    const base = file.replace(/\.json$/, "").replace(/__\d+$/, "");
    for (const match of base.matchAll(/(?<!\d)(20[1-4]\d)(?!\d)/g))
      years.add(Number(match[1]));
  }
  return [...years].sort((a, b) => a - b);
}

/** Turns a Smartsheet export filename into something a person can read. */
export function describeSheet(file: string): { region: string; sheet: string } {
  const base = file.replace(/\.json$/, "").replace(/__\d+$/, "");
  const parts = base.split("__");
  const sheet = (parts[parts.length - 1] ?? base).replace(/_/g, " ").trim();
  const prefix = parts[0]?.split("_")[0] ?? "";
  const region =
    {
      "00": "Corporate",
      CAR: "Carolinas",
      CEN: "Central",
      FL: "Florida",
      GA: "Georgia",
      TX: "Texas",
    }[prefix] ?? prefix;
  return { region, sheet };
}

/** Why a sheet in the export was not treated as a source of estimate rounds. */
export function skipReason(file: string): string {
  if (/Self_Perform/i.test(file))
    return "Self-perform scope — would double-count rounds";
  if (/Checklist/i.test(file)) return "Process checklist, not estimate data";
  if (/Consolidated/i.test(file))
    return "Pre-aggregated rollup of sheets already imported";
  if (/Backup|Dashboard/i.test(file))
    return "Dashboard backing data, derived from imported sheets";
  if (/Roster/i.test(file)) return "Staff roster";
  if (/Scoreboard/i.test(file)) return "Derived scoreboard";
  if (/Cost_Tracking/i.test(file))
    return "Monthly precon cost tracking — outside the BRD scope";
  return "Not a bid schedule, post-bid, or estimate metrics sheet";
}
