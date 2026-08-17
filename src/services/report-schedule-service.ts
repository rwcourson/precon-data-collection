import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { distributionLists, savedReports, users } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { loadReportForPrincipal } from "@/lib/authorization/loaders";
import type { Principal } from "@/lib/authorization/types";
import { createPrincipal } from "@/lib/authorization/principal";
import { buildPrintHtml, getFlatDataset, type ExportColumn } from "@/lib/export-helpers";
import { formatReportValue, runReportEngine } from "@/lib/report-engine";
import { deliverQueued, emailProvider, queueEmails } from "@/lib/email";
import { recordReportArtifact } from "@/lib/recovery";
import { requireAuthorized } from "@/services/mutation-policy";

export type ReportScheduleInput = {
  savedReportId: number;
  weekday: number;
  hour: number;
  timezone?: string;
  extraEmails?: string[];
};

function reportDescriptor(report: { id: number; ownerId: number }) {
  return {
    type: "report" as const,
    id: report.id,
    region: null,
    ownerId: report.ownerId,
    published: true,
    deleted: false,
  };
}

async function loadOwnedList(principal: Principal, listId: number) {
  const [list] = await db
    .select()
    .from(distributionLists)
    .where(and(eq(distributionLists.id, listId), isNull(distributionLists.deletedAt)));
  if (!list || list.cadence !== "scheduled") {
    throw DomainError.notFound("Schedule not found");
  }
  if (list.ownerId !== principal.user.id) {
    throw DomainError.forbidden(
      "Not permitted to manage this schedule",
      "Only the owner can change a report schedule.",
    );
  }
  if (list.savedReportId) {
    const loaded = await loadReportForPrincipal(principal, list.savedReportId);
    requireAuthorized(
      principal,
      "reports.schedule",
      loaded?.descriptor ?? reportDescriptor({ id: list.savedReportId, ownerId: list.ownerId }),
      "Report schedule",
    );
  }
  return list;
}

/** Self-serve saved-report email schedules. Identity is the explicit Principal. */
export const reportScheduleService = {
  async listMine(principal: Principal) {
    return db
      .select()
      .from(distributionLists)
      .where(
        and(
          eq(distributionLists.ownerId, principal.user.id),
          eq(distributionLists.cadence, "scheduled"),
          isNull(distributionLists.deletedAt),
        ),
      );
  },

  async create(principal: Principal, input: ReportScheduleInput) {
    const loaded = await loadReportForPrincipal(principal, input.savedReportId);
    if (!loaded) throw DomainError.notFound("Saved report not found");
    requireAuthorized(principal, "reports.schedule", loaded.descriptor, "Report schedule");
    if (input.weekday < 0 || input.weekday > 6 || input.hour < 0 || input.hour > 23) {
      throw DomainError.badRequest("Weekday must be 0–6 and hour 0–23");
    }
    const emails = [principal.user.email, ...(input.extraEmails ?? [])].filter(Boolean);
    const [row] = await db
      .insert(distributionLists)
      .values({
        name: `${loaded.value.name} schedule`,
        region: principal.workspace.region ?? principal.user.region,
        emails,
        cadence: "scheduled",
        reportKey: loaded.value.presetKey ?? `saved:${loaded.value.id}`,
        timezone: input.timezone ?? "America/Chicago",
        ownerId: principal.user.id,
        savedReportId: loaded.value.id,
        weekday: input.weekday,
        hour: input.hour,
        paused: false,
      })
      .returning();
    return row;
  },

  async setPaused(principal: Principal, listId: number, paused: boolean) {
    const list = await loadOwnedList(principal, listId);
    const [updated] = await db
      .update(distributionLists)
      .set({ paused, updatedAt: new Date() })
      .where(and(eq(distributionLists.id, list.id), eq(distributionLists.ownerId, principal.user.id)))
      .returning();
    return updated;
  },

  async remove(principal: Principal, listId: number) {
    const list = await loadOwnedList(principal, listId);
    await db
      .update(distributionLists)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(distributionLists.id, list.id), eq(distributionLists.ownerId, principal.user.id)));
  },

  async sendNow(listId: number, now = new Date()) {
    const [list] = await db
      .select()
      .from(distributionLists)
      .where(and(eq(distributionLists.id, listId), isNull(distributionLists.deletedAt)));
    if (!list?.savedReportId) throw DomainError.notFound("Schedule not found");
    const [report] = await db
      .select()
      .from(savedReports)
      .where(and(eq(savedReports.id, list.savedReportId), isNull(savedReports.deletedAt)));
    const [owner] = await db.select().from(users).where(eq(users.id, list.ownerId)).limit(1);
    if (!report || !owner) throw DomainError.notFound("Saved report not found");

    const ownerPrincipal = createPrincipal({
      user: owner,
      authSource: "service",
      workspaceRegion: owner.region,
    });
    const { rows, catalog } = await getFlatDataset(ownerPrincipal);
    const result = runReportEngine(rows, report.config, catalog);
    const columns: ExportColumn[] = result.columns.map((column) => {
      const baseKey =
        column.key.includes(":") && !column.key.startsWith("metric:") && !column.key.startsWith("custom:")
          ? column.key.split(":")[1]
          : column.key;
      const def = catalog.find((item) => item.key === baseKey);
      return { key: column.key, label: column.label, type: def?.type ?? "text" };
    });
    const html = buildPrintHtml({
      title: report.name,
      columns,
      rows: result.rows,
      formatValue: (key, value) => formatReportValue(key, value, catalog),
    });
    const bytes = new TextEncoder().encode(html);
    const reportKey = list.reportKey || `saved:${report.id}`;
    const artifact = await recordReportArtifact({
      reportKey,
      bytes,
      region: list.region,
      ownerId: list.ownerId,
      parameters: { listId: list.id, weekday: list.weekday, hour: list.hour, firedAt: now.toISOString() },
      contentType: "text/html",
    });

    const outboxIds: number[] = [];
    for (const email of list.emails) {
      const ids = await queueEmails([
        {
          toEmail: email,
          toUserId: email === owner.email ? owner.id : null,
          subject: `${report.name} — scheduled report`,
          body: `Attached: ${report.name}.html\n\nWrapped-text report for ${list.name}.\nArtifact checksum: ${artifact.checksum}`,
          kind: "report_schedule",
          distributionListId: list.id,
          reportKey,
          attachmentName: `${report.name.replace(/[^a-z0-9-_ ]/gi, "")}.html`,
          attachmentStorageKey: artifact.storageKey,
          logicalDeliveryKey: `sched:${list.id}:${now.toISOString()}:${email}`,
        },
      ]);
      outboxIds.push(...ids);
    }
    const delivery = await deliverQueued(outboxIds);
    return {
      outboxIds,
      provider: emailProvider(),
      artifact: {
        id: artifact.id,
        checksum: artifact.checksum,
        byteSize: artifact.byteSize,
        storageKey: artifact.storageKey,
        contentType: artifact.contentType,
      },
      html,
      delivery,
    };
  },
};
