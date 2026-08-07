import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Download } from "lucide-react";
import { StudioCloneButton } from "@/components/dashboards/studio-clone-button";
import { StudioWidgetForm } from "@/components/dashboards/studio-widget-form";
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
import { dashboardWidgets, dashboards } from "@/db/schema";

export default async function DashboardStudioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const [dash] = await db
    .select()
    .from(dashboards)
    .where(and(eq(dashboards.id, id), isNull(dashboards.deletedAt)));
  if (!dash) notFound();

  const widgets = await db
    .select()
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.dashboardId, id))
    .orderBy(asc(dashboardWidgets.sortOrder));

  return (
    <div className="space-y-5">
      <PageHeader
        title={dash.name}
        description={dash.description ?? "Custom dashboard canvas."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboards/studio" />}>
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
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Widgets</CardTitle>
          <CardDescription>
            {widgets.length} widget{widgets.length === 1 ? "" : "s"} on this dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {widgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No widgets yet — add one below.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {widgets.map((w) => (
                <div key={w.id} className="rounded-lg border bg-card p-3">
                  <p className="text-sm font-medium">{w.config.title}</p>
                  <p className="mt-1 text-2xs text-muted-foreground">
                    {w.config.kind}
                    {w.config.metricKey ? ` · ${w.config.metricKey}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Add widget</CardTitle>
          <CardDescription>Configure a new chart, KPI, or table tile.</CardDescription>
        </CardHeader>
        <CardContent>
          <StudioWidgetForm dashboardId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
