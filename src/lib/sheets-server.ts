import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sheetColumns, sheetPins, sheetRows, users } from "@/db/schema";
import type { Sheet, SheetColumn, SheetRow } from "@/db/schema";
import {
  listSheetsForPrincipal,
  loadSheetForPrincipal,
} from "./authorization/loaders";
import type { Principal } from "./authorization/types";
import { getFlatDataset } from "./export-helpers";
import type { FlatRow, ReportFieldDef } from "./report-engine";
import {
  BLANK_VIEW_CONFIG,
  evaluateView,
  matchesFilter,
  type SheetSummary,
  type SheetViewResult,
} from "./sheets";

export async function listSheets(
  principal: Principal,
): Promise<SheetSummary[]> {
  const scopedSheets = await listSheetsForPrincipal(principal);
  const ownerIds = [...new Set(scopedSheets.map((sheet) => sheet.ownerId).filter((id): id is number => id != null))];
  const [rows, owners, pins] = await Promise.all([
    Promise.resolve(scopedSheets),
    ownerIds.length > 0
      ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ownerIds))
      : Promise.resolve([]),
    db.select().from(sheetPins).where(eq(sheetPins.userId, principal.user.id)),
  ]);

  const ownerName = new Map(owners.map((o) => [o.id, o.name]));
  const pinned = new Set(pins.map((p) => p.sheetId));

  const gridIds = rows.filter((s) => s.kind === "grid").map((s) => s.id);
  const gridCounts = new Map<number, number>();
  if (gridIds.length > 0) {
    const allRows = await db
      .select({ id: sheetRows.id, sheetId: sheetRows.sheetId })
      .from(sheetRows)
      .where(and(inArray(sheetRows.sheetId, gridIds), isNull(sheetRows.deletedAt)));
    for (const r of allRows) gridCounts.set(r.sheetId, (gridCounts.get(r.sheetId) ?? 0) + 1);
  }

  // View counts come from the live dataset, so a sheet's row count is never
  // a stale number copied at save time.
  let flat: FlatRow[] = [];
  if (rows.some((s) => s.kind === "view")) {
    flat = (await getFlatDataset(principal)).rows;
  }

  const manageable = new Set(
    (
      await Promise.all(
        rows.map(async (sheet) =>
          (await loadSheetForPrincipal(principal, sheet.id, "manage")) ? sheet.id : null,
        ),
      )
    ).filter((id): id is number => id != null),
  );

  return rows.map((s) => ({
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
    canManage: manageable.has(s.id),
  }));
}

/**
 * Archived sheets, newest first. Archiving is reversible on purpose — a Region
 * that clears out a sheet mid-year still needs last year's back.
 */
export async function listArchivedSheets(
  principal: Principal,
): Promise<
  { id: number; name: string; folder: string; archivedAt: string; canRestore: boolean }[]
> {
  const rows = await listSheetsForPrincipal(principal, { archived: true });
  return Promise.all(rows.map(async (s) => ({
      id: s.id,
      name: s.name,
      folder: s.folder,
      archivedAt: s.archivedAt!.toISOString(),
      canRestore: Boolean(await loadSheetForPrincipal(principal, s.id, "manage")),
    })));
}

function countMatching(flat: FlatRow[], sheet: Sheet): number {
  const config = sheet.config ?? BLANK_VIEW_CONFIG;
  if (config.filters.length === 0) return flat.length;
  return flat.filter((r) => config.filters.every((f) => matchesFilter(r, f))).length;
}

export type SheetViewPayload = {
  sheet: Sheet;
  result: SheetViewResult;
  catalog: ReportFieldDef[];
};

export async function loadSheetView(sheet: Sheet, principal: Principal): Promise<SheetViewPayload> {
  const { rows, catalog } = await getFlatDataset(principal);
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
      .where(and(eq(sheetRows.sheetId, sheet.id), isNull(sheetRows.deletedAt)))
      .orderBy(asc(sheetRows.sortOrder), asc(sheetRows.id)),
  ]);
  return { sheet, columns, rows };
}

/** Folder names already in use in a workspace, for the create/move pickers. */
export async function listFolders(principal: Principal): Promise<string[]> {
  const rows = await listSheetsForPrincipal(principal);
  const names = new Set(rows.map((row) => row.folder));
  return [...names].sort((a, b) => a.localeCompare(b));
}

export async function listPinnedSheets(
  principal: Principal,
): Promise<{ id: number; name: string }[]> {
  const pins = await db.select().from(sheetPins).where(eq(sheetPins.userId, principal.user.id));
  if (pins.length === 0) return [];
  const rows = await listSheetsForPrincipal(principal);
  const pinned = new Set(pins.map((pin) => pin.sheetId));
  return rows
    .filter((s) => pinned.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ id: s.id, name: s.name }));
}
