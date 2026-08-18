import { BookOpen } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ReportBuilder } from "@/components/reports/report-builder";
import { ReportSchedulesPanel } from "@/components/reports/report-schedules-panel";
import { Button } from "@/components/ui/button";
import {
  listCustomColumnsForPrincipal,
  listDirectoryUsersForPrincipal,
  listReportsForPrincipal,
} from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { getReferenceValues } from "@/lib/queries";
import { buildFieldCatalog } from "@/lib/report-engine";
import { getWorkspace } from "@/lib/workspace-server";
import { reportScheduleService } from "@/services/report-schedule-service";

export default async function ReportsPage() {
  const [principal, workspace] = await Promise.all([
    getWebPrincipal(),
    getWorkspace(),
  ]);
  const user = principal.user;
  const [allUsers, visible, customCols, lists, schedules] = await Promise.all([
    listDirectoryUsersForPrincipal(principal),
    listReportsForPrincipal(principal),
    listCustomColumnsForPrincipal(principal),
    getReferenceValues(),
    reportScheduleService.listMine(principal),
  ]);

  const userMap = new Map(allUsers.map((u) => [u.id, u.name]));

  const catalog = buildFieldCatalog(customCols);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Custom Report Builder"
        description={`Combine Bid Schedule, post-bid, and calculated summary data in one report — filter, group, aggregate, sort, save, share, and export. Results are scoped to the ${
          workspace.region
            ? `${workspace.region} workspace`
            : "Corporate workspace (all Regions)"
        }.`}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            nativeButton={false}
            render={<Link href="/reports/annual" />}
          >
            <BookOpen className="size-4" /> Annual Regional Report
          </Button>
        }
      />
      <ReportBuilder
        catalog={catalog}
        saved={visible.map((r) => ({
          id: r.id,
          name: r.name,
          ownerId: r.ownerId,
          ownerName: userMap.get(r.ownerId) ?? "Unknown",
          config: r.config,
          sharedWithRegions: r.sharedWithRegions ?? [],
          sharedWithUserIds: r.sharedWithUserIds ?? [],
        }))}
        currentUserId={user.id}
        regions={lists.region ?? []}
        users={allUsers.map((u) => ({ id: u.id, name: u.name }))}
      />
      <ReportSchedulesPanel
        ownedReports={visible
          .filter((report) => report.ownerId === user.id)
          .map((report) => ({ id: report.id, name: report.name }))}
        schedules={schedules.map((row) => ({
          id: row.id,
          name: row.name,
          savedReportId: row.savedReportId,
          weekday: row.weekday,
          hour: row.hour,
          timezone: row.timezone,
          paused: row.paused,
          lastSentAt: row.lastSentAt?.toISOString() ?? null,
          lastPeriodKey: row.lastPeriodKey,
        }))}
      />
    </div>
  );
}
