"use client";

import {
  Fragment,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Filter,
  Unlink,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AddRoundDialog } from "@/components/bid-schedule/add-round-dialog";
import { SavedViewsMenu } from "@/components/bid-schedule/saved-views-menu";
import { StatusMenu } from "@/components/bid-schedule/status-menu";
import { CellEditor } from "@/components/sheets/cell-editor";
import { updateRoundCell } from "@/actions/post-bid";
import type { BidScheduleViewRow } from "@/actions/bid-schedule-views";
import {
  BID_DUE_URGENCY_LABEL,
  bidDueUrgency,
  buildBidScheduleSections,
  type BidScheduleSort,
  type BidScheduleViewQuery,
} from "@/lib/bid-schedule";
import type { BidScheduleGroupBy } from "@/domain/contracts";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDollars } from "@/lib/format";
import type { RoundStatus } from "@/db/schema";

export type SiblingRound = {
  id: number;
  estimatePhase: string;
  bidDueDate: string | null;
  status: RoundStatus;
  roundNumber: number;
};

export type BidSheetRow = {
  id: number;
  jobId: number;
  jobNumber: string;
  jobName: string;
  region: string;
  preconDepartment: string;
  marketSector: string | null;
  contractType: string | null;
  procurement: string | null;
  mlt: string | null;
  statusAtPricing: string | null;
  roundNumber: number;
  estimatePhase: string;
  bidYear: number;
  drawingsDueDate: string | null;
  bidReviewDate: string | null;
  bidDueDate: string | null;
  projectStartDate: string | null;
  city: string | null;
  state: string | null;
  estimateLeadName: string | null;
  estimateValue: number | null;
  status: RoundStatus;
  isLinked: boolean;
  allowed: RoundStatus[];
};

type ColKey =
  | "jobNumber"
  | "jobName"
  | "region"
  | "preconDepartment"
  | "estimatePhase"
  | "drawingsDueDate"
  | "bidReviewDate"
  | "bidDueDate"
  | "procurement"
  | "mlt"
  | "marketSector"
  | "contractType"
  | "estimateLead"
  | "bidYear"
  | "location"
  | "projectStartDate"
  | "statusAtPricing"
  | "estimateValue"
  | "status";

type ColDef = {
  key: ColKey;
  label: string;
  width: number;
  minWidth: number;
  align?: "left" | "right";
  filter: "text" | "values" | "none";
  getValue: (row: BidSheetRow) => string;
  getSortValue: (row: BidSheetRow) => string | number;
};

const COLS: ColDef[] = [
  {
    key: "jobNumber",
    label: "Job #",
    width: 118,
    minWidth: 72,
    filter: "text",
    getValue: (r) => r.jobNumber,
    getSortValue: (r) => r.jobNumber,
  },
  {
    key: "jobName",
    label: "Job Name",
    width: 240,
    minWidth: 140,
    filter: "text",
    getValue: (r) => r.jobName,
    getSortValue: (r) => r.jobName.toLowerCase(),
  },
  {
    key: "region",
    label: "Region",
    width: 120,
    minWidth: 80,
    filter: "values",
    getValue: (r) => r.region,
    getSortValue: (r) => r.region,
  },
  {
    key: "preconDepartment",
    label: "Division",
    width: 150,
    minWidth: 100,
    filter: "values",
    getValue: (r) => r.preconDepartment,
    getSortValue: (r) => r.preconDepartment,
  },
  {
    key: "estimatePhase",
    label: "Estimate Phase",
    width: 140,
    minWidth: 100,
    filter: "values",
    getValue: (r) => r.estimatePhase,
    getSortValue: (r) => r.estimatePhase,
  },
  {
    key: "drawingsDueDate",
    label: "Drawings Due",
    width: 118,
    minWidth: 88,
    filter: "text",
    getValue: (r) => r.drawingsDueDate ?? "",
    getSortValue: (r) => r.drawingsDueDate ?? "9999",
  },
  {
    key: "bidReviewDate",
    label: "Bid Review",
    width: 118,
    minWidth: 88,
    filter: "text",
    getValue: (r) => r.bidReviewDate ?? "",
    getSortValue: (r) => r.bidReviewDate ?? "9999",
  },
  {
    key: "bidDueDate",
    label: "Bid Due",
    width: 128,
    minWidth: 88,
    filter: "text",
    getValue: (r) => r.bidDueDate ?? "",
    getSortValue: (r) => r.bidDueDate ?? "9999",
  },
  {
    key: "procurement",
    label: "Procurement",
    width: 130,
    minWidth: 90,
    filter: "values",
    getValue: (r) => r.procurement ?? "",
    getSortValue: (r) => r.procurement ?? "",
  },
  {
    key: "mlt",
    label: "MLT",
    width: 110,
    minWidth: 72,
    filter: "values",
    getValue: (r) => r.mlt ?? "",
    getSortValue: (r) => r.mlt ?? "",
  },
  {
    key: "marketSector",
    label: "Market Sector",
    width: 150,
    minWidth: 100,
    filter: "values",
    getValue: (r) => r.marketSector ?? "",
    getSortValue: (r) => r.marketSector ?? "",
  },
  {
    key: "contractType",
    label: "Contract Type",
    width: 130,
    minWidth: 90,
    filter: "values",
    getValue: (r) => r.contractType ?? "",
    getSortValue: (r) => r.contractType ?? "",
  },
  {
    key: "estimateLead",
    label: "Estimate Lead",
    width: 140,
    minWidth: 100,
    filter: "values",
    getValue: (r) => r.estimateLeadName ?? "",
    getSortValue: (r) => (r.estimateLeadName ?? "").toLowerCase(),
  },
  {
    key: "bidYear",
    label: "Bid Year",
    width: 88,
    minWidth: 64,
    filter: "values",
    getValue: (r) => String(r.bidYear),
    getSortValue: (r) => r.bidYear,
  },
  {
    key: "location",
    label: "Location",
    width: 130,
    minWidth: 90,
    filter: "text",
    getValue: (r) => (r.city ? `${r.city}, ${r.state ?? ""}` : ""),
    getSortValue: (r) => (r.city ? `${r.city}, ${r.state ?? ""}` : ""),
  },
  {
    key: "projectStartDate",
    label: "Start Date",
    width: 118,
    minWidth: 88,
    filter: "text",
    getValue: (r) => r.projectStartDate ?? "",
    getSortValue: (r) => r.projectStartDate ?? "9999",
  },
  {
    key: "statusAtPricing",
    label: "Status at Pricing",
    width: 140,
    minWidth: 100,
    filter: "values",
    getValue: (r) => r.statusAtPricing ?? "",
    getSortValue: (r) => r.statusAtPricing ?? "",
  },
  {
    key: "estimateValue",
    label: "Est. Value",
    width: 110,
    minWidth: 80,
    align: "right",
    filter: "text",
    getValue: (r) => (r.estimateValue != null ? String(r.estimateValue) : ""),
    getSortValue: (r) => r.estimateValue ?? -1,
  },
  {
    key: "status",
    label: "Status",
    width: 160,
    minWidth: 110,
    filter: "values",
    getValue: (r) => r.status,
    getSortValue: (r) => r.status,
  },
];

const COL_BY_KEY = Object.fromEntries(COLS.map((c) => [c.key, c])) as Record<ColKey, ColDef>;

export const SUMMARY_COL_KEYS: ColKey[] = [
  "jobNumber",
  "jobName",
  "estimatePhase",
  "drawingsDueDate",
  "bidReviewDate",
  "bidDueDate",
  "procurement",
  "estimateLead",
  "estimateValue",
  "status",
];

export const DETAIL_COL_KEYS: ColKey[] = [
  "jobNumber",
  "jobName",
  "region",
  "preconDepartment",
  "estimatePhase",
  "drawingsDueDate",
  "bidReviewDate",
  "bidDueDate",
  "procurement",
  "mlt",
  "marketSector",
  "contractType",
  "estimateLead",
  "bidYear",
  "location",
  "projectStartDate",
  "statusAtPricing",
  "estimateValue",
  "status",
];

const EDITABLE: Partial<Record<ColKey, { type: string; listKey?: string }>> = {
  estimatePhase: { type: "dropdown", listKey: "estimatePhase" },
  drawingsDueDate: { type: "date" },
  bidReviewDate: { type: "date" },
  bidDueDate: { type: "date" },
  procurement: { type: "dropdown", listKey: "procurement" },
  mlt: { type: "dropdown", listKey: "mlt" },
  marketSector: { type: "dropdown", listKey: "marketSector" },
  contractType: { type: "dropdown", listKey: "contractType" },
  bidYear: { type: "dropdown", listKey: "bidYear" },
  statusAtPricing: { type: "dropdown", listKey: "statusAtPricing" },
  projectStartDate: { type: "date" },
};

type SortState = { key: ColKey; dir: "asc" | "desc" } | null;
type Filters = Partial<Record<ColKey, { text?: string; values?: string[] }>>;

const WIDTH_STORAGE = "precon-bid-schedule-col-widths";

const DEFAULT_COL_WIDTHS = Object.freeze(
  Object.fromEntries(COLS.map((c) => [c.key, c.width])) as Record<string, number>,
);

const defaultColWidths = () => DEFAULT_COL_WIDTHS;

const widthListeners = new Set<() => void>();
let widthCache: Record<string, number> | null = null;

function readColWidths(): Record<string, number> {
  if (widthCache) return widthCache;
  const defaults = defaultColWidths();
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE);
    if (!raw) {
      widthCache = defaults;
      return defaults;
    }
    widthCache = { ...defaults, ...(JSON.parse(raw) as Record<string, number>) };
    return widthCache;
  } catch {
    widthCache = defaults;
    return defaults;
  }
}

function writeColWidths(next: Record<string, number>) {
  widthCache = next;
  try {
    localStorage.setItem(WIDTH_STORAGE, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  for (const listener of widthListeners) listener();
}

function subscribeColWidths(listener: () => void) {
  widthListeners.add(listener);
  return () => {
    widthListeners.delete(listener);
  };
}

function keysForDensity(density: "summary" | "detail"): ColKey[] {
  return density === "detail" ? DETAIL_COL_KEYS : SUMMARY_COL_KEYS;
}

export function BidScheduleSheet({
  rows,
  canEdit,
  lists,
  groupBy = "none",
  sort = { field: "bidDueDate", dir: "asc" },
  density = "summary",
  initialColumns,
  siblingsByJobId = {},
  views = [],
  currentUserId,
  activeViewId,
  viewConfig,
  shareLabel = "Share with my region",
}: {
  rows: BidSheetRow[];
  canEdit: boolean;
  lists: Record<string, string[]>;
  groupBy?: BidScheduleGroupBy;
  sort?: BidScheduleSort;
  density?: "summary" | "detail";
  initialColumns?: string[];
  siblingsByJobId?: Record<number, SiblingRound[]>;
  views?: BidScheduleViewRow[];
  currentUserId: number;
  activeViewId?: number;
  viewConfig: BidScheduleViewQuery;
  shareLabel?: string;
}) {
  const storedWidths = useSyncExternalStore(
    subscribeColWidths,
    readColWidths,
    defaultColWidths,
  );
  const [draftWidths, setDraftWidths] = useState<Record<string, number> | null>(null);
  const widths = draftWidths ?? storedWidths;
  const [colSort, setColSort] = useState<SortState>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [filterOpen, setFilterOpen] = useState<ColKey | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<ColKey[]>(() => {
    const fromView = (initialColumns ?? []).filter((k): k is ColKey => k in COL_BY_KEY);
    return fromView.length > 0 ? fromView : keysForDensity(density);
  });
  const resizing = useRef<{ key: ColKey; startX: number; startW: number } | null>(null);

  const visibleCols = useMemo(
    () => visibleKeys.map((k) => COL_BY_KEY[k]).filter(Boolean),
    [visibleKeys],
  );

  const onResizeStart = (key: ColKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const col = COL_BY_KEY[key];
    resizing.current = {
      key,
      startX: e.clientX,
      startW: widths[key] ?? col.width,
    };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = ev.clientX - resizing.current.startX;
      const min = COL_BY_KEY[resizing.current.key].minWidth;
      const w = Math.max(min, resizing.current.startW + delta);
      setDraftWidths((prev) => ({
        ...(prev ?? readColWidths()),
        [resizing.current!.key]: w,
      }));
    };
    const onUp = () => {
      setDraftWidths((prev) => {
        if (prev) writeColWidths(prev);
        return null;
      });
      resizing.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const toggleSort = (key: ColKey) => {
    setColSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const activeFilterCount = Object.values(filters).filter(
    (f) => (f?.text && f.text.trim()) || (f?.values && f.values.length > 0),
  ).length;

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      for (const col of visibleCols) {
        const f = filters[col.key];
        if (!f) continue;
        const val = col.getValue(row);
        if (f.text && f.text.trim()) {
          if (!val.toLowerCase().includes(f.text.trim().toLowerCase())) return false;
        }
        if (f.values && f.values.length > 0) {
          if (!f.values.includes(val)) return false;
        }
      }
      return true;
    });
  }, [rows, filters, visibleCols]);

  const sections = useMemo(() => {
    const built = buildBidScheduleSections(filtered, groupBy, sort);
    if (!colSort) return built;
    const col = COL_BY_KEY[colSort.key];
    if (!col) return built;
    const resort = (list: BidSheetRow[]) =>
      [...list].sort((a, b) => {
        const av = col.getSortValue(a);
        const bv = col.getSortValue(b);
        let cmp = 0;
        if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
        else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return colSort.dir === "asc" ? cmp : -cmp;
      });
    return built.map((section) => ({
      ...section,
      rows: resort(section.rows),
      groups: section.groups
        ? section.groups.map((g) => ({ ...g, rows: resort(g.rows) }))
        : null,
    }));
  }, [filtered, groupBy, sort, colSort]);

  const filteredSorted = useMemo(
    () => sections.flatMap((s) => s.rows),
    [sections],
  );

  const uniqueValues = useMemo(() => {
    const map: Partial<Record<ColKey, string[]>> = {};
    for (const col of visibleCols) {
      if (col.filter !== "values") continue;
      const set = new Set<string>();
      for (const row of rows) {
        const v = col.getValue(row);
        if (v) set.add(v);
      }
      map[col.key] = [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    return map;
  }, [rows, visibleCols]);

  const clearFilters = () => setFilters({});

  const actionWidth = canEdit ? 120 : 0;
  const totalWidth =
    visibleCols.reduce((sum, c) => sum + (widths[c.key] ?? c.width), 0) + actionWidth;
  const colSpan = visibleCols.length + (canEdit ? 1 : 0);

  const config: BidScheduleViewQuery = {
    ...viewConfig,
    density,
    columns: visibleKeys,
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {filteredSorted.length} of {rows.length} estimate round
          {rows.length === 1 ? "" : "s"}
          {activeFilterCount > 0
            ? ` · ${activeFilterCount} column filter${activeFilterCount === 1 ? "" : "s"}`
            : ""}
          {canEdit ? " · double-click a cell to edit" : ""}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="gap-1" onClick={clearFilters}>
              <X className="size-3" /> Clear filters
            </Button>
          )}
          <ColumnPicker
            selected={visibleKeys}
            onChange={setVisibleKeys}
            density={density}
          />
          <SavedViewsMenu
            views={views}
            currentUserId={currentUserId}
            activeViewId={activeViewId}
            config={config}
            shareLabel={shareLabel}
          />
        </div>
      </div>

      <div className="overflow-auto rounded border border-border/70 bg-card">
        <table
          className="border-collapse text-[13px]"
          style={{ tableLayout: "fixed", width: totalWidth, minWidth: "100%" }}
        >
          <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
            <tr className="border-b">
              {visibleCols.map((col) => {
                const isSorted = colSort?.key === col.key;
                const hasFilter =
                  Boolean(filters[col.key]?.text?.trim()) ||
                  Boolean(filters[col.key]?.values?.length);
                return (
                  <th
                    key={col.key}
                    className={cn(
                      "relative h-9 select-none border-r border-border/50 px-1.5 text-left align-middle text-2xs font-medium tracking-wide text-muted-foreground last:border-r-0",
                      col.align === "right" && "text-right",
                    )}
                    style={{ width: widths[col.key] ?? col.width }}
                  >
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left outline-none hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
                          col.align === "right" && "justify-end",
                          isSorted && "text-foreground",
                        )}
                        onClick={() => toggleSort(col.key)}
                      >
                        <span className="truncate">{col.label}</span>
                        {isSorted ? (
                          colSort!.dir === "asc" ? (
                            <ArrowUp className="size-3 shrink-0" />
                          ) : (
                            <ArrowDown className="size-3 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 shrink-0 opacity-30" />
                        )}
                      </button>

                      {col.filter !== "none" && (
                        <Popover
                          open={filterOpen === col.key}
                          onOpenChange={(open) => setFilterOpen(open ? col.key : null)}
                        >
                          <PopoverTrigger
                            render={
                              <button
                                type="button"
                                className={cn(
                                  "rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                                  hasFilter && "bg-primary/10 text-primary",
                                )}
                                aria-label={`Filter ${col.label}`}
                              />
                            }
                          >
                            <Filter className="size-3" />
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-64 gap-2 p-3">
                            <ColumnFilterPanel
                              col={col}
                              filter={filters[col.key]}
                              options={uniqueValues[col.key] ?? []}
                              onChange={(next) =>
                                setFilters((prev) => ({ ...prev, [col.key]: next }))
                              }
                              onClear={() =>
                                setFilters((prev) => {
                                  const copy = { ...prev };
                                  delete copy[col.key];
                                  return copy;
                                })
                              }
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    <div
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(e) => onResizeStart(col.key, e)}
                      className="absolute top-0 right-0 z-20 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60"
                    />
                  </th>
                );
              })}
              {canEdit && (
                <th
                  className="h-9 border-r border-border/50 px-2 text-left text-2xs font-medium text-muted-foreground last:border-r-0"
                  style={{ width: actionWidth }}
                />
              )}
            </tr>
          </thead>
          <tbody>
            {filteredSorted.length === 0 && (
              <tr>
                <td
                  colSpan={colSpan}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  No pursuits match the current filters.
                </td>
              </tr>
            )}
            {sections.map((section) => {
              const blocks =
                section.groups ??
                (section.rows.length > 0
                  ? [{ key: "_all", label: "", rows: section.rows }]
                  : []);
              return (
                <Fragment key={section.key}>
                  <tr className="border-b border-border/70 bg-muted/55">
                    <td
                      colSpan={colSpan}
                      className="px-2 py-1.5 text-2xs font-semibold tracking-wide text-foreground"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {section.label}
                        <Badge variant="secondary" size="sm">
                          {section.rows.length}
                        </Badge>
                      </span>
                    </td>
                  </tr>
                  {blocks.map((block) => (
                    <Fragment key={`${section.key}:${block.key}`}>
                      {block.label ? (
                        <tr className="border-b border-border/50 bg-muted/30">
                          <td
                            colSpan={colSpan}
                            className="px-2 py-1 text-2xs font-medium text-muted-foreground"
                          >
                            {block.label}
                            <span className="ml-1.5 tabular-nums opacity-70">
                              ({block.rows.length})
                            </span>
                          </td>
                        </tr>
                      ) : null}
                      {block.rows.map((row) => (
                        <BidScheduleDataRow
                          key={row.id}
                          row={row}
                          cols={visibleCols}
                          canEdit={canEdit}
                          lists={lists}
                          widths={widths}
                          actionWidth={actionWidth}
                          siblings={siblingsByJobId[row.jobId] ?? []}
                        />
                      ))}
                    </Fragment>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BidScheduleDataRow({
  row,
  cols,
  canEdit,
  lists,
  widths,
  actionWidth,
  siblings,
}: {
  row: BidSheetRow;
  cols: ColDef[];
  canEdit: boolean;
  lists: Record<string, string[]>;
  widths: Record<string, number>;
  actionWidth: number;
  siblings: SiblingRound[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ColKey | null>(null);
  const [overrides, setOverrides] = useState<Partial<Record<ColKey, string>>>({});

  return (
    <tr className="border-b border-border/60 hover:bg-muted/35">
      {cols.map((col) => {
        const spec = EDITABLE[col.key];
        const editable = Boolean(canEdit && spec);
        const isEditing = editing === col.key;
        return (
          <td
            key={col.key}
            className={cn(
              "overflow-hidden border-r border-border/40 px-2 py-1.5 align-top last:border-r-0",
              col.align === "right" && "text-right tabular-nums",
              editable && "cursor-text hover:bg-primary/5",
            )}
            style={{ width: widths[col.key] ?? col.width }}
            onDoubleClick={() => editable && setEditing(col.key)}
          >
            {isEditing && spec ? (
              <CellEditor
                type={spec.type}
                options={spec.listKey ? lists[spec.listKey] : undefined}
                value={overrides[col.key] ?? col.getValue(row) ?? ""}
                onCancel={() => setEditing(null)}
                onCommit={async (next) => {
                  setEditing(null);
                  try {
                    await updateRoundCell(row.id, col.key, next);
                    setOverrides((prev) => ({ ...prev, [col.key]: next }));
                    router.refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not save that value");
                  }
                }}
              />
            ) : (
              <CellDisplay
                col={col}
                row={row}
                display={overrides[col.key] !== undefined ? overrides[col.key]! : col.getValue(row)}
                siblings={siblings}
                canEdit={canEdit}
              />
            )}
          </td>
        );
      })}
      {canEdit && (
        <td className="px-1 py-1" style={{ width: actionWidth }}>
          <div className="flex items-center gap-0.5">
            <AddRoundDialog
              jobId={row.jobId}
              jobName={row.jobName}
              jobNumber={row.jobNumber}
              lists={lists}
            />
            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              nativeButton={false}
              render={<Link href={`/rounds/${row.id}`} />}
            >
              Open
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}

function CellDisplay({
  col,
  row,
  display,
  siblings,
  canEdit,
}: {
  col: ColDef;
  row: BidSheetRow;
  display: string;
  siblings: SiblingRound[];
  canEdit: boolean;
}) {
  if (col.key === "jobNumber") {
    return (
      <span className="flex items-center gap-1 truncate">
        <JobLookupPopover row={row} siblings={siblings} />
        {!row.isLinked && (
          <Badge variant="warning" size="sm">
            <Unlink />
            unlinked
          </Badge>
        )}
      </span>
    );
  }

  if (col.key === "jobName") {
    return (
      <>
        <Link
          href={`/jobs/${row.jobId}`}
          className="block truncate font-medium hover:underline"
          title={row.jobName}
        >
          {row.jobName}
        </Link>
        <p className="truncate text-2xs text-muted-foreground">
          {row.preconDepartment}
          {row.marketSector ? ` · ${row.marketSector}` : ""} · Round {row.roundNumber}
        </p>
      </>
    );
  }

  if (col.key === "status") {
    return (
      <StatusMenu
        roundId={row.id}
        status={row.status}
        allowed={canEdit ? row.allowed : []}
      />
    );
  }

  if (col.key === "estimateValue") {
    return <>{fmtDollars(row.estimateValue, true)}</>;
  }

  if (
    col.key === "bidDueDate" ||
    col.key === "drawingsDueDate" ||
    col.key === "bidReviewDate" ||
    col.key === "projectStartDate"
  ) {
    const shown = display;
    const urgency = col.key === "bidDueDate" ? bidDueUrgency(shown || null) : null;
    return (
      <span className="flex items-center gap-1 truncate">
        <span>{fmtDate(shown || null)}</span>
        {urgency && (
          <Badge
            variant={urgency === "overdue" ? "destructive" : urgency === "week" ? "warning" : "info"}
            size="sm"
          >
            {BID_DUE_URGENCY_LABEL[urgency]}
          </Badge>
        )}
      </span>
    );
  }

  return (
    <span className="block truncate" title={display}>
      {display || "—"}
    </span>
  );
}

function JobLookupPopover({
  row,
  siblings,
}: {
  row: BidSheetRow;
  siblings: SiblingRound[];
}) {
  const phases = siblings.length > 0 ? siblings : [
    {
      id: row.id,
      estimatePhase: row.estimatePhase,
      bidDueDate: row.bidDueDate,
      status: row.status,
      roundNumber: row.roundNumber,
    },
  ];

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="truncate font-mono text-xs hover:underline"
            title="Other estimate rounds on this job"
          />
        }
      >
        {row.jobNumber}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-2 p-3">
        <p className="text-xs font-medium">Rounds on this job</p>
        <ul className="space-y-1">
          {phases.map((phase) => (
            <li key={phase.id}>
              <Link
                href={`/rounds/${phase.id}`}
                className={cn(
                  "flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted",
                  phase.id === row.id && "bg-info-soft font-medium text-primary",
                )}
              >
                <span className="truncate">
                  {phase.estimatePhase}
                  <span className="ml-1 text-muted-foreground">· R{phase.roundNumber}</span>
                </span>
                <span className="shrink-0 text-muted-foreground">{fmtDate(phase.bidDueDate)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href={`/jobs/${row.jobId}`}
          className="block px-1.5 pt-1 text-2xs text-primary hover:underline"
        >
          Open job record
        </Link>
      </PopoverContent>
    </Popover>
  );
}

function ColumnPicker({
  selected,
  onChange,
  density,
}: {
  selected: ColKey[];
  onChange: (next: ColKey[]) => void;
  density: "summary" | "detail";
}) {
  const selectedSet = new Set(selected);

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="gap-1.5" />}
      >
        <Columns3 className="size-3.5" />
        Columns
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 gap-2 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">Visible columns</p>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onChange(keysForDensity(density))}
          >
            Reset
          </Button>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {DETAIL_COL_KEYS.map((key) => {
            const col = COL_BY_KEY[key];
            const checked = selectedSet.has(key);
            const locked = key === "jobName";
            return (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted"
              >
                <Checkbox
                  checked={checked}
                  disabled={locked}
                  onCheckedChange={(v) => {
                    if (locked) return;
                    if (v) onChange([...selected, key]);
                    else onChange(selected.filter((k) => k !== key));
                  }}
                />
                {col.label}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ColumnFilterPanel({
  col,
  filter,
  options,
  onChange,
  onClear,
}: {
  col: ColDef;
  filter?: { text?: string; values?: string[] };
  options: string[];
  onChange: (next: { text?: string; values?: string[] }) => void;
  onClear: () => void;
}) {
  const selected = new Set(filter?.values ?? []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Filter · {col.label}</p>
        <Button
          variant="ghost"
          size="xs"
          className="-mr-1 text-2xs text-muted-foreground"
          onClick={onClear}
        >
          Clear
        </Button>
      </div>

      {(col.filter === "text" || col.filter === "values") && (
        <Input
          value={filter?.text ?? ""}
          onChange={(e) => onChange({ ...filter, text: e.target.value })}
          placeholder="Contains…"
          className="h-8"
          autoFocus
        />
      )}

      {col.filter === "values" && options.length > 0 && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-border/60 p-1.5">
          {options.map((opt) => {
            const checked = selected.has(opt);
            return (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v) next.add(opt);
                    else next.delete(opt);
                    onChange({
                      ...filter,
                      values: [...next],
                    });
                  }}
                />
                <span className="truncate">{opt || "(blank)"}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
