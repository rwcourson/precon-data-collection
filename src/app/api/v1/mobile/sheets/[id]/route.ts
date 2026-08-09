import {
  archiveSheet,
  restoreSheet,
  toggleSheetPin,
  updateSheetCell,
  updateSheetMeta,
  addSheetRow,
} from "@/actions/sheets";
import { db } from "@/db";
import { sheetPins, sheets } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { jsonError, jsonOk, mapError, withMobileAuth } from "@/lib/mobile-http";
import { getCurrentUser } from "@/lib/current-user";
import { canManageSheet } from "@/lib/sheets";
import { loadSheetGrid, loadSheetView } from "@/lib/sheets-server";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withMobileAuth(req, async () => {
    const { id } = await ctx.params;
    const sheetId = Number(id);
    if (!Number.isFinite(sheetId)) return jsonError("Invalid sheet id", 400);

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);

    const [sheet] = await db.select().from(sheets).where(eq(sheets.id, sheetId));
    if (!sheet) return jsonError("Sheet not found", 404);

    const user = await getCurrentUser();
    const pinRows = await db
      .select({ sheetId: sheetPins.sheetId })
      .from(sheetPins)
      .where(and(eq(sheetPins.userId, user.id), eq(sheetPins.sheetId, sheetId)))
      .limit(1);
    const pinned = pinRows.length > 0;
    const canManage = canManageSheet(user, sheet);

    // Grid sheets: column store + cell map rows.
    // View sheets: live pursuit/field catalog via evaluateView (Smartsheet-style).
    if (sheet.kind === "view") {
      const payload = await loadSheetView(sheet);
      const { result } = payload;
      const columns = result.columns.map((c, i) => ({
        id: i + 1,
        key: c.key,
        label: c.label,
        type: c.type,
        sortOrder: i,
      }));
      const active = result.rows.map((r, i) => {
        const values: Record<string, string | null> = {};
        for (const col of result.columns) {
          const raw = r[col.key];
          values[col.key] =
            raw == null ? null : typeof raw === "number" ? String(raw) : String(raw);
        }
        // Synthetic stable id for mobile edit UI (views are read-mostly)
        return {
          id: typeof r.id === "number" ? r.id : i + 1,
          values,
          sortOrder: i,
        };
      });
      const page = active.slice(offset, offset + limit);
      const hasMore = offset + limit < active.length;
      return jsonOk({
        data: {
          sheet,
          columns,
          rows: page,
          kind: "view" as const,
          readOnly: true,
          pinned,
          canManage,
          pagination: {
            offset,
            limit,
            total: active.length,
            hasMore,
            nextOffset: hasMore ? offset + limit : null,
            nextCursor: hasMore ? String(offset + limit) : null,
          },
        },
      });
    }

    const grid = await loadSheetGrid(sheet);
    const active = grid.rows.filter((r) => r.deletedAt == null);
    const page = active.slice(offset, offset + limit);
    const hasMore = offset + limit < active.length;

    return jsonOk({
      data: {
        sheet,
        columns: grid.columns,
        rows: page,
        kind: "grid" as const,
        readOnly: false,
        pinned,
        canManage,
        pagination: {
          offset,
          limit,
          total: active.length,
          hasMore,
          nextOffset: hasMore ? offset + limit : null,
          nextCursor: hasMore ? String(offset + limit) : null,
        },
      },
    });
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withMobileAuth(req, async () => {
    const { id } = await ctx.params;
    const sheetId = Number(id);
    if (!Number.isFinite(sheetId)) return jsonError("Invalid sheet id", 400);
    let body: {
      action?: string;
      meta?: Parameters<typeof updateSheetMeta>[1];
      cell?: { rowId: number; key: string; value: string };
    };
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }
    try {
      if (body.action === "pin") {
        const pinned = await toggleSheetPin(sheetId);
        return jsonOk({ pinned });
      }
      if (body.action === "archive") {
        await archiveSheet(sheetId);
        return jsonOk({ archived: true });
      }
      if (body.action === "restore") {
        await restoreSheet(sheetId);
        return jsonOk({ restored: true });
      }
      if (body.action === "add-row") {
        const rowId = await addSheetRow(sheetId);
        return jsonOk({ rowId });
      }
      if (body.cell) {
        await updateSheetCell(body.cell.rowId, body.cell.key, body.cell.value);
        return jsonOk({ ok: true });
      }
      if (body.meta) {
        await updateSheetMeta(sheetId, body.meta);
        return jsonOk({ ok: true });
      }
      return jsonError("Unknown action", 400);
    } catch (err) {
      return mapError(err);
    }
  });
}
