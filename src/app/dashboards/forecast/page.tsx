import { Download } from "lucide-react";
import { ForecastVolumeChart } from "@/components/dashboards/charts";
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
import { fmtDollars } from "@/lib/format";
import {
  buildForecastSeries,
  DEFAULT_FORECAST_ASSUMPTIONS,
  resolveForecastTimingDate,
} from "@/lib/forecast";
import { getRoundsWithJobs } from "@/lib/queries";
import { getWorkspace } from "@/lib/workspace-server";

export default async function ForecastDashboardPage() {
  const workspace = await getWorkspace();
  const rounds = await getRoundsWithJobs(workspace);

  const series = buildForecastSeries(
    rounds.map((r) => ({
      id: r.round.id,
      jobId: r.job.id,
      jobNumber: r.job.jobNumber,
      jobName: r.job.jobName,
      estimateValue: r.round.estimateValue,
      timingDate: resolveForecastTimingDate({
        projectStartDate: r.round.projectStartDate,
        bidDueDate: r.round.bidDueDate,
      }),
      outcome: r.round.outcome,
      region: r.round.region,
    })),
    DEFAULT_FORECAST_ASSUMPTIONS,
  );

  const chartData = series.months.map((m) => ({
    month: m.month,
    objective: m.objective,
    adjusted: m.adjusted,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Volume projection"
        description={`Objective vs risk-adjusted preconstruction volume${workspace.region ? ` — ${workspace.region} Region` : " — corporate view"}. Raw round data is never modified.`}
        actions={
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
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="gap-2 py-3">
          <CardHeader className="pb-0">
            <CardDescription className="text-2xs">Objective total</CardDescription>
            <CardTitle className="font-mono text-lg font-medium tabular-nums">
              {fmtDollars(series.totals.objective, true)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-2 py-3">
          <CardHeader className="pb-0">
            <CardDescription className="text-2xs">Risk-adjusted total</CardDescription>
            <CardTitle className="font-mono text-lg font-medium tabular-nums">
              {fmtDollars(series.totals.adjusted, true)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-2 py-3">
          <CardHeader className="pb-0">
            <CardDescription className="text-2xs">Excluded rounds</CardDescription>
            <CardTitle className="font-mono text-lg font-medium tabular-nums">
              {series.excluded.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-2 py-3">
          <CardHeader className="pb-0">
            <CardDescription className="text-2xs">Months in series</CardDescription>
            <CardTitle className="font-mono text-lg font-medium tabular-nums">
              {series.months.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly volume curves</CardTitle>
          <CardDescription>
            Blue objective curve assumes 100% win at stated timing; green curve applies win
            probability and schedule slip to pending pursuits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No forecastable rounds in scope (missing estimate value or timing).
            </p>
          ) : (
            <ForecastVolumeChart data={chartData} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Assumptions</CardTitle>
          <CardDescription>Applied only to the adjusted curve — source data unchanged.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <Badge variant="outline" size="sm" className="mr-2">
              Pending win probability
            </Badge>
            {(series.assumptions.pendingWinProbability * 100).toFixed(0)}%
          </p>
          <p>
            <Badge variant="outline" size="sm" className="mr-2">
              Schedule slip
            </Badge>
            {series.assumptions.scheduleSlipMonths} months on pending pursuits
          </p>
          {series.excluded.length > 0 && (
            <p className="text-muted-foreground">
              {series.excluded.length} round{series.excluded.length === 1 ? "" : "s"} excluded
              (missing estimate value or timing date).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
