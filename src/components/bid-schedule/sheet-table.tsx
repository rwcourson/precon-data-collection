"use client";

import {
  Fragment,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter,
  Unlink,
  X,
} from "lucide-react";
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
import { StatusMenu } from "@/components/bid-schedule/status-menu";
import {
  buildBidScheduleSections,
  type BidScheduleSort,
} from "@/lib/bid-schedule";
import type { BidScheduleGroupBy } from "@/domain/contracts";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDollars } from "@/lib/format";
import type { RoundStatus } from "@/db/schema";

export type BidSheetRow = {
  id: number;
  jobId: number;
  jobNumber: string;
  jobName: string;
  preconDepartment: string;
  marketSector: string | null;
  roundNumber: number;
  estimatePhase: string;
  bidYear: number;
  bidDueDate: string | null;
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
  | "estimatePhase"
  | "bidYear"
  | "bidDueDate"
  | "location"
  | "estimateLead"
  | "estimateValue"
  | "status"
  | "actions";

type ColDef = {
  key: ColKey;
  label: string;
  width: number;
  minWidth: number;
  align?: "left" | "right";
  sortable?: boolean;
  filter?: "text" | "values" | "none";
  getValue: (row: BidSheetRow) => string;
  getSortValue: (row: BidSheetRow) => string | number;
};

const COLS: ColDef[] = [
  {
    key: "jobNumber",
    label: "Job #",
    width: 110,
    minWidth: 72,
    filter: "text",
    getValue: (r) => r.jobNumber,
    getSortValue: (r) => r.jobNumber,
  },
  {
    key: "jobName",
    label: "Job Name",
    width: 260,
    minWidth: 140,
    filter: "text",
    getValue: (r) => r.jobName,
    getSortValue: (r) => r.jobName.toLowerCase(),
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
    key: "bidYear",
    label: "Bid Year",
    width: 88,
    minWidth: 64,
    filter: "values",
    getValue: (r) => String(r.bidYear),
    getSortValue: (r) => r.bidYear,
  },
  {
    key: "bidDueDate",
    label: "Bid Due",
    width: 110,
    minWidth: 80,
    filter: "text",
    getValue: (r) => r.bidDueDate ?? "",
    getSortValue: (r) => r.bidDueDate ?? "9999",
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
    key: "estimateLead",
    label: "Estimate Lead",
    width: 140,
    minWidth: 100,
    filter: "values",
    getValue: (r) => r.estimateLeadName ?? "",
    getSortValue: (r) => (r.estimateLeadName ?? "").toLowerCase(),
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

export function BidScheduleSheet({
  rows,
  canEdit,
  lists,
  groupBy = "none",
  sort = { field: "bidDueDate", dir: "asc" },
}: {
  rows: BidSheetRow[];
  canEdit: boolean;
  lists: Record<string, string[]>;
  groupBy?: BidScheduleGroupBy;
  sort?: BidScheduleSort;
}) {
  const storedWidths = useSyncExternalStore(
    subscribeColWidths,
    readColWidths,
    defaultColWidths,
  );
  const [draftWidths, setDraftWidths] = useState<Record<string, number> | null>(
    null,
  );
  const widths = draftWidths ?? storedWidths;
  const [colSort, setColSort] = useState<SortState>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [filterOpen, setFilterOpen] = useState<ColKey | null>(null);
  const resizing = useRef<{ key: ColKey; startX: number; startW: number } | null>(
    null,
  );

  const onResizeStart = (key: ColKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const col = COLS.find((c) => c.key === key)!;
    resizing.current = {
      key,
      startX: e.clientX,
      startW: widths[key] ?? col.width,
    };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = ev.clientX - resizing.current.startX;
      const min = COLS.find((c) => c.key === resizing.current!.key)!.minWidth;
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
      for (const col of COLS) {
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
  }, [rows, filters]);

  const sections = useMemo(() => {
    const built = buildBidScheduleSections(filtered, groupBy, sort);
    if (!colSort) return built;
    const col = COLS.find((c) => c.key === colSort.key);
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
    for (const col of COLS) {
      if (col.filter !== "values") continue;
      const set = new Set<string>();
      for (const row of rows) {
        const v = col.getValue(row);
        if (v) set.add(v);
      }
      map[col.key] = [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    return map;
  }, [rows]);

  const clearFilters = () => setFilters({});

  const actionWidth = canEdit ? 120 : 0;
  const totalWidth =
    COLS.reduce((sum, c) => sum + (widths[c.key] ?? c.width), 0) + actionWidth;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {filteredSorted.length} of {rows.length} estimate round
          {rows.length === 1 ? "" : "s"}
          {activeFilterCount > 0 ? ` · ${activeFilterCount} column filter${activeFilterCount === 1 ? "" : "s"}` : ""}
        </p>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={clearFilters}>
            <X className="size-3" /> Clear filters
          </Button>
        )}
      </div>

      <div className="overflow-auto rounded border border-border/70 bg-card">
        <table
          className="border-collapse text-[13px]"
          style={{ tableLayout: "fixed", width: totalWidth, minWidth: "100%" }}
        >
          <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
            <tr className="border-b">
              {COLS.map((col) => {
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
                  colSpan={COLS.length + (canEdit ? 1 : 0)}
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
                      colSpan={COLS.length + (canEdit ? 1 : 0)}
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
                            colSpan={COLS.length + (canEdit ? 1 : 0)}
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
                          canEdit={canEdit}
                          lists={lists}
                          widths={widths}
                          actionWidth={actionWidth}
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
  canEdit,
  lists,
  widths,
  actionWidth,
}: {
  row: BidSheetRow;
  canEdit: boolean;
  lists: Record<string, string[]>;
  widths: Record<string, number>;
  actionWidth: number;
}) {
  return (
    <tr className="border-b border-border/60 hover:bg-muted/35">
      <td
        className="overflow-hidden border-r border-border/40 px-2 py-1.5 font-mono text-xs"
        style={{ width: widths.jobNumber }}
      >
        <span className="flex items-center gap-1 truncate">
          {row.jobNumber}
          {!row.isLinked && (
            <Badge variant="warning" size="sm">
              <Unlink />
              unlinked
            </Badge>
          )}
        </span>
      </td>
      <td
        className="overflow-hidden border-r border-border/40 px-2 py-1.5"
        style={{ width: widths.jobName }}
      >
        <Link
          href={`/jobs/${row.jobId}`}
          className="block truncate font-medium hover:underline"
          title={row.jobName}
        >
          {row.jobName}
        </Link>
        <p className="truncate text-2xs text-muted-foreground">
          {row.preconDepartment}
          {row.marketSector ? ` · ${row.marketSector}` : ""} · Round{" "}
          {row.roundNumber}
        </p>
      </td>
      <td
        className="overflow-hidden truncate border-r border-border/40 px-2 py-1.5"
        style={{ width: widths.estimatePhase }}
        title={row.estimatePhase}
      >
        {row.estimatePhase}
      </td>
      <td
        className="overflow-hidden border-r border-border/40 px-2 py-1.5 tabular-nums"
        style={{ width: widths.bidYear }}
      >
        {row.bidYear}
      </td>
      <td
        className="overflow-hidden border-r border-border/40 px-2 py-1.5"
        style={{ width: widths.bidDueDate }}
      >
        {fmtDate(row.bidDueDate)}
      </td>
      <td
        className="overflow-hidden truncate border-r border-border/40 px-2 py-1.5"
        style={{ width: widths.location }}
      >
        {row.city ? `${row.city}, ${row.state}` : "—"}
      </td>
      <td
        className="overflow-hidden truncate border-r border-border/40 px-2 py-1.5"
        style={{ width: widths.estimateLead }}
      >
        {row.estimateLeadName ?? "—"}
      </td>
      <td
        className="overflow-hidden border-r border-border/40 px-2 py-1.5 text-right tabular-nums"
        style={{ width: widths.estimateValue }}
      >
        {fmtDollars(row.estimateValue, true)}
      </td>
      <td
        className="overflow-hidden border-r border-border/40 px-2 py-1.5"
        style={{ width: widths.status }}
      >
        <StatusMenu
          roundId={row.id}
          status={row.status}
          allowed={canEdit ? row.allowed : []}
        />
      </td>
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
