"use client";

import {
  Check,
  Columns3,
  Filter,
  Group,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateRoundCell } from "@/actions/post-bid";
import {
  loadSheetRows,
  type SheetGridColumn,
  saveSheetView,
} from "@/actions/sheets";
import { ExportActions } from "@/components/export-actions";
import {
  type ColumnFilters,
  DataGrid,
  type GridColumn,
  type GridRow,
  type SortState,
} from "@/components/sheets/data-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SheetFilter, SheetViewConfig } from "@/db/schema";
import type { ReportFieldDef } from "@/lib/report-engine";
import { FILTER_OPS } from "@/lib/sheets";

/**
 * A pursuit view: the Smartsheet grid experience over live records. Columns,
 * filters, sorting and grouping are all editable in place, and "Save layout"
 * writes them back to the sheet so the next person opens the same view.
 */
export function ViewSheet({
  sheetId,
  initialConfig,
  initialColumns,
  initialRows,
  catalog,
  canManage,
}: {
  sheetId: number;
  initialConfig: SheetViewConfig;
  initialColumns: SheetGridColumn[];
  initialRows: {
    id: number;
    cells: Record<string, string | number | null>;
    locked: boolean;
    lockReason?: string;
    status: string;
  }[];
  catalog: ReportFieldDef[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const [columnKeys, setColumnKeys] = useState<string[]>(initialConfig.columns);
  const [filters, setFilters] = useState<SheetFilter[]>(initialConfig.filters);
  const [groupBy, setGroupBy] = useState<string>(
    initialConfig.groupBy[0] ?? ""
  );
  const [sort, setSort] = useState<SortState>(
    initialConfig.sortBy[0]
      ? { key: initialConfig.sortBy[0].field, dir: initialConfig.sortBy[0].dir }
      : null
  );
  const [widths, setWidths] = useState<Record<string, number>>(
    initialConfig.widths ?? {}
  );
  const [gridFilters, setGridFilters] = useState<ColumnFilters>({});

  const [columns, setColumns] = useState(initialColumns);
  const [rows, setRows] = useState(initialRows);
  const [dirty, setDirty] = useState(false);

  // Column and filter changes need the server: the payload only carries the
  // columns currently on screen, which is what keeps a 1,000-row sheet fast.
  // Adding/removing columns or changing filters needs the server. Reordering
  // does not — the payload is the same records in a different column sequence.
  const nextKey = JSON.stringify({ columns: [...columnKeys].sort(), filters });
  const loadedKey = useRef(nextKey);

  useEffect(() => {
    if (loadedKey.current === nextKey) return;
    loadedKey.current = nextKey;
    startTransition(async () => {
      try {
        const data = await loadSheetRows(sheetId, columnKeys, filters);
        setColumns(data.columns);
        setRows(data.rows);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not refresh the sheet"
        );
      }
    });
  }, [nextKey, sheetId, columnKeys, filters]);

  const gridColumns: GridColumn[] = useMemo(
    () =>
      columns.map((c) => ({
        key: c.key,
        label: c.label,
        type: c.type,
        width: widths[c.key] ?? c.width,
        options: c.options,
        editable: c.editable,
        render:
          c.key === "jobName"
            ? undefined
            : c.key === "status"
              ? (row: GridRow) => (
                  <Badge variant="outline" size="sm">
                    {String(row.cells.status ?? "—")}
                  </Badge>
                )
              : undefined,
      })),
    [columns, widths]
  );

  const gridRows: GridRow[] = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        cells: r.cells,
        locked: r.locked,
        lockReason: r.lockReason,
      })),
    [rows]
  );

  async function editCell(rowId: number, key: string, value: string) {
    try {
      await updateRoundCell(rowId, key, value);
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId ? { ...r, cells: { ...r.cells, [key]: value } } : r
        )
      );
      toast.success("Saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that value");
    }
  }

  function saveLayout() {
    setSaving(true);
    const config: SheetViewConfig = {
      columns: columnKeys,
      filters,
      sortBy: sort ? [{ field: sort.key, dir: sort.dir }] : [],
      groupBy: groupBy ? [groupBy] : [],
      widths,
    };
    startTransition(async () => {
      try {
        await saveSheetView(sheetId, config);
        setDirty(false);
        toast.success("Layout saved — everyone opening this sheet sees it.");
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not save the layout"
        );
      } finally {
        setSaving(false);
      }
    });
  }

  const exportUrl = (format: "xlsx" | "pdf") =>
    `/api/export/sheet?id=${sheetId}&format=${format}&columns=${encodeURIComponent(
      columnKeys.join(",")
    )}&filters=${encodeURIComponent(JSON.stringify(filters))}`;

  const markDirty = () => setDirty(true);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ColumnPicker
          catalog={catalog}
          selected={columnKeys}
          onChange={(next) => {
            setColumnKeys(next);
            markDirty();
          }}
        />
        <FilterBuilder
          catalog={catalog}
          filters={filters}
          onChange={(next) => {
            setFilters(next);
            markDirty();
          }}
        />
        <div className="flex items-center gap-1.5">
          <Group className="size-4 text-muted-foreground" />
          <Select
            items={[
              { value: "", label: "No grouping" },
              ...columns
                .filter(
                  (c) => !["metric", "dollars", "number"].includes(c.type)
                )
                .map((c) => ({ value: c.key, label: c.label })),
            ]}
            value={groupBy}
            onValueChange={(v) => {
              setGroupBy(v ?? "");
              markDirty();
            }}
          >
            <SelectTrigger size="sm" className="w-44 text-sm">
              <SelectValue placeholder="No grouping" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No grouping</SelectItem>
              {columns
                .filter(
                  (c) => !["metric", "dollars", "number"].includes(c.type)
                )
                .map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {pending && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          <ExportActions
            excelHref={exportUrl("xlsx")}
            pdfHref={exportUrl("pdf")}
          />
          {canManage && (
            <Button
              size="sm"
              onClick={saveLayout}
              disabled={saving || !dirty}
              className="gap-1.5"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {dirty ? "Save layout" : "Layout saved"}
            </Button>
          )}
        </div>
      </div>

      <DataGrid
        columns={gridColumns}
        rows={gridRows}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          markDirty();
        }}
        filters={gridFilters}
        onFiltersChange={setGridFilters}
        groupBy={groupBy || null}
        widths={widths}
        onWidthChange={(key, width) => {
          setWidths((prev) => ({ ...prev, [key]: width }));
          markDirty();
        }}
        onColumnOrderChange={(keys) => {
          setColumnKeys(keys);
          setColumns((prev) => {
            const byKey = new Map(prev.map((c) => [c.key, c]));
            return keys
              .map((k) => byKey.get(k))
              .filter((c): c is (typeof prev)[number] => c != null);
          });
          markDirty();
        }}
        onEditCell={editCell}
        unit="record"
        emptyMessage="No records match this sheet's filters."
        rowActions={(row) => (
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            nativeButton={false}
            render={<Link href={`/rounds/${row.id}`} />}
          >
            Open
          </Button>
        )}
      />
    </div>
  );
}

function ColumnPicker({
  catalog,
  selected,
  onChange,
}: {
  catalog: ReportFieldDef[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, ReportFieldDef[]>();
    for (const f of catalog) {
      if (
        q &&
        !f.label.toLowerCase().includes(q) &&
        !f.category.toLowerCase().includes(q)
      )
        continue;
      const bucket = map.get(f.category);
      if (bucket) bucket.push(f);
      else map.set(f.category, [f]);
    }
    return [...map.entries()];
  }, [catalog, query]);

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" className="gap-1.5" />}>
        <Columns3 className="size-4" />
        Columns
        <Badge variant="secondary" size="sm" className="ml-0.5">
          {selected.length}
        </Badge>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-2 p-3">
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a column…"
            className="pl-8"
          />
        </div>
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {grouped.map(([category, fields]) => (
            <div key={category} className="space-y-1">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {category}
              </p>
              {fields.map((f) => {
                const checked = selected.includes(f.key);
                return (
                  <label
                    key={f.key}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        onChange(
                          v
                            ? [...selected, f.key]
                            : selected.filter((k) => k !== f.key)
                        )
                      }
                    />
                    <span className="truncate">{f.label}</span>
                  </label>
                );
              })}
            </div>
          ))}
          {grouped.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No column matches.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilterBuilder({
  catalog,
  filters,
  onChange,
}: {
  catalog: ReportFieldDef[];
  filters: SheetFilter[];
  onChange: (next: SheetFilter[]) => void;
}) {
  const [draft, setDraft] = useState<SheetFilter>({
    field: "",
    op: "eq",
    value: "",
  });

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" className="gap-1.5" />}>
        <Filter className="size-4" />
        Filters
        {filters.length > 0 && (
          <Badge variant="secondary" size="sm" className="ml-0.5">
            {filters.length}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 gap-3 p-3">
        <p className="text-xs font-medium">Sheet filters</p>
        <p className="text-xs text-muted-foreground">
          These are saved with the sheet — they define which records belong to
          it. Column filters in the header stay local to you.
        </p>

        {filters.length > 0 && (
          <div className="space-y-1">
            {filters.map((f, i) => (
              <div
                key={`${f.field}-${i}`}
                className="flex items-center gap-2 rounded border bg-muted/40 px-2 py-1 text-xs"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">
                    {catalog.find((c) => c.key === f.field)?.label ?? f.field}
                  </span>{" "}
                  {FILTER_OPS.find((o) => o.value === f.op)?.label ?? f.op}{" "}
                  {f.op !== "blank" && f.op !== "notblank" && (
                    <span className="font-mono">{f.value}</span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    onChange(filters.filter((_, idx) => idx !== i))
                  }
                  aria-label="Remove filter"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 rounded border border-dashed p-2">
          <div className="space-y-1">
            <Label className="text-xs">Column</Label>
            <Select
              items={catalog.map((c) => ({ value: c.key, label: c.label }))}
              value={draft.field}
              onValueChange={(v) => setDraft({ ...draft, field: v ?? "" })}
            >
              <SelectTrigger size="sm" className="w-full text-sm">
                <SelectValue placeholder="Choose a column…" />
              </SelectTrigger>
              <SelectContent>
                {catalog.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <Select
              items={FILTER_OPS}
              value={draft.op}
              onValueChange={(v) => setDraft({ ...draft, op: v ?? "eq" })}
            >
              <SelectTrigger size="sm" className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={draft.value}
              disabled={draft.op === "blank" || draft.op === "notblank"}
              placeholder={draft.op === "in" ? "Active, Upcoming" : "Value"}
              onChange={(e) => setDraft({ ...draft, value: e.target.value })}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-1.5"
            disabled={!draft.field}
            onClick={() => {
              onChange([...filters, draft]);
              setDraft({ field: "", op: "eq", value: "" });
            }}
          >
            <Plus className="size-3.5" /> Add filter
          </Button>
        </div>

        {filters.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="w-full gap-1.5 text-xs"
            onClick={() => onChange([])}
          >
            <Check className="size-3.5" /> Clear all sheet filters
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
