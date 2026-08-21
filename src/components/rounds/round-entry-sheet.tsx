"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { updateRoundCell } from "@/actions/post-bid";
import {
  type ColumnFilters,
  DataGrid,
  type GridColumn,
  type GridRow,
  type SortState,
} from "@/components/sheets/data-grid";
import { Button } from "@/components/ui/button";
import {
  type EntrySheetColumn,
  filterSheetColumnsBySection,
} from "@/lib/entry-view";

/**
 * Spreadsheet alternative to the grouped estimate-round form. Same fields,
 * same `updateRoundCell` write path as Bid Schedule and pursuit views.
 */
export function RoundEntrySheet({
  columns: initialColumns,
  rows: initialRows,
  canEdit,
  expectedUpdatedAtById,
  showOpen = false,
  emptyMessage = "Nothing to show on this sheet.",
  section = "all",
}: {
  columns: EntrySheetColumn[];
  rows: {
    id: number;
    cells: Record<string, string | number | null>;
    locked?: boolean;
    lockReason?: string;
  }[];
  canEdit: boolean;
  expectedUpdatedAtById?: Record<number, string>;
  showOpen?: boolean;
  emptyMessage?: string;
  /** Query `section` slug; hides columns outside that field group. */
  section?: string;
}) {
  const router = useRouter();
  const [columns, setColumns] = useState(initialColumns);
  const [rows, setRows] = useState(initialRows);
  const [sort, setSort] = useState<SortState>(null);
  const [filters, setFilters] = useState<ColumnFilters>({});
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      initialColumns.map((column) => [column.key, column.width])
    )
  );

  const visibleColumns = useMemo(
    () => filterSheetColumnsBySection(columns, section, showOpen),
    [columns, section, showOpen]
  );

  const gridColumns: GridColumn[] = useMemo(
    () =>
      visibleColumns.map((column) => ({
        ...column,
        width: widths[column.key] ?? column.width,
        render:
          column.key === "jobName" && showOpen
            ? (row: GridRow) => (
                <Link
                  href={`/rounds/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {String(row.cells.jobName ?? "—")}
                </Link>
              )
            : undefined,
      })),
    [visibleColumns, showOpen, widths]
  );

  async function editCell(rowId: number, key: string, value: string) {
    try {
      const result = await updateRoundCell(
        rowId,
        key,
        value,
        expectedUpdatedAtById?.[rowId]
      );
      if ("pendingApproval" in result && result.pendingApproval) {
        toast.success("Change sent to the RPD for approval");
      } else {
        setRows((prev) =>
          prev.map((row) =>
            row.id === rowId
              ? { ...row, cells: { ...row.cells, [key]: value } }
              : row
          )
        );
        toast.success("Saved");
      }
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `${error.message} Refresh and try again if someone else saved first.`
          : "Could not save that value"
      );
    }
  }

  return (
    <DataGrid
      columns={gridColumns}
      rows={rows}
      sort={sort}
      onSortChange={setSort}
      filters={filters}
      onFiltersChange={setFilters}
      widths={widths}
      onWidthChange={(key, width) =>
        setWidths((prev) => ({ ...prev, [key]: width }))
      }
      onColumnOrderChange={(keys) => {
        setColumns((prev) => {
          const byKey = new Map(prev.map((column) => [column.key, column]));
          const nextVisible = keys
            .map((key) => byKey.get(key))
            .filter((column): column is EntrySheetColumn => column != null);
          const visibleSet = new Set(nextVisible.map((column) => column.key));
          let index = 0;
          return prev.map((column) =>
            visibleSet.has(column.key) ? nextVisible[index++]! : column
          );
        });
      }}
      onEditCell={canEdit ? editCell : undefined}
      unit="record"
      emptyMessage={emptyMessage}
      rowActions={
        showOpen
          ? (row) => (
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                nativeButton={false}
                render={<Link href={`/rounds/${row.id}`} />}
              >
                Open
              </Button>
            )
          : undefined
      }
    />
  );
}
