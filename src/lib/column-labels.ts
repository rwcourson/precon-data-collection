import type { RoundStatus } from "@/db/schema";
import { FIELD_DEFS } from "@/lib/fields";
import { STATUS_LABELS } from "@/lib/labels";
import { LATEST_NOTE_KEY, LATEST_NOTE_LABEL } from "@/lib/latest-note";
import { METRIC_DEFS } from "@/lib/metrics";

const EXTRA_LABELS: Record<string, string> = {
  id: "ID",
  roundId: "Round ID",
  jobId: "Job ID",
  homeRegion: "Home Region",
  visibilityRegions: "Visible Regions",
  status: "Status",
  outcome: "Outcome",
  roundNumber: "Round #",
  estimateLeadName: "Estimate Lead",
  teamAssignedAt: "Team Assigned",
  createdAt: "Created",
  updatedAt: "Updated",
  authorName: "Author",
  body: "Note",
  excerpt: "Excerpt",
  query: "Query",
  href: "Link",
  label: "Name",
  hint: "Detail",
  [LATEST_NOTE_KEY]: LATEST_NOTE_LABEL,
};

const FIELD_LABELS = Object.fromEntries(
  FIELD_DEFS.map((f) => [f.key, f.label])
);
const METRIC_LABELS = Object.fromEntries(
  METRIC_DEFS.map((m) => [`metric:${m.key}`, m.label])
);

export function columnDisplayLabel(key: string): string {
  if (EXTRA_LABELS[key]) return EXTRA_LABELS[key];
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  if (METRIC_LABELS[key]) return METRIC_LABELS[key];
  if (key.startsWith("custom:")) return key.slice("custom:".length);
  if (key.startsWith("metric:")) {
    const metric = METRIC_DEFS.find(
      (m) => m.key === key.slice("metric:".length)
    );
    if (metric) return metric.label;
  }
  const agg = key.match(/^(sum|avg|count|min|max):(.+)$/);
  if (agg) {
    const fn = agg[1]!.toUpperCase();
    return `${fn} ${columnDisplayLabel(agg[2]!)}`;
  }
  return humanizeFieldKey(key);
}

export function humanizeFieldKey(key: string): string {
  const spaced = key
    .replace(/[:_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return key;
  return spaced
    .split(" ")
    .map((word) => {
      if (/^id$/i.test(word)) return "ID";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

const DISPLAY_PRIORITY = [
  "jobNumber",
  "jobName",
  "status",
  "homeRegion",
  "estimatePhase",
  "bidDueDate",
  "estimateLeadName",
  "region",
  "outcome",
];

const INTERNAL_KEYS = new Set(["id", "roundId", "jobId"]);

/** Prefer human fields; hide raw IDs unless nothing else is present. */
export function tableColumnKeys(
  row: Record<string, unknown>,
  limit = 6
): string[] {
  const keys = Object.keys(row);
  const preferred = DISPLAY_PRIORITY.filter((key) => keys.includes(key));
  const rest = keys.filter(
    (key) => !preferred.includes(key) && !INTERNAL_KEYS.has(key)
  );
  const visible = [...preferred, ...rest];
  return (visible.length > 0 ? visible : keys).slice(0, limit);
}

export function formatColumnValue(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (key === "status" && typeof value === "string" && value in STATUS_LABELS) {
    return STATUS_LABELS[value as RoundStatus];
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
