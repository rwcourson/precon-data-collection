import type { CustomColumn } from "@/db/schema";

export type RegionCustomTab = {
  title: string;
  region: string;
  columns: CustomColumn[];
};

/** Strip the region prefix so "Central Heavy Civil" → "Heavy Civil". */
export function regionCustomTabTitle(region: string, preconDepartment: string | null | undefined): string {
  if (!preconDepartment) return region;
  const stripped = preconDepartment
    .replace(new RegExp(`^${region}\\s*[–-]?\\s*`, "i"), "")
    .trim();
  return stripped ? `${region} — ${stripped}` : region;
}

/**
 * Region-scoped extras for this round. Department-tagged columns only appear
 * on matching departments; null department = all rounds in that region.
 * Company-scope columns are excluded (they stay on the general form).
 */
export function regionScopedColumnsForRound(
  columns: CustomColumn[],
  round: { region: string; preconDepartment: string },
): CustomColumn[] {
  return columns.filter((column) => {
    if (column.scope !== "region") return false;
    if (column.region !== round.region) return false;
    if (column.preconDepartment && column.preconDepartment !== round.preconDepartment) return false;
    return true;
  });
}

export function regionCustomTabForRound(
  columns: CustomColumn[],
  round: { region: string; preconDepartment: string },
): RegionCustomTab | null {
  const matching = regionScopedColumnsForRound(columns, round);
  if (matching.length === 0) return null;
  return {
    title: regionCustomTabTitle(round.region, round.preconDepartment),
    region: round.region,
    columns: matching,
  };
}

export function companyScopedColumns(columns: CustomColumn[]): CustomColumn[] {
  return columns.filter((column) => column.scope === "company");
}
