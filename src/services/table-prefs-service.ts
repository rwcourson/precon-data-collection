import "server-only";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { bidScheduleViews, userTablePrefs } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import type { Principal } from "@/lib/authorization/types";
import {
  BID_SCHEDULE_SURFACE,
  parseUserTablePrefsConfig,
  type UserTablePrefsConfig,
} from "@/lib/table-prefs";

export type TablePrefsPatch = {
  columns?: string[];
  density?: "summary" | "detail";
  columnWidths?: Record<string, number>;
  defaultViewId?: number | null;
};

function mergePrefs(
  current: UserTablePrefsConfig,
  patch: TablePrefsPatch
): UserTablePrefsConfig {
  return {
    version: 1,
    columns: patch.columns ?? current.columns,
    density: patch.density ?? current.density,
    columnWidths: patch.columnWidths ?? current.columnWidths,
    defaultViewId:
      patch.defaultViewId !== undefined
        ? patch.defaultViewId
        : current.defaultViewId,
  };
}

async function loadRow(principal: Principal, surface: string) {
  const [row] = await db
    .select()
    .from(userTablePrefs)
    .where(
      and(
        eq(userTablePrefs.userId, principal.user.id),
        eq(userTablePrefs.surface, surface)
      )
    )
    .limit(1);
  return row ?? null;
}

/** Per-user table chrome. Identity is the explicit Principal — never ambient cookies. */
export const tablePrefsService = {
  async load(
    principal: Principal,
    surface: string
  ): Promise<UserTablePrefsConfig> {
    const row = await loadRow(principal, surface);
    return parseUserTablePrefsConfig(row?.config ?? {});
  },

  async save(
    principal: Principal,
    surface: string,
    patch: TablePrefsPatch
  ): Promise<UserTablePrefsConfig> {
    const current = await this.load(principal, surface);
    const next = mergePrefs(current, patch);
    const now = new Date();
    await db
      .insert(userTablePrefs)
      .values({
        userId: principal.user.id,
        surface,
        config: next,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userTablePrefs.userId, userTablePrefs.surface],
        set: { config: next, updatedAt: now },
      });
    return next;
  },

  async reset(principal: Principal, surface: string): Promise<void> {
    await db
      .delete(userTablePrefs)
      .where(
        and(
          eq(userTablePrefs.userId, principal.user.id),
          eq(userTablePrefs.surface, surface)
        )
      );
  },

  async setDefaultView(
    principal: Principal,
    viewId: number | null
  ): Promise<UserTablePrefsConfig> {
    if (viewId != null) {
      const [view] = await db
        .select({ id: bidScheduleViews.id })
        .from(bidScheduleViews)
        .where(
          and(
            eq(bidScheduleViews.id, viewId),
            or(
              eq(bidScheduleViews.ownerId, principal.user.id),
              eq(bidScheduleViews.shared, true)
            )
          )
        )
        .limit(1);
      if (!view) {
        throw DomainError.notFound("Saved view not found");
      }
    }
    return this.save(principal, BID_SCHEDULE_SURFACE, {
      defaultViewId: viewId,
    });
  },

  async clearDefaultViewIf(
    principal: Principal,
    viewId: number
  ): Promise<void> {
    const current = await this.load(principal, BID_SCHEDULE_SURFACE);
    if (current.defaultViewId !== viewId) return;
    await this.save(principal, BID_SCHEDULE_SURFACE, { defaultViewId: null });
  },
};
