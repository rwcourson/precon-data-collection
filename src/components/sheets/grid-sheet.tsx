"use client";

import { Group, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addSheetColumn,
  addSheetRow,
  deleteSheetColumn,
  deleteSheetRow,
  reorderSheetColumns,
  updateSheetCell,
  updateSheetColumn,
} from "@/actions/sheets";
import { ExportActions } from "@/components/export-actions";
import {
  type ColumnFilters,
  DataGrid,
  type GridColumn,
  type GridRow,
  type SortState,
} from "@/components/sheets/data-grid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SheetColumn, SheetColumnType, SheetRow } from "@/db/schema";
import { SHEET_COLUMN_TYPES } from "@/lib/sheets";

/**
 * A standalone sheet: its own columns and rows, for the Smartsheet tabs that
 * were never pursuit data — a Precon Roster, monthly cost tracking. A Region
 * builds one without waiting on IT, and it exports like everything else.
 */
export function GridSheet({
  sheetId,
  columns,
  rows,
  canManage,
  canEdit,
}: {
  sheetId: number;
  columns: SheetColumn[];
  rows: SheetRow[];
  canManage: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sort, setSort] = useState<SortState>(null);
  const [gridFilters, setGridFilters] = useState<ColumnFilters>({});
  const [groupBy, setGroupBy] = useState("");
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [orderKeys, setOrderKeys] = useState<string[] | null>(null);

  const displayColumns = useMemo(() => {
    const keys = orderKeys ?? columns.map((c) => c.key);
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const ordered = keys
      .map((k) => byKey.get(k))
      .filter((c): c is SheetColumn => c != null);
    for (const c of columns) {
      if (!keys.includes(c.key)) ordered.push(c);
    }
    return ordered;
  }, [columns, orderKeys]);

  const gridColumns: GridColumn[] = useMemo(
    () =>
      displayColumns.map((c) => ({
        key: c.key,
        label: c.label,
        type: c.type,
        width: widths[c.key] ?? c.width,
        options: c.options ?? undefined,
        editable: canEdit,
      })),
    [displayColumns, widths, canEdit]
  );

  const gridRows: GridRow[] = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        cells: Object.fromEntries(
          displayColumns.map((c) => {
            const raw = r.values[c.key] ?? null;
            const numeric = ["number", "dollars"].includes(c.type);
            return [c.key, numeric && raw != null ? Number(raw) : raw];
          })
        ),
      })),
    [rows, displayColumns]
  );

  async function editCell(rowId: number, key: string, value: string) {
    try {
      await updateSheetCell(rowId, key, value);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that value");
    }
  }

  function newRow() {
    startTransition(async () => {
      try {
        await addSheetRow(sheetId);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add a row");
      }
    });
  }

  const exportUrl = (format: "xlsx" | "pdf") =>
    `/api/export/sheet?id=${sheetId}&format=${format}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canManage && <AddColumnDialog sheetId={sheetId} />}
        {canManage && columns.length > 0 && (
          <ManageColumnsDialog sheetId={sheetId} columns={columns} />
        )}
        <div className="flex items-center gap-1.5">
          <Group className="size-4 text-muted-foreground" />
          <Select
            items={[
              { value: "", label: "No grouping" },
              ...columns
                .filter((c) =>
                  ["text", "dropdown", "date", "contact"].includes(c.type)
                )
                .map((c) => ({ value: c.key, label: c.label })),
            ]}
            value={groupBy}
            onValueChange={(v) => setGroupBy(v ?? "")}
          >
            <SelectTrigger size="sm" className="h-8 w-44 text-[13px]">
              <SelectValue placeholder="No grouping" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No grouping</SelectItem>
              {columns
                .filter((c) =>
                  ["text", "dropdown", "date", "contact"].includes(c.type)
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
          {canEdit && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={newRow}
              disabled={pending}
            >
              <Plus className="size-4" /> Add row
            </Button>
          )}
        </div>
      </div>

      <DataGrid
        columns={gridColumns}
        rows={gridRows}
        sort={sort}
        onSortChange={setSort}
        filters={gridFilters}
        onFiltersChange={setGridFilters}
        groupBy={groupBy || null}
        widths={widths}
        onWidthChange={(key, width) =>
          setWidths((prev) => ({ ...prev, [key]: width }))
        }
        onColumnOrderChange={
          canManage
            ? (keys) => {
                setOrderKeys(keys);
                const ids = keys
                  .map((k) => columns.find((c) => c.key === k)?.id)
                  .filter((id): id is number => typeof id === "number");
                startTransition(async () => {
                  try {
                    await reorderSheetColumns(sheetId, ids);
                  } catch (e) {
                    toast.error(
                      e instanceof Error
                        ? e.message
                        : "Could not reorder columns"
                    );
                  }
                });
              }
            : undefined
        }
        onEditCell={canEdit ? editCell : undefined}
        emptyMessage="This sheet is empty — add a row to start."
        rowActions={
          canEdit
            ? (row) => (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete row"
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await deleteSheetRow(row.id);
                        router.refresh();
                      } catch (e) {
                        toast.error(
                          e instanceof Error
                            ? e.message
                            : "Could not delete the row"
                        );
                      }
                    })
                  }
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              )
            : undefined
        }
      />
    </div>
  );
}

function AddColumnDialog({ sheetId }: { sheetId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<SheetColumnType>("text");
  const [options, setOptions] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        await addSheetColumn(sheetId, {
          label,
          type,
          options: options
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        });
        setOpen(false);
        setLabel("");
        setOptions("");
        setType("text");
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not add the column"
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="gap-1.5" />}>
        <Plus className="size-4" /> Add column
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add column</DialogTitle>
          <DialogDescription>
            Columns belong to this sheet only. Data that every Region should
            collect belongs in Admin · Data Columns instead.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select
              items={SHEET_COLUMN_TYPES}
              value={type}
              onValueChange={(v) => setType((v as SheetColumnType) ?? "text")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHEET_COLUMN_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {type === "dropdown" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Values (comma separated)</Label>
              <Input
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="Charlotte, Raleigh, Greenville"
              />
            </div>
          )}
        </div>
        <Button
          onClick={submit}
          disabled={pending || !label.trim()}
          className="w-full"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Add column
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function ManageColumnsDialog({
  sheetId,
  columns,
}: {
  sheetId: number;
  columns: SheetColumn[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not update the column"
        );
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="default" />}>
        Manage columns
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Columns</DialogTitle>
          <DialogDescription>
            Rename or remove a column. Removing one deletes the values stored
            under it on every row of this sheet.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {columns.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <Input
                defaultValue={c.label}
                className="h-8"
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== c.label)
                    run(() =>
                      updateSheetColumn(c.id, { label: e.target.value })
                    );
                }}
              />
              <span className="w-16 shrink-0 text-2xs text-muted-foreground">
                {c.type}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${c.label}`}
                disabled={pending || columns.length <= 1}
                onClick={() => run(() => deleteSheetColumn(c.id))}
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
        <p className="text-2xs text-muted-foreground">
          Sheet id {sheetId} · {columns.length} column
          {columns.length === 1 ? "" : "s"}
        </p>
      </DialogContent>
    </Dialog>
  );
}
