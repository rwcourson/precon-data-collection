import Link from "next/link";
import { asc } from "drizzle-orm";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportBuilder } from "@/components/reports/report-builder";
import { db } from "@/db";
import { savedReports, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { getAllCustomColumns, getReferenceValues } from "@/lib/queries";
import { buildFieldCatalog } from "@/lib/report-engine";
import { PageHeader } from "@/components/page-header";
import { getWorkspace } from "@/lib/workspace-server";

export default async function ReportsPage() {
  const workspace = await getWorkspace();
  const [user, allUsers, reports, customCols, lists] = await Promise.all([
    getCurrentUser(),
    db.select().from(users).orderBy(asc(users.id)),
    db.select().from(savedReports).orderBy(asc(savedReports.id)),
    getAllCustomColumns(),
    getReferenceValues(),
  ]);

  const userMap = new Map(allUsers.map((u) => [u.id, u.name]));

  // Visibility: own reports + reports shared with me or my Region
  const visible = reports.filter(
    (r) =>
      r.ownerId === user.id ||
      (r.sharedWithUserIds ?? []).includes(user.id) ||
      (user.region != null && (r.sharedWithRegions ?? []).includes(user.region)) ||
      user.role === "corporate_admin",
  );

  const catalog = buildFieldCatalog(customCols);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Custom Report Builder"
        description={`Combine Bid Schedule, post-bid, and calculated summary data in one report — filter, group, aggregate, sort, save, share, and export. Results are scoped to the ${
          workspace.region ? `${workspace.region} workspace` : "Corporate workspace (all Regions)"
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
    </div>
  );
}
