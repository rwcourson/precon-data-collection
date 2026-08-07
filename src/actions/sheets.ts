"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, max } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  sheetColumns,
  sheetPins,
  sheetRows,
  sheets,
  type SheetColumnType,
  type SheetViewConfig,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { getFlatDataset } from "@/lib/export-helpers";
import { FIELD_MAP, ROUND_COLUMN_KEYS } from "@/lib/fields";
import { getReferenceValues } from "@/lib/queries";
import { STATUS_LABELS } from "@/lib/permissions";
import {
  buildImportedSheet,
  parseDelimited,
  type ImportTable,
} from "@/lib/sheet-import";
import {
  BLANK_VIEW_CONFIG,
  canCreateSheet,
  canEditRows,
  canManageSheet,
  columnKeyFromLabel,
  duplicateName,
  matchesFilter,
} from "@/lib/sheets";
import { getWorkspace } from "@/lib/workspace-server";
import { visibleInWorkspace } from "@/lib/sheets-server";

/**
 * Sheet management. Every mutation re-checks who owns the sheet's workspace,
 * because "a Region manages its own sheets without IT" only holds if one
 * Region cannot quietly edit another's.
 */

async function loadManageable(id: number) {
  const user = await getCurrentUser();
  const [sheet] = await db.select().from(sheets).where(eq(sheets.id, id));
  if (!sheet) throw new Error("Sheet not found");
  const workspace = await getWorkspace();
  if (!visibleInWorkspace(sheet, workspace))
    throw new Error("That sheet belongs to another Region's workspace.");
  if (!canManageSheet(user, sheet))
    throw new Error(
      sheet.region == null
        ? "Corporate sheets are managed by the Corporate Precon Admin."
        : "Only the sheet owner, the Region's RPD, or a Corporate Admin can change this sheet.",
    );
  return { user, sheet };
}

async function loadEditable(id: number) {
  const user = await getCurrentUser();
  const [sheet] = await db.select().from(sheets).where(eq(sheets.id, id));
  if (!sheet) throw new Error("Sheet not found");
  const workspace = await getWorkspace();
  if (!visibleInWorkspace(sheet, workspace))
    throw new Error("That sheet belongs to another Region's workspace.");
  if (!canEditRows(user)) throw new Error("Your role has read-only access to sheets.");
  return { user, sheet };
}

const touch = (id: number) => {
  revalidatePath("/sheets");
  revalidatePath(`/sheets/${id}`);
};

export type CreateSheetInput = {
  kind: "view" | "grid";
  name: string;
  folder: string;
  description?: string;
  /** Omitted means the active workspace; Corporate creates shared sheets. */
  region?: string | null;
  /** Seeds a new view from an existing one. */
  copyFromId?: number;
};

export async function createSheet(input: CreateSheetInput): Promise<number> {
  const user = await getCurrentUser();
  const workspace = await getWorkspace();
  const region = input.region !== undefined ? input.region : workspace.region;

  if (!canCreateSheet(user, region))
    throw new Error("Your role cannot create sheets in this workspace.");
  const name = input.name.trim();
  if (!name) throw new Error("Give the sheet a name.");
  const folder = input.folder.trim() || "General";

  let config: SheetViewConfig | null = input.kind === "view" ? BLANK_VIEW_CONFIG : null;
  if (input.copyFromId) {
    const [source] = await db.select().from(sheets).where(eq(sheets.id, input.copyFromId));
    if (source?.config) config = source.config;
  }

  const [created] = await db
    .insert(sheets)
    .values({
      kind: input.kind,
      name,
      description: input.description?.trim() || null,
      region,
      folder,
      config,
      ownerId: user.id,
    })
    .returning({ id: sheets.id });

  // A brand new grid is unusable without a column, so give it a first one.
  if (input.kind === "grid") {
    await db.insert(sheetColumns).values({
      sheetId: created.id,
      key: "name",
      label: "Name",
      type: "text",
      width: 220,
      sortOrder: 0,
    });
  }

  await db.insert(auditLog).values({
    entity: "sheet",
    entityId: created.id,
    action: "sheet_created",
    field: name,
    newValue: `${input.kind} in ${region ?? "Corporate"} / ${folder}`,
    userId: user.id,
  });

  revalidatePath("/sheets");
  return created.id;
}

export type ImportSheetResult = {
  id: number;
  columns: number;
  rows: number;
  /** Rows past the cap, reported rather than dropped in silence. */
  skipped: number;
};

/**
 * Creates a standalone sheet from an uploaded spreadsheet. This is the path
 * every non-pursuit sheet in the Smartsheet workspace originally took, so
 * without it a Region would have to retype a roster or a year of cost tracking
 * to get it across.
 */
export async function createSheetFromUpload(form: FormData): Promise<ImportSheetResult> {
  const user = await getCurrentUser();
  const workspace = await getWorkspace();
  const region = workspace.region;
  if (!canCreateSheet(user, region))
    throw new Error("Your role cannot create sheets in this workspace.");

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    throw new Error("Choose a .csv, .tsv or .xlsx file to import.");
  if (file.size > 15_000_000) throw new Error("That file is larger than 15 MB.");

  const table = /\.xlsx?$/i.test(file.name)
    ? await readWorkbookTable(await file.arrayBuffer())
    : parseDelimited(await file.text());

  const imported = buildImportedSheet(table);
  if (imported.columns.length === 0 || imported.rows.length === 0)
    throw new Error("That file has no rows this sheet could read.");

  const name = String(form.get("name") ?? "").trim() || file.name.replace(/\.[^.]+$/, "");
  const folder = String(form.get("folder") ?? "").trim() || "General";
  const description = String(form.get("description") ?? "").trim();

  const [created] = await db
    .insert(sheets)
    .values({
      kind: "grid",
      name,
      description: description || `Imported from ${file.name}.`,
      region,
      folder,
      ownerId: user.id,
    })
    .returning({ id: sheets.id });

  await db.insert(sheetColumns).values(
    imported.columns.map((column, index) => ({
      sheetId: created.id,
      key: column.key,
      label: column.label,
      type: column.type,
      options: column.options,
      width: column.width,
      sortOrder: index,
    })),
  );

  for (let i = 0; i < imported.rows.length; i += 500) {
    const chunk = imported.rows.slice(i, i + 500);
    if (chunk.length === 0) continue;
    await db.insert(sheetRows).values(
      chunk.map((values, index) => ({
        sheetId: created.id,
        values,
        sortOrder: i + index,
        updatedById: user.id,
      })),
    );
  }

  await db.insert(auditLog).values({
    entity: "sheet",
    entityId: created.id,
    action: "sheet_imported",
    field: name,
    newValue: `${imported.rows.length} rows × ${imported.columns.length} columns from ${file.name}`,
    userId: user.id,
  });

  revalidatePath("/sheets");
  return {
    id: created.id,
    columns: imported.columns.length,
    rows: imported.rows.length,
    skipped: imported.skippedRows,
  };
}

/** Reads the first worksheet of an xlsx into the same shape as a CSV. */
async function readWorkbookTable(buffer: ArrayBuffer): Promise<ImportTable> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("That workbook has no worksheets.");

  const table: ImportTable = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, index) => {
      cells[index - 1] = cellToText(cell.value);
    });
    for (let i = 0; i < cells.length; i++) cells[i] ??= "";
    table.push(cells);
  });
  return table;
}

function cellToText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const cell = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(cell.richText)) return cell.richText.map((r) => r.text).join("");
    if (cell.text != null) return String(cell.text);
    if (cell.result != null) return String(cell.result);
    return "";
  }
  return String(value);
}

export async function updateSheetMeta(
  id: number,
  patch: { name?: string; description?: string | null; folder?: string },
) {
  const { user, sheet } = await loadManageable(id);
  const next: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("Give the sheet a name.");
    next.name = name;
  }
  if (patch.description !== undefined) next.description = patch.description?.trim() || null;
  if (patch.folder !== undefined) next.folder = patch.folder.trim() || "General";

  await db.update(sheets).set(next).where(eq(sheets.id, id));
  await db.insert(auditLog).values({
    entity: "sheet",
    entityId: id,
    action: "sheet_updated",
    field: (next.name as string) ?? sheet.name,
    oldValue: `${sheet.folder}`,
    newValue: `${(next.folder as string) ?? sheet.folder}`,
    userId: user.id,
  });
  touch(id);
}

export async function saveSheetView(id: number, config: SheetViewConfig) {
  const { sheet } = await loadManageable(id);
  if (sheet.kind !== "view") throw new Error("Only pursuit views have a saved layout.");
  await db.update(sheets).set({ config, updatedAt: new Date() }).where(eq(sheets.id, id));
  touch(id);
}

export async function duplicateSheet(id: number): Promise<number> {
  const user = await getCurrentUser();
  const workspace = await getWorkspace();
  const [sheet] = await db.select().from(sheets).where(eq(sheets.id, id));
  if (!sheet) throw new Error("Sheet not found");
  if (!visibleInWorkspace(sheet, workspace))
    throw new Error("That sheet belongs to another Region's workspace.");

  // Duplicating a Corporate sheet drops the copy into your own workspace,
  // which is how a Region starts from the standard and then adapts it.
  const region = sheet.region ?? workspace.region;
  if (!canCreateSheet(user, region))
    throw new Error("Your role cannot create sheets in this workspace.");

  const existing = await db.select({ name: sheets.name }).from(sheets);
  const [copy] = await db
    .insert(sheets)
    .values({
      kind: sheet.kind,
      name: duplicateName(sheet.name, existing.map((s) => s.name)),
      description: sheet.description,
      region,
      folder: sheet.folder,
      config: sheet.config,
      ownerId: user.id,
    })
    .returning({ id: sheets.id });

  if (sheet.kind === "grid") {
    const cols = await db.select().from(sheetColumns).where(eq(sheetColumns.sheetId, id));
    if (cols.length > 0) {
      await db.insert(sheetColumns).values(
        cols.map((c) => ({
          sheetId: copy.id,
          key: c.key,
          label: c.label,
          type: c.type,
          options: c.options,
          width: c.width,
          sortOrder: c.sortOrder,
        })),
      );
    }
    const rows = await db.select().from(sheetRows).where(eq(sheetRows.sheetId, id));
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      if (chunk.length === 0) continue;
      await db.insert(sheetRows).values(
        chunk.map((r) => ({
          sheetId: copy.id,
          values: r.values,
          sortOrder: r.sortOrder,
          updatedById: user.id,
        })),
      );
    }
  }

  await db.insert(auditLog).values({
    entity: "sheet",
    entityId: copy.id,
    action: "sheet_duplicated",
    field: sheet.name,
    newValue: `copied into ${region ?? "Corporate"}`,
    userId: user.id,
  });

  revalidatePath("/sheets");
  return copy.id;
}

/** Archive rather than destroy: a Region can undo, and history survives. */
export async function archiveSheet(id: number) {
  const { user, sheet } = await loadManageable(id);
  await db.update(sheets).set({ archivedAt: new Date() }).where(eq(sheets.id, id));
  await db.insert(auditLog).values({
    entity: "sheet",
    entityId: id,
    action: "sheet_archived",
    field: sheet.name,
    userId: user.id,
  });
  revalidatePath("/sheets");
}

export async function restoreSheet(id: number) {
  const { user, sheet } = await loadManageable(id);
  await db.update(sheets).set({ archivedAt: null }).where(eq(sheets.id, id));
  await db.insert(auditLog).values({
    entity: "sheet",
    entityId: id,
    action: "sheet_restored",
    field: sheet.name,
    userId: user.id,
  });
  revalidatePath("/sheets");
}

export async function toggleSheetPin(id: number): Promise<boolean> {
  const user = await getCurrentUser();
  const [existing] = await db
    .select()
    .from(sheetPins)
    .where(and(eq(sheetPins.sheetId, id), eq(sheetPins.userId, user.id)));
  if (existing) {
    await db.delete(sheetPins).where(eq(sheetPins.id, existing.id));
    revalidatePath("/sheets");
    return false;
  }
  await db.insert(sheetPins).values({ sheetId: id, userId: user.id });
  revalidatePath("/sheets");
  return true;
}

// ---- Grid columns ----------------------------------------------------------

export async function addSheetColumn(
  sheetId: number,
  input: { label: string; type: SheetColumnType; options?: string[] },
) {
  const { sheet } = await loadManageable(sheetId);
  if (sheet.kind !== "grid") throw new Error("Pursuit views take columns from the field catalog.");
  const label = input.label.trim();
  if (!label) throw new Error("Give the column a name.");

  const existing = await db.select().from(sheetColumns).where(eq(sheetColumns.sheetId, sheetId));
  const [{ value: highest } = { value: null }] = await db
    .select({ value: max(sheetColumns.sortOrder) })
    .from(sheetColumns)
    .where(eq(sheetColumns.sheetId, sheetId));

  await db.insert(sheetColumns).values({
    sheetId,
    key: columnKeyFromLabel(label, existing.map((c) => c.key)),
    label,
    type: input.type,
    options: input.type === "dropdown" ? (input.options ?? []) : null,
    sortOrder: (highest ?? 0) + 1,
  });
  touch(sheetId);
}

export async function updateSheetColumn(
  columnId: number,
  patch: { label?: string; options?: string[]; width?: number },
) {
  const [col] = await db.select().from(sheetColumns).where(eq(sheetColumns.id, columnId));
  if (!col) throw new Error("Column not found");
  await loadManageable(col.sheetId);

  const next: Record<string, unknown> = {};
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (!label) throw new Error("Give the column a name.");
    next.label = label;
  }
  if (patch.options !== undefined) next.options = patch.options;
  if (patch.width !== undefined) next.width = Math.max(60, Math.round(patch.width));

  if (Object.keys(next).length > 0) {
    await db.update(sheetColumns).set(next).where(eq(sheetColumns.id, columnId));
  }
  touch(col.sheetId);
}

export async function deleteSheetColumn(columnId: number) {
  const [col] = await db.select().from(sheetColumns).where(eq(sheetColumns.id, columnId));
  if (!col) throw new Error("Column not found");
  await loadManageable(col.sheetId);

  const remaining = await db
    .select()
    .from(sheetColumns)
    .where(eq(sheetColumns.sheetId, col.sheetId));
  if (remaining.length <= 1) throw new Error("A sheet needs at least one column.");

  await db.delete(sheetColumns).where(eq(sheetColumns.id, columnId));
  touch(col.sheetId);
}

// ---- Grid rows -------------------------------------------------------------

export async function addSheetRow(sheetId: number): Promise<number> {
  const { user, sheet } = await loadEditable(sheetId);
  if (sheet.kind !== "grid") throw new Error("Pursuit views add records through New Pursuit.");
  const [{ value: highest } = { value: null }] = await db
    .select({ value: max(sheetRows.sortOrder) })
    .from(sheetRows)
    .where(eq(sheetRows.sheetId, sheetId));
  const [row] = await db
    .insert(sheetRows)
    .values({ sheetId, values: {}, sortOrder: (highest ?? 0) + 1, updatedById: user.id })
    .returning({ id: sheetRows.id });
  touch(sheetId);
  return row.id;
}

export async function updateSheetCell(rowId: number, key: string, value: string) {
  const [row] = await db.select().from(sheetRows).where(eq(sheetRows.id, rowId));
  if (!row) throw new Error("Row not found");
  const { user } = await loadEditable(row.sheetId);

  const cols = await db.select().from(sheetColumns).where(eq(sheetColumns.sheetId, row.sheetId));
  const col = cols.find((c) => c.key === key);
  if (!col) throw new Error("Unknown column");

  const clean = coerceCell(col.type, value, col.options ?? []);
  await db
    .update(sheetRows)
    .set({
      values: { ...row.values, [key]: clean },
      updatedById: user.id,
      updatedAt: new Date(),
    })
    .where(eq(sheetRows.id, rowId));
  touch(row.sheetId);
}

export async function deleteSheetRow(rowId: number) {
  const [row] = await db.select().from(sheetRows).where(eq(sheetRows.id, rowId));
  if (!row) throw new Error("Row not found");
  await loadEditable(row.sheetId);
  await db.delete(sheetRows).where(eq(sheetRows.id, rowId));
  touch(row.sheetId);
}

/** Same validation the pursuit forms apply, scaled down to one free-form cell. */
function coerceCell(type: SheetColumnType, raw: string, options: string[]): string | null {
  const value = raw.trim();
  if (value === "") return null;
  switch (type) {
    case "number":
    case "dollars": {
      const n = Number(value.replace(/[$,\s]/g, ""));
      if (!Number.isFinite(n)) throw new Error(`"${raw}" is not a number.`);
      return String(n);
    }
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Dates use YYYY-MM-DD.");
      return value;
    }
    case "checkbox":
      return ["true", "1", "yes", "y"].includes(value.toLowerCase()) ? "true" : null;
    case "dropdown": {
      if (options.length > 0 && !options.includes(value))
        throw new Error(`"${value}" is not one of the allowed values.`);
      return value;
    }
    default:
      return value;
  }
}

// ---- View data -------------------------------------------------------------

export type SheetGridColumn = {
  key: string;
  label: string;
  type: string;
  width: number;
  editable: boolean;
  options?: string[];
};

export type SheetRowsPayload = {
  columns: SheetGridColumn[];
  rows: {
    id: number;
    cells: Record<string, string | number | null>;
    locked: boolean;
    lockReason?: string;
    jobId: number;
    status: string;
  }[];
  total: number;
};

/**
 * Projects the live pursuit dataset down to the columns a view asks for.
 * Sending only the selected columns keeps a 1,000-row sheet small enough to
 * re-fetch every time someone adds a column or edits a filter.
 */
export async function loadSheetRows(
  sheetId: number,
  columns: string[],
  filters: { field: string; op: string; value: string }[],
): Promise<SheetRowsPayload> {
  const user = await getCurrentUser();
  const workspace = await getWorkspace();
  const [sheet] = await db.select().from(sheets).where(eq(sheets.id, sheetId));
  if (!sheet) throw new Error("Sheet not found");
  if (!visibleInWorkspace(sheet, workspace))
    throw new Error("That sheet belongs to another Region's workspace.");

  return projectRows(user, columns, filters);
}

async function projectRows(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  columnKeys: string[],
  filters: { field: string; op: string; value: string }[],
): Promise<SheetRowsPayload> {
  const [{ rows: flat, catalog }, lists] = await Promise.all([
    getFlatDataset(),
    getReferenceValues(),
  ]);
  const byKey = new Map(catalog.map((c) => [c.key, c]));

  const columns: SheetGridColumn[] = columnKeys
    .filter((k) => byKey.has(k))
    .map((key) => {
      const def = byKey.get(key)!;
      const field = FIELD_MAP[key];
      const editable =
        key.startsWith("custom:") ||
        (ROUND_COLUMN_KEYS.includes(key) && def.type !== "multi");
      return {
        key,
        label: def.label,
        type: def.type,
        width: defaultWidth(def.type, def.label),
        editable,
        options: field?.listKey ? lists[field.listKey] : undefined,
      };
    });

  const matching = flat.filter((r) => filters.every((f) => matchesFilter(r, f)));
  const canEdit = canEditRows(user);

  return {
    total: flat.length,
    columns,
    rows: matching.map((r) => {
      const cells: Record<string, string | number | null> = {};
      for (const col of columns) cells[col.key] = r[col.key] ?? null;
      const locked = String(r.status) === STATUS_LABELS.locked;
      return {
        id: Number(r.id),
        cells,
        jobId: 0,
        status: String(r.status ?? ""),
        locked: !canEdit || (locked && user.role !== "rpd" && user.role !== "corporate_admin"),
        lockReason: !canEdit
          ? "Your role has read-only access."
          : locked
            ? "Approved and locked — only the RPD can correct it."
            : undefined,
      };
    }),
  };
}

function defaultWidth(type: string, label: string): number {
  const base = Math.min(260, Math.max(90, label.length * 8 + 34));
  if (type === "dollars" || type === "metric" || type === "number") return Math.max(base, 110);
  if (type === "date") return 112;
  return base;
}

/** Folder rename across a workspace, so the tree can be reorganised in place. */
export async function renameFolder(from: string, to: string) {
  const user = await getCurrentUser();
  const workspace = await getWorkspace();
  const target = to.trim();
  if (!target) throw new Error("Give the folder a name.");

  const all = await db.select().from(sheets).where(eq(sheets.folder, from));
  const mine = all.filter((s) => visibleInWorkspace(s, workspace) && canManageSheet(user, s));
  if (mine.length === 0) throw new Error("No sheets in that folder are yours to move.");

  for (const s of mine) {
    await db.update(sheets).set({ folder: target, updatedAt: new Date() }).where(eq(sheets.id, s.id));
  }
  revalidatePath("/sheets");
  return { moved: mine.length };
}

/** Column reordering for grid sheets, driven by the header drag handles. */
export async function reorderSheetColumns(sheetId: number, orderedIds: number[]) {
  await loadManageable(sheetId);
  const cols = await db
    .select()
    .from(sheetColumns)
    .where(eq(sheetColumns.sheetId, sheetId))
    .orderBy(asc(sheetColumns.sortOrder));
  const known = new Set(cols.map((c) => c.id));
  let order = 0;
  for (const id of orderedIds) {
    if (!known.has(id)) continue;
    await db.update(sheetColumns).set({ sortOrder: order++ }).where(eq(sheetColumns.id, id));
  }
  touch(sheetId);
}
