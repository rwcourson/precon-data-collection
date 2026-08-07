/**
 * Map Destini / estimating Excel export headers → round post-bid field keys.
 */

export type DestiniMappedRow = {
  jobNumber: string | null;
  estimatePhase: string | null;
  values: Record<string, number | string | null>;
  unmappedHeaders: string[];
};

const HEADER_MAP: Record<string, string> = {
  "job number": "jobNumber",
  jobnumber: "jobNumber",
  "job name": "jobName",
  "estimate phase": "estimatePhase",
  phase: "estimatePhase",
  "estimate value": "estimateValue",
  "grand total": "estimateValue",
  "fee – back page": "feeBackPage",
  "fee - back page": "feeBackPage",
  "fee back page": "feeBackPage",
  "fee – expected": "feeExpected",
  "fee - expected": "feeExpected",
  "fee expected": "feeExpected",
  contingency: "contingencyTotal",
  "contingency – total": "contingencyTotal",
  "craft labor base": "craftLaborBase",
  "craft labor burden": "craftLaborBurden",
  "craft labor man hours": "craftLaborManHours",
  "gc $ – b&g sort": "gcBgSort",
  "gr $ – b&g sort": "grBgSort",
  "pm months": "pmMonths",
  gsf: "gsf",
};

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseCell(v: unknown): string | number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/[$,]/g, ""));
  if (!Number.isNaN(n) && /[\d.]/.test(s)) return n;
  return s;
}

/** Map a header row + data row into DestiniMappedRow. */
export function mapDestiniRow(
  headers: string[],
  cells: unknown[],
): DestiniMappedRow {
  const values: Record<string, number | string | null> = {};
  const unmappedHeaders: string[] = [];
  let jobNumber: string | null = null;
  let estimatePhase: string | null = null;

  headers.forEach((h, i) => {
    const key = HEADER_MAP[normHeader(h)];
    const parsed = parseCell(cells[i]);
    if (!key) {
      if (h.trim()) unmappedHeaders.push(h);
      return;
    }
    if (key === "jobNumber") {
      jobNumber = parsed == null ? null : String(parsed);
      return;
    }
    if (key === "estimatePhase") {
      estimatePhase = parsed == null ? null : String(parsed);
      return;
    }
    if (key === "jobName") return;
    values[key] = parsed;
  });

  return { jobNumber, estimatePhase, values, unmappedHeaders };
}

export function mapDestiniSheet(
  headers: string[],
  rows: unknown[][],
): DestiniMappedRow[] {
  return rows
    .filter((r) => r.some((c) => c != null && String(c).trim() !== ""))
    .map((r) => mapDestiniRow(headers, r));
}
