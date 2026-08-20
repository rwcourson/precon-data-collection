import { z } from "zod";
import { parseBidScheduleViewConfig } from "@/lib/view-config";

export const BID_SCHEDULE_SURFACE = "bid-schedule";

export type UserTablePrefsConfig = {
  version: 2;
  columns?: string[];
  density?: "summary" | "detail";
  viewMode?: "table" | "cards" | "gantt";
  columnWidths?: Record<string, number>;
  defaultViewId?: number | null;
};

const prefsExtrasSchema = z.object({
  columnWidths: z.record(z.string(), z.number()).optional(),
  defaultViewId: z.number().int().positive().nullable().optional(),
});

/**
 * Parse per-user table prefs JSONB. Columns/density reuse the phase-4
 * `parseBidScheduleViewConfig` fallback; unknown extras are dropped.
 */
export function parseUserTablePrefsConfig(raw: unknown): UserTablePrefsConfig {
  const viewish = parseBidScheduleViewConfig(raw);
  const extras = prefsExtrasSchema.safeParse(raw);
  const columnWidths = extras.success ? extras.data.columnWidths : undefined;
  const defaultViewId = extras.success
    ? (extras.data.defaultViewId ?? null)
    : null;
  return {
    version: 2,
    columns: viewish.columns,
    density: viewish.density,
    viewMode: viewish.viewMode,
    columnWidths,
    defaultViewId,
  };
}

export type BidScheduleTableSource = "view" | "prefs" | "defaults";

export type ResolvedBidScheduleTableState = {
  /** Precedence: applied named view > user prefs > density defaults. */
  source: BidScheduleTableSource;
  activeViewId?: number;
  columns?: string[];
  density: "summary" | "detail";
  viewMode: "table" | "cards" | "gantt";
  columnWidths: Record<string, number>;
  defaultViewId: number | null;
};

/**
 * Resolve what the Bid Schedule table should show.
 *
 * Precedence (documented for callers):
 * 1. Applied named view (`urlViewId`, or auto-applied `defaultViewId` unless skipped)
 * 2. User prefs for the surface
 * 3. Density column defaults (caller falls back when `columns` is omitted)
 *
 * Clearing a named view should pass `skipDefaultView: true` so the starred
 * default does not snap back. Widths always come from prefs (views do not store them).
 */
export function resolveBidScheduleTableState(input: {
  urlViewId?: number;
  skipDefaultView?: boolean;
  urlDensity?: "summary" | "detail";
  urlViewMode?: "table" | "cards" | "gantt";
  urlColumns?: string[];
  prefs: UserTablePrefsConfig;
  views: {
    id: number;
    config: {
      columns?: string[];
      density?: "summary" | "detail";
      viewMode?: "table" | "cards" | "gantt";
    };
  }[];
}): ResolvedBidScheduleTableState {
  const viewsById = new Map(input.views.map((view) => [view.id, view]));
  const defaultViewId =
    input.prefs.defaultViewId && viewsById.has(input.prefs.defaultViewId)
      ? input.prefs.defaultViewId
      : null;
  const columnWidths = input.prefs.columnWidths ?? {};
  const urlColumns =
    input.urlColumns && input.urlColumns.length > 0
      ? input.urlColumns
      : undefined;

  const namedId =
    input.urlViewId && viewsById.has(input.urlViewId)
      ? input.urlViewId
      : !input.skipDefaultView && defaultViewId
        ? defaultViewId
        : undefined;
  const named = namedId != null ? viewsById.get(namedId) : undefined;

  if (named) {
    return {
      source: "view",
      activeViewId: namedId,
      columns: urlColumns ?? named.config.columns,
      density: input.urlDensity ?? named.config.density ?? "summary",
      viewMode: input.urlViewMode ?? named.config.viewMode ?? "table",
      columnWidths,
      defaultViewId,
    };
  }

  if (input.prefs.columns?.length || input.prefs.density) {
    return {
      source: "prefs",
      columns: urlColumns ?? input.prefs.columns,
      density: input.urlDensity ?? input.prefs.density ?? "summary",
      viewMode: input.urlViewMode ?? input.prefs.viewMode ?? "table",
      columnWidths,
      defaultViewId,
    };
  }

  return {
    source: "defaults",
    columns: urlColumns,
    density: input.urlDensity ?? "summary",
    viewMode: input.urlViewMode ?? "table",
    columnWidths,
    defaultViewId,
  };
}
