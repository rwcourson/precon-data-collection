import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import { StudioCloneButton } from "@/components/dashboards/studio-clone-button";
import { StudioWidgetForm } from "@/components/dashboards/studio-widget-form";
import { WidgetCanvas } from "@/components/dashboards/widget-canvas";
import { MagnusIcon } from "@/components/magnus-icon";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { dashboardWidgets } from "@/db/schema";
import { resolveWidget } from "@/lib/dashboard-query";
import {
  listRoundsWithJobsForPrincipal,
  loadDashboardForPrincipal,
} from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";

export default async function DashboardStudioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const principal = await getWebPrincipal();
  const loaded = await loadDashboardForPrincipal(principal, id);
  if (!loaded) notFound();
  const dash = loaded.value;

  const [widgets, rows] = await Promise.all([
    db
      .select()
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.dashboardId, id))
      .orderBy(asc(dashboardWidgets.sortOrder)),
    listRoundsWithJobsForPrincipal(principal),
  ]);
  const rounds = rows.map((r) => r.round);
  const resolved = widgets.map((w) => resolveWidget(w.config, rounds));

  return (
    <div className="space-y-5">
      <PageHeader
        title={dash.name}
        description={dash.description ?? "Custom dashboard canvas."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              nativeButton={false}
              render={<Link href="/dashboards/copilot" />}
            >
              <MagnusIcon className="size-4" />
              Copilot
            </Button>
            <StudioCloneButton dashboardId={id} />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              nativeButton={false}
              render={<a href="/api/export/pptx" />}
            >
              <Download className="size-4" />
              Export PPTX
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/dashboards/studio" />}
            >
              Back to studio
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline" size="sm">
          {dash.scope}
        </Badge>
        {dash.region && (
          <Badge variant="outline" size="sm">
            {dash.region}
          </Badge>
        )}
        <span>{dash.published ? "Published" : "Draft"}</span>
        <span>· {widgets.length} widgets</span>
      </div>

      <WidgetCanvas widgets={resolved} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Add widget</CardTitle>
          <CardDescription>
            Manual tile — or use{" "}
            <Link href="/dashboards/copilot" className="underline underline-offset-2">
              AI Copilot
            </Link>{" "}
            to generate a full layout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StudioWidgetForm dashboardId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
