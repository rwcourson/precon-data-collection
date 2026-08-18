import type { ReportFieldDef } from "@/lib/report-engine";
import { LATEST_NOTE_KEY } from "@/lib/latest-note";

export function reportColumnMeta(key: string, catalog: ReportFieldDef[]) {
  const baseKey =
    key.includes(":") && !key.startsWith("metric:") && !key.startsWith("custom:")
      ? key.split(":")[1]
      : key;
  const def = catalog.find((c) => c.key === key || c.key === baseKey);
  const type = def?.type;
  const numeric =
    key.startsWith("count:") ||
    key.startsWith("sum:") ||
    key.startsWith("avg:") ||
    key.startsWith("min:") ||
    key.startsWith("max:") ||
    type === "number" ||
    type === "dollars" ||
    type === "metric";
  const wide = key === "jobName" || key === LATEST_NOTE_KEY || type === "text";
  return { numeric, wide, date: type === "date", wrap: key === LATEST_NOTE_KEY };
}

export function reportColumnWidth(
  key: string,
  columns: { key: string }[],
  catalog: ReportFieldDef[],
): string {
  const metas = columns.map((c) => ({ key: c.key, ...reportColumnMeta(c.key, catalog) }));
  const growKeys = metas.filter((m) => m.wide).map((m) => m.key);
  const growers = growKeys.length > 0 ? growKeys : columns.map((c) => c.key);
  if (growers.includes(key)) {
    const hug = metas.filter((m) => !growers.includes(m.key)).length;
    const leftover = Math.max(28, 100 - hug * 12);
    return `${Math.round(leftover / growers.length)}%`;
  }
  const self = metas.find((m) => m.key === key);
  if (self?.numeric) return "7.5rem";
  if (self?.date) return "8rem";
  return "11rem";
}
