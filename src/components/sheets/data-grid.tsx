"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Filter,
  Lock,
  X,
} from "lucide-react";
import {
  type DragEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  CellEditor,
  formatCell,
  isNumericType,
} from "@/components/sheets/cell-editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  beginColumnResize,
  COLUMN_RESIZE_HANDLE_CLASS,
  dropPlaceForPoint,
  moveColumnKey,
} from "@/lib/sheet-grid";
import { cn } from "@/lib/utils";

/**
 * The grid behind both kinds of sheet. Column resize, click-to-sort, per-column
 * filters, row grouping with subtotals, and type-aware cell editing — the parts
 * of a Smartsheet grid people actually use, over records that live in one place.
 */

export type GridColumn = {
  key: string;
  label: string;
  type: string;
  width: number;
  options?: string[];
  editable?: boolean;
  /** Replaces the default cell rendering (links, badges, status menus). */
  render?: (row: GridRow) => ReactNode;
};

export type GridRow = {
  id: number;
  cells: Record<string, string | number | null>;
  /** Blocks editing on this row and shows the lock affordance. */
  locked?: boolean;
  lockReason?: string;
};

export type SortState = { key: string; dir: "asc" | "desc" } | null;
export type ColumnFilters = Record<
  string,
  { text?: string; values?: string[] }
>;

export function DataGrid({
  columns,
  rows,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  groupBy,
  widths,
  onWidthChange,
  onColumnOrderChange,
  onEditCell,
  rowActions,
  emptyMessage = "Nothing here yet.",
  unit = "row",
}: {
  columns: GridColumn[];
  rows: GridRow[];
  sort: SortState;
  onSortChange: (next: SortState) => void;
  filters: ColumnFilters;
  onFiltersChange: (next: ColumnFilters) => void;
  groupBy?: string | null;
  widths: Record<string, number>;
  onWidthChange: (key: string, width: number) => void;
  onColumnOrderChange?: (keys: string[]) => void;
  onEditCell?: (rowId: number, key: string, value: string) => Promise<void>;
  rowActions?: (row: GridRow) => ReactNode;
  emptyMessage?: string;
  unit?: string;
}) {
  const [filterOpen, setFilterOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ rowId: number; key: string } | null>(
    null
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState<{
    key: string;
    place: "before" | "after";
  } | null>(null);

  const widthOf = useCallback(
    (col: GridColumn) => widths[col.key] ?? col.width,
    [widths]
  );

  const onResizeStart = (col: GridColumn, e: PointerEvent<HTMLElement>) => {
    beginColumnResize({
      event: e,
      startWidth: widthOf(col),
      minWidth: 64,
      onWidth: (width) => onWidthChange(col.key, width),
    });
  };

  const onHeaderDragStart = (key: string, e: DragEvent<HTMLElement>) => {
    if (!onColumnOrderChange) return;
    if ((e.target as HTMLElement).closest('[role="separator"]')) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", key);
    e.dataTransfer.effectAllowed = "move";
  };

  const onHeaderDragOver = (key: string, e: DragEvent<HTMLElement>) => {
    if (!onColumnOrderChange) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const place = dropPlaceForPoint(
      e.clientX,
      e.currentTarget.getBoundingClientRect()
    );
    setDragOver((prev) =>
      prev?.key === key && prev.place === place ? prev : { key, place }
    );
  };

  const onHeaderDrop = (key: string, e: DragEvent<HTMLElement>) => {
    if (!onColumnOrderChange) return;
    e.preventDefault();
    const from = e.dataTransfer.getData("text/plain");
    const place = dropPlaceForPoint(
      e.clientX,
      e.currentTarget.getBoundingClientRect()
    );
    setDragOver(null);
    if (!from) return;
    const next = moveColumnKey(
      columns.map((c) => c.key),
      from,
      key,
      place
    );
    if (next.some((k, i) => k !== columns[i]?.key)) onColumnOrderChange(next);
  };

  const display = useMemo(() => {
    let out = rows.filter((row) =>
      columns.every((col) => {
        const f = filters[col.key];
        if (!f) return true;
        const text = formatCell(col.type, row.cells[col.key]);
        if (
          f.text?.trim() &&
          !text.toLowerCase().includes(f.text.trim().toLowerCase())
        )
          return false;
        if (f.values?.length && !f.values.includes(text)) return false;
        return true;
      })
    );

    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      out = [...out].sort((a, b) => {
        const av = a.cells[sort.key];
        const bv = b.cells[sort.key];
        let cmp: number;
        if (av == null && bv == null) cmp = 0;
        else if (av == null) cmp = 1;
        else if (bv == null) cmp = -1;
        else if (typeof av === "number" && typeof bv === "number")
          cmp = av - bv;
        else if (col && isNumericType(col.type)) cmp = Number(av) - Number(bv);
        else
          cmp = String(av).localeCompare(String(bv), undefined, {
            numeric: true,
          });
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, columns, filters, sort]);

  const groups = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, GridRow[]>();
    for (const row of display) {
      const col = columns.find((c) => c.key === groupBy);
      const key =
        formatCell(col?.type ?? "text", row.cells[groupBy]) || "(blank)";
      const bucket = map.get(key);
      if (bucket) bucket.push(row);
      else map.set(key, [row]);
    }
    return [...map.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true })
    );
  }, [display, groupBy, columns]);

  const uniqueValues = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of columns) {
      if (col.type === "text" || col.type === "metric") continue;
      const set = new Set<string>();
      for (const row of rows) {
        const v = formatCell(col.type, row.cells[col.key]);
        if (v && v !== "—") set.add(v);
        if (set.size > 200) break;
      }
      if (set.size > 0 && set.size <= 200) {
        map[col.key] = [...set].sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true })
        );
      }
    }
    return map;
  }, [columns, rows]);

  const activeFilters = Object.values(filters).filter(
    (f) => f?.text?.trim() || f?.values?.length
  ).length;

  const actionWidth = rowActions ? 96 : 0;
  const totalWidth =
    columns.reduce((sum, c) => sum + widthOf(c), 0) + actionWidth;
  const colSpan = columns.length + (rowActions ? 1 : 0);

  const renderRow = (row: GridRow) => (
    <tr key={row.id} className="border-b border-border/60 hover:bg-muted/35">
      {columns.map((col) => {
        const isEditing = editing?.rowId === row.id && editing.key === col.key;
        const canEdit = Boolean(onEditCell) && col.editable && !row.locked;
        return (
          <td
            key={col.key}
            className={cn(
              "overflow-hidden border-r border-border/40 px-2 py-1.5 align-top last:border-r-0",
              isNumericType(col.type) && "text-right tabular-nums",
              canEdit && "cursor-text hover:bg-primary/5"
            )}
            style={{ width: widthOf(col) }}
            onDoubleClick={() =>
              canEdit && setEditing({ rowId: row.id, key: col.key })
            }
            title={row.locked && col.editable ? row.lockReason : undefined}
          >
            {isEditing && onEditCell ? (
              <CellEditor
                type={col.type}
                options={col.options}
                value={row.cells[col.key]}
                onCancel={() => setEditing(null)}
                onCommit={async (next) => {
                  setEditing(null);
                  await onEditCell(row.id, col.key, next);
                }}
              />
            ) : col.render ? (
              col.render(row)
            ) : (
              <span className="block truncate">
                {formatCell(col.type, row.cells[col.key])}
              </span>
            )}
          </td>
        );
      })}
      {rowActions && (
        <td className="px-1 py-1" style={{ width: actionWidth }}>
          {rowActions(row)}
        </td>
      )}
    </tr>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {display.length.toLocaleString()} of {rows.length.toLocaleString()}{" "}
          {unit}
          {rows.length === 1 ? "" : "s"}
          {activeFilters > 0
            ? ` · ${activeFilters} column filter${activeFilters === 1 ? "" : "s"}`
            : ""}
          {onEditCell ? " · double-click a cell to edit" : ""}
        </p>
        {activeFilters > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => onFiltersChange({})}
          >
            <X className="size-3" /> Clear filters
          </Button>
        )}
      </div>

      <div className="max-h-[70vh] overflow-auto rounded border border-border/70 bg-card">
        <table
          className="border-collapse text-[13px]"
          style={{ tableLayout: "fixed", width: totalWidth }}
        >
          <colgroup>
            {columns.map((col) => (
              <col key={col.key} style={{ width: widthOf(col) }} />
            ))}
            {rowActions ? <col style={{ width: actionWidth }} /> : null}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
            <tr className="border-b">
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                const hasFilter =
                  Boolean(filters[col.key]?.text?.trim()) ||
                  Boolean(filters[col.key]?.values?.length);
                return (
                  <th
                    key={col.key}
                    draggable={Boolean(onColumnOrderChange)}
                    onDragStart={(e) => onHeaderDragStart(col.key, e)}
                    onDragOver={(e) => onHeaderDragOver(col.key, e)}
                    onDrop={(e) => onHeaderDrop(col.key, e)}
                    onDragEnd={() => setDragOver(null)}
                    className={cn(
                      "relative h-9 select-none border-r border-border/50 px-1.5 text-left align-middle text-2xs font-medium tracking-wide text-muted-foreground last:border-r-0",
                      onColumnOrderChange &&
                        "cursor-grab active:cursor-grabbing",
                      dragOver?.key === col.key &&
                        dragOver.place === "before" &&
                        "shadow-[-2px_0_0_0_var(--color-primary)]",
                      dragOver?.key === col.key &&
                        dragOver.place === "after" &&
                        "shadow-[2px_0_0_0_var(--color-primary)]"
                    )}
                    style={{ width: widthOf(col) }}
                  >
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left outline-none hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
                          isNumericType(col.type) && "justify-end",
                          isSorted && "text-foreground"
                        )}
                        onClick={() =>
                          onSortChange(
                            !sort || sort.key !== col.key
                              ? { key: col.key, dir: "asc" }
                              : sort.dir === "asc"
                                ? { key: col.key, dir: "desc" }
                                : null
                          )
                        }
                        title={col.label}
                      >
                        <span className="truncate">{col.label}</span>
                        {isSorted ? (
                          sort!.dir === "asc" ? (
                            <ArrowUp className="size-3 shrink-0" />
                          ) : (
                            <ArrowDown className="size-3 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 shrink-0 opacity-30" />
                        )}
                      </button>
                      <Popover
                        open={filterOpen === col.key}
                        onOpenChange={(open) =>
                          setFilterOpen(open ? col.key : null)
                        }
                      >
                        <PopoverTrigger
                          render={
                            <button
                              type="button"
                              className={cn(
                                "rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                                hasFilter && "bg-primary/10 text-primary"
                              )}
                              aria-label={`Filter ${col.label}`}
                            />
                          }
                        >
                          <Filter className="size-3" />
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          className="w-64 gap-2 p-3"
                        >
                          <FilterPanel
                            label={col.label}
                            filter={filters[col.key]}
                            options={uniqueValues[col.key] ?? []}
                            onChange={(next) =>
                              onFiltersChange({ ...filters, [col.key]: next })
                            }
                            onClear={() => {
                              const copy = { ...filters };
                              delete copy[col.key];
                              onFiltersChange(copy);
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div
                      aria-hidden="true"
                      onPointerDown={(e) => onResizeStart(col, e)}
                      onMouseDown={(e) => e.stopPropagation()}
                      draggable={false}
                      className={COLUMN_RESIZE_HANDLE_CLASS}
                    />
                  </th>
                );
              })}
              {rowActions && (
                <th style={{ width: actionWidth }} className="h-9" />
              )}
            </tr>
          </thead>
          <tbody>
            {display.length === 0 && (
              <tr>
                <td
                  colSpan={colSpan}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}

            {groups
              ? groups.map(([key, groupRows]) => {
                  const isCollapsed = collapsed.has(key);
                  return (
                    <GroupSection
                      key={key}
                      label={key}
                      rows={groupRows}
                      columns={columns}
                      widthOf={widthOf}
                      colSpan={colSpan}
                      collapsed={isCollapsed}
                      onToggle={() =>
                        setCollapsed((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        })
                      }
                      renderRow={renderRow}
                    />
                  );
                })
              : display.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupSection({
  label,
  rows,
  columns,
  widthOf,
  colSpan,
  collapsed,
  onToggle,
  renderRow,
}: {
  label: string;
  rows: GridRow[];
  columns: GridColumn[];
  widthOf: (col: GridColumn) => number;
  colSpan: number;
  collapsed: boolean;
  onToggle: () => void;
  renderRow: (row: GridRow) => ReactNode;
}) {
  const totals = columns.map((col) => {
    if (!isNumericType(col.type)) return null;
    const nums = rows
      .map((r) => r.cells[col.key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (nums.length === 0) return null;
    return nums.reduce((s, n) => s + n, 0);
  });

  return (
    <>
      <tr className="border-b bg-muted/60">
        <td
          colSpan={1}
          className="px-2 py-1.5"
          style={{ width: widthOf(columns[0]) }}
        >
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1 rounded-sm text-xs font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {collapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
            <span className="truncate">{label}</span>
            <span className="font-normal text-muted-foreground">
              ({rows.length})
            </span>
          </button>
        </td>
        {columns.slice(1).map((col, i) => (
          <td
            key={col.key}
            className="px-2 py-1.5 text-right text-2xs font-medium tabular-nums text-muted-foreground"
            style={{ width: widthOf(col) }}
          >
            {totals[i + 1] != null
              ? formatCell(
                  col.type === "metric" ? "number" : col.type,
                  totals[i + 1]
                )
              : ""}
          </td>
        ))}
        {colSpan > columns.length && <td />}
      </tr>
      {!collapsed && rows.map(renderRow)}
    </>
  );
}

function FilterPanel({
  label,
  filter,
  options,
  onChange,
  onClear,
}: {
  label: string;
  filter?: { text?: string; values?: string[] };
  options: string[];
  onChange: (next: { text?: string; values?: string[] }) => void;
  onClear: () => void;
}) {
  const selected = new Set(filter?.values ?? []);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="truncate text-xs font-medium">Filter · {label}</p>
        <Button
          variant="ghost"
          size="xs"
          className="-mr-1 text-2xs text-muted-foreground"
          onClick={onClear}
        >
          Clear
        </Button>
      </div>
      <Input
        value={filter?.text ?? ""}
        onChange={(e) => onChange({ ...filter, text: e.target.value })}
        placeholder="Contains…"
        autoFocus
      />
      {options.length > 0 && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-border/60 p-1.5">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted"
            >
              <Checkbox
                checked={selected.has(opt)}
                onCheckedChange={(v) => {
                  const next = new Set(selected);
                  if (v) next.add(opt);
                  else next.delete(opt);
                  onChange({ ...filter, values: [...next] });
                }}
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export { Lock as GridLockIcon };
