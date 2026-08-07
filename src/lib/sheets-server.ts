import "server-only";

import { asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sheetColumns, sheetPins, sheetRows, sheets, users } from "@/db/schema";
import type { Sheet, SheetColumn, SheetRow, User } from "@/db/schema";
import { getFlatDataset } from "./export-helpers";
import type { FlatRow, ReportFieldDef } from "./report-engine";
import {
  BLANK_VIEW_CONFIG,
  canManageSheet,
  evaluateView,
  matchesFilter,
  type SheetSummary,
  type SheetViewResult,
} from "./sheets";
import type { Workspace } from "./workspace";

/** A Corporate sheet is shared with every Region; a Region sheet stays home. */
export function visibleInWorkspace(sheet: Pick<Sheet, "region">, workspace: Workspace): boolean {
  if (sheet.region == null) return true;
  return workspace.region == null || workspace.region === sheet.region;
}

export async function listSheets(
  workspace: Workspace,
  user: User,
): Promise<SheetSummary[]> {
  const [rows, owners, pins] = await Promise.all([
    db.select().from(sheets).where(isNull(sheets.archivedAt)).orderBy(asc(sheets.name)),
    db.select({ id: users.id, name: users.name }).from(users),
    db.select().from(sheetPins).where(eq(sheetPins.userId, user.id)),
  ]);

  const visible = rows.filter((s) => visibleInWorkspace(s, workspace));
  const ownerName = new Map(owners.map((o) => [o.id, o.name]));
  const pinned = new Set(pins.map((p) => p.sheetId));

  const gridIds = visible.filter((s) => s.kind === "grid").map((s) => s.id);
  const gridCounts = new Map<number, number>();
  if (gridIds.length > 0) {
    const allRows = await db
      .select({ id: sheetRows.id, sheetId: sheetRows.sheetId })
      .from(sheetRows)
      .where(inArray(sheetRows.sheetId, gridIds));
    for (const r of allRows) gridCounts.set(r.sheetId, (gridCounts.get(r.sheetId) ?? 0) + 1);
  }

  // View counts come from the live dataset, so a sheet's row count is never
  // a stale number copied at save time.
  let flat: FlatRow[] = [];
  if (visible.some((s) => s.kind === "view")) {
    flat = (await getFlatDataset()).rows;
  }

  return visible.map((s) => ({
    id: s.id,
    kind: s.kind,
    name: s.name,
    description: s.description,
    region: s.region,
    folder: s.folder,
    sourceSheet: s.sourceSheet,
    ownerName: s.ownerId ? (ownerName.get(s.ownerId) ?? null) : null,
    updatedAt: s.updatedAt.toISOString(),
    pinned: pinned.has(s.id),
    rowCount:
      s.kind === "grid"
        ? (gridCounts.get(s.id) ?? 0)
        : countMatching(flat, s),
    canManage: canManageSheet(user, s),
  }));
}

/**
 * Archived sheets, newest first. Archiving is reversible on purpose — a Region
 * that clears out a sheet mid-year still needs last year's back.
 */
export async function listArchivedSheets(
  workspace: Workspace,
  user: User,
): Promise<
  { id: number; name: string; folder: string; archivedAt: string; canRestore: boolean }[]
> {
  const rows = await db.select().from(sheets).where(isNotNull(sheets.archivedAt));
  return rows
    .filter((s) => visibleInWorkspace(s, workspace))
    .sort((a, b) => (b.archivedAt?.getTime() ?? 0) - (a.archivedAt?.getTime() ?? 0))
    .map((s) => ({
      id: s.id,
      name: s.name,
      folder: s.folder,
      archivedAt: s.archivedAt!.toISOString(),
      canRestore: canManageSheet(user, s),
    }));
}

function countMatching(flat: FlatRow[], sheet: Sheet): number {
  const config = sheet.config ?? BLANK_VIEW_CONFIG;
  if (config.filters.length === 0) return flat.length;
  return flat.filter((r) => config.filters.every((f) => matchesFilter(r, f))).length;
}

export async function getSheet(id: number): Promise<Sheet | null> {
  const [row] = await db.select().from(sheets).where(eq(sheets.id, id));
  return row ?? null;
}

export type SheetViewPayload = {
  sheet: Sheet;
  result: SheetViewResult;
  catalog: ReportFieldDef[];
};

export async function loadSheetView(sheet: Sheet): Promise<SheetViewPayload> {
  const { rows, catalog } = await getFlatDataset();
  const config = sheet.config ?? BLANK_VIEW_CONFIG;
  return { sheet, result: evaluateView(rows, config, catalog), catalog };
}

export type SheetGridPayload = {
  sheet: Sheet;
  columns: SheetColumn[];
  rows: SheetRow[];
};

export async function loadSheetGrid(sheet: Sheet): Promise<SheetGridPayload> {
  const [columns, rows] = await Promise.all([
    db
      .select()
      .from(sheetColumns)
      .where(eq(sheetColumns.sheetId, sheet.id))
      .orderBy(asc(sheetColumns.sortOrder), asc(sheetColumns.id)),
    db
      .select()
      .from(sheetRows)
      .where(eq(sheetRows.sheetId, sheet.id))
      .orderBy(asc(sheetRows.sortOrder), asc(sheetRows.id)),
  ]);
  return { sheet, columns, rows };
}

/** Folder names already in use in a workspace, for the create/move pickers. */
export async function listFolders(workspace: Workspace): Promise<string[]> {
  const rows = await db
    .select({ folder: sheets.folder, region: sheets.region })
    .from(sheets)
    .where(isNull(sheets.archivedAt));
  const names = new Set<string>();
  for (const r of rows) {
    if (visibleInWorkspace(r, workspace)) names.add(r.folder);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export async function listPinnedSheets(
  workspace: Workspace,
  userId: number,
): Promise<{ id: number; name: string }[]> {
  const pins = await db.select().from(sheetPins).where(eq(sheetPins.userId, userId));
  if (pins.length === 0) return [];
  const rows = await db
    .select()
    .from(sheets)
    .where(inArray(sheets.id, pins.map((p) => p.sheetId)));
  return rows
    .filter((s) => s.archivedAt == null && visibleInWorkspace(s, workspace))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ id: s.id, name: s.name }));
}
