/**
 * Dashboard level scoping — mirrors web src/app/dashboards/page.tsx:
 * - corporate: all workspace rows, group volume by region
 * - region: filter to focus region, group by preconDepartment (division)
 * - division: filter to focus region, group by marketSector
 *
 * Pure helpers so unit tests drive the real logic used by mobile API.
 */

export type DashboardLevel = "corporate" | "region" | "division";

export type ScopeableRound = {
  region: string | null;
  preconDepartment: string | null;
  marketSector: string | null;
  estimateValue: number | null;
  status: string;
};

export function parseDashboardLevel(raw: string | null | undefined): DashboardLevel {
  const v = (raw ?? "corporate").toLowerCase();
  if (v === "region" || v === "division" || v === "corporate") return v;
  return "corporate";
}

/**
 * Apply level filters like web dashboards.
 * @param focusRegion — user/workspace region used when level !== corporate
 */
export function scopeRoundsForLevel<T extends ScopeableRound>(
  rows: T[],
  level: DashboardLevel,
  focusRegion: string | null | undefined,
): T[] {
  if (level === "corporate") return rows;
  const region = focusRegion?.trim() || null;
  if (!region) return rows;
  return rows.filter((r) => r.region === region);
}

export type GroupVolumePoint = { label: string; value: number };

/**
 * Group dimension for the primary volume chart (web rollup groups).
 * corporate → region, region → division (preconDepartment), division → marketSector
 */
export function groupVolumeForLevel<T extends ScopeableRound>(
  scoped: T[],
  level: DashboardLevel,
  opts?: { max?: number },
): GroupVolumePoint[] {
  const max = opts?.max ?? 8;
  const map = new Map<string, number>();
  for (const r of scoped) {
    let key: string;
    if (level === "corporate") {
      key = r.region?.trim() || "Unspecified";
    } else if (level === "region") {
      key = r.preconDepartment?.trim() || "Unspecified";
    } else {
      key = r.marketSector?.trim() || "Unclassified";
    }
    map.set(key, (map.get(key) ?? 0) + (r.estimateValue ?? 0));
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, max);
}

export function groupVolumeChartTitle(level: DashboardLevel): string {
  if (level === "corporate") return "Pursuit volume by region";
  if (level === "region") return "Pursuit volume by division";
  return "Pursuit volume by market sector";
}

export function groupVolumeChartSubtitle(level: DashboardLevel): string {
  if (level === "corporate") return "Estimate value · top regions";
  if (level === "region") return "Estimate value · Precon departments";
  return "Estimate value · market sectors";
}

/** Status counts on already-scoped rows. */
export function statusSeriesFromRounds<T extends { status: string }>(
  scoped: T[],
): { label: string; value: number }[] {
  const byStatus = new Map<string, number>();
  for (const r of scoped) {
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  }
  return [...byStatus.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}
