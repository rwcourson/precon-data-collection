import {
  TrendChart,
  VolumeByGroupChart,
  VolumeByYearChart,
} from "@/components/dashboards/charts";
import { ExportActions } from "@/components/export-actions";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ToolbarSegment,
  ToolbarSegmented,
} from "@/components/ui/toolbar-controls";
import { UrlSelect } from "@/components/url-select";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { fmtDollars, fmtPercent } from "@/lib/format";
import { getReferenceValues } from "@/lib/queries";
import {
  applyLeadershipRoundScope,
  computeStats,
  defaultDashboardStatus,
  parseLeadershipRoundMode,
  rollup,
  scopeRoundsForDashboardExport,
} from "@/lib/rollup";
import { toOptions } from "@/lib/select-options";
import { getWorkspace } from "@/lib/workspace-server";
import { maskRoundRowsForMetrics } from "@/services/field-exceptions-service";

const LEVELS = [
  { key: "corporate", label: "Corporate", groupLabel: "Region" },
  { key: "region", label: "Region", groupLabel: "Division / Precon Dept" },
  { key: "division", label: "Division", groupLabel: "Market Sector" },
] as const;

export default async function DashboardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [principal, workspace] = await Promise.all([
    getWebPrincipal(),
    getWorkspace(),
  ]);
  const user = principal.user;
  const [listed, lists] = await Promise.all([
    listRoundsWithJobsForPrincipal(principal),
    getReferenceValues(),
  ]);
  const rows = await maskRoundRowsForMetrics(listed);

  // A Region workspace has no Corporate rollup — that view belongs to Corporate.
  const levels =
    workspace.region == null
      ? LEVELS
      : LEVELS.filter((l) => l.key !== "corporate");
  const level =
    levels.find((l) => l.key === (params.level ?? levels[0].key)) ?? levels[0];
  const region =
    workspace.region ??
    params.region ??
    user.region ??
    lists.region?.[0] ??
    "Central";
  const dept = params.dept ?? "all";
  const sector = params.sector ?? "all";
  const year = params.year ?? "all";
  const phase = params.phase ?? "all";
  const status = params.status ?? defaultDashboardStatus(user.role);
  const roundMode = parseLeadershipRoundMode(params.rounds);

  const scoped = scopeRoundsForDashboardExport(
    rows.map((r) => r.round),
    {
      region: level.key === "corporate" ? null : region,
      dept: level.key === "division" ? dept : null,
      sector,
      year,
      phase,
      status,
      rounds: params.rounds,
    }
  );

  const totals = computeStats("all", scoped);

  const groupFn =
    level.key === "corporate"
      ? (r: (typeof scoped)[number]) => r.region
      : level.key === "region"
        ? (r: (typeof scoped)[number]) => r.preconDepartment
        : (r: (typeof scoped)[number]) => r.marketSector ?? "Unclassified";
  const groups = rollup(scoped, groupFn);

  // Multi-year trend series (ignores the bid-year filter so trends stay multi-year)
  let trendBase = applyLeadershipRoundScope(
    rows.map((r) => r.round),
    roundMode
  );
  if (level.key !== "corporate")
    trendBase = trendBase.filter((r) => r.region === region);
  if (level.key === "division" && dept !== "all")
    trendBase = trendBase.filter((r) => r.preconDepartment === dept);

  const years = [...new Set(trendBase.map((r) => r.bidYear))].sort();
  const regions = lists.region ?? [];
  const volumeByYear = years.map((y) => {
    const row: Record<string, number | string> = { year: y };
    if (level.key === "corporate") {
      for (const reg of regions) {
        row[reg] = trendBase
          .filter((r) => r.bidYear === y && r.region === reg)
          .reduce((s, r) => s + (r.estimateValue ?? 0), 0);
      }
    } else {
      row.Volume = trendBase
        .filter((r) => r.bidYear === y)
        .reduce((s, r) => s + (r.estimateValue ?? 0), 0);
    }
    return row;
  });
  const volumeSeries = level.key === "corporate" ? regions : ["Volume"];

  const trendData = years.map((y) => {
    const stats = computeStats(
      String(y),
      trendBase.filter((r) => r.bidYear === y)
    );
    return {
      year: y,
      winRate: stats.winRate,
      feePct: stats.avgFeePct,
      contingencyPct: stats.avgContingencyPct,
    };
  });

  const kpis = [
    {
      label: "Pursuit Volume",
      value: fmtDollars(totals.volume, true),
      sub:
        roundMode === "latest"
          ? `${totals.rounds} jobs (latest / final round)`
          : `${totals.rounds} estimate rounds`,
    },
    {
      label: "Win Rate",
      value: fmtPercent(totals.winRate),
      sub: `${totals.wins} of ${totals.decided} decided`,
    },
    {
      label: "Fee % (Expected)",
      value: fmtPercent(totals.weightedFeePct),
      sub: "Dollar-weighted across the portfolio",
    },
    {
      label: "Contingency %",
      value: fmtPercent(totals.weightedContingencyPct),
      sub: "Dollar-weighted across the portfolio",
    },
    {
      label: "Fee per PM Month",
      value: fmtDollars(totals.feePerPmMonth, true),
      sub: "Total fee ÷ total PM months",
    },
  ];

  const secondaryKpis = [
    {
      label: "Win Rate by Value",
      value: fmtPercent(totals.winRateByValue),
      sub: `${fmtDollars(totals.wonVolume, true)} of ${fmtDollars(totals.decidedVolume, true)} decided`,
    },
    {
      label: "Revenue per PM Year",
      value: fmtDollars(totals.revenuePerPmYear, true),
      sub: `${totals.totalPmMonths.toLocaleString()} PM months`,
    },
    {
      label: "GC+GR % of Volume",
      value: fmtPercent(totals.weightedGcGrPct),
      sub: "B&G Sort, dollar-weighted",
    },
    {
      label: "Self-Perform Capture",
      value: fmtPercent(totals.selfPerformCaptureRate),
      sub: `${fmtDollars(totals.totalSelfPerform, true)} proposed`,
    },
    {
      label: "Craft Labor $ / Man Hour",
      value: fmtDollars(totals.laborCostPerManHour),
      sub: `${Math.round(totals.totalManHours).toLocaleString()} man hours`,
    },
    {
      label: "Estimate $ per GSF",
      value: fmtDollars(totals.costPerGsf),
      sub:
        totals.totalGsf > 0
          ? `${Math.round(totals.totalGsf).toLocaleString()} GSF reported`
          : "No GSF reported",
    },
  ];

  const qs = (patch: Record<string, string>) =>
    `/dashboards?${new URLSearchParams({
      level: level.key,
      region,
      dept,
      sector,
      year,
      phase,
      status,
      rounds: roundMode,
      ...patch,
    }).toString()}`;

  const filterParams = {
    level: level.key,
    region,
    dept,
    sector,
    year,
    phase,
    status,
    rounds: roundMode,
  };

  const exportQuery = new URLSearchParams({
    level: level.key,
    region,
    dept,
    sector,
    year,
    phase,
    status,
    rounds: roundMode,
  }).toString();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboards"
        description={
          level.key === "corporate"
            ? `Company-wide rollup. ${status === "locked" ? "Locked RPD-approved data only." : "Operator view includes in-flight data."}`
            : level.key === "region"
              ? `${region} Region rollup by Division/Precon Department.`
              : `${region} — ${dept === "all" ? "all Divisions" : dept} by Market Sector.`
        }
        actions={
          <ExportActions
            excelHref={`/api/export/dashboard?${exportQuery}`}
            pdfHref={`/api/export/dashboard?format=pdf&${exportQuery}`}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ToolbarSegmented>
          {levels.map((l) => (
            <ToolbarSegment
              key={l.key}
              href={qs({ level: l.key })}
              active={level.key === l.key}
            >
              {l.label}
            </ToolbarSegment>
          ))}
        </ToolbarSegmented>

        <div className="flex flex-wrap items-center gap-2">
          {level.key !== "corporate" && workspace.region == null && (
            <UrlSelect
              pathname="/dashboards"
              param="region"
              value={region}
              currentParams={filterParams}
              options={(lists.region ?? []).map((r) => ({
                value: r,
                label: r,
              }))}
            />
          )}
          {level.key === "division" && (
            <UrlSelect
              pathname="/dashboards"
              param="dept"
              value={dept}
              currentParams={filterParams}
              options={toOptions(
                ["all", ...(lists.preconDepartment ?? [])],
                "All Divisions"
              )}
            />
          )}
          <UrlSelect
            pathname="/dashboards"
            param="sector"
            value={sector}
            currentParams={filterParams}
            options={toOptions(
              ["all", ...(lists.marketSector ?? [])],
              "All Market Sectors"
            )}
          />
          <UrlSelect
            pathname="/dashboards"
            param="year"
            value={year}
            currentParams={filterParams}
            options={toOptions(
              ["all", ...(lists.bidYear ?? [])],
              "All Bid Years"
            )}
          />
          <UrlSelect
            pathname="/dashboards"
            param="phase"
            value={phase}
            currentParams={filterParams}
            options={toOptions(
              ["all", ...(lists.estimatePhase ?? [])],
              "All Phases"
            )}
          />
          <UrlSelect
            pathname="/dashboards"
            param="status"
            value={status}
            currentParams={filterParams}
            options={toOptions(
              [
                "all",
                "active",
                "upcoming",
                "outstanding",
                "submitted",
                "post_bid",
                "locked",
              ],
              "All Statuses"
            )}
          />
          <UrlSelect
            pathname="/dashboards"
            param="rounds"
            value={roundMode}
            currentParams={filterParams}
            options={[
              { value: "latest", label: "Latest / final round per job" },
              { value: "all", label: "All pricing rounds" },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} className="gap-2 py-3.5">
            <CardHeader className="pb-0">
              <CardDescription className="text-xs tracking-wide uppercase">
                {k.label}
              </CardDescription>
              <CardTitle className="font-mono text-xl font-medium tracking-tight tabular-nums">
                {k.value}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs leading-snug text-muted-foreground">
                {k.sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {secondaryKpis.map((k) => (
          <div key={k.label} className="rounded-lg border bg-card px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="font-mono text-base font-medium tabular-nums">
              {k.value}
            </p>
            <p className="text-xs text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Pursuit volume by Bid Year
            </CardTitle>
            <CardDescription>
              Each Estimate Round counts separately — five pricing rounds on one
              job contribute five records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VolumeByYearChart data={volumeByYear} series={volumeSeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Multi-year trends</CardTitle>
            <CardDescription>
              Win rate, fee %, and contingency % by bid year.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={trendData}
              percent
              lines={[
                { key: "winRate", label: "Win Rate" },
                { key: "feePct", label: "Avg Fee %" },
                { key: "contingencyPct", label: "Avg Contingency %" },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Volume by {level.groupLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VolumeByGroupChart
              data={groups.slice(0, 10).map((g) => ({
                name: g.key,
                volume: g.volume,
                rounds: g.rounds,
              }))}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Rollup by {level.groupLabel}
            </CardTitle>
            <CardDescription>
              Aggregated like today&apos;s Project Estimate Summary — computed
              server-side from the underlying records.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">{level.groupLabel}</TableHead>
                  <TableHead className="text-right">Rounds</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                  <TableHead className="text-right">Fee %</TableHead>
                  <TableHead className="text-right">GC+GR %</TableHead>
                  <TableHead className="text-right">Fee / PM Mo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.key}>
                    <TableCell className="pl-6 font-medium">{g.key}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {g.rounds}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtDollars(g.volume, true)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtPercent(g.winRate)}
                      {g.decided > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({g.wins}/{g.decided})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtPercent(g.weightedFeePct)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtPercent(g.weightedGcGrPct)}
                    </TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">
                      {fmtDollars(g.feePerPmMonth, true)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        <Badge variant="outline" size="sm" className="mr-1.5">
          Databricks / Power BI
        </Badge>
        This same read-optimized data set — including Region-specific custom
        columns — is exposed for downstream ingestion (mocked in this
        prototype).
      </p>
    </div>
  );
}
