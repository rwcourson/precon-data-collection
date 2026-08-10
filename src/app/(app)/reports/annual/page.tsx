import Link from "next/link";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { PageHeader } from "@/components/page-header";
import { UrlSelect } from "@/components/url-select";
import { toOptions } from "@/lib/select-options";
import { buildAnnualReport } from "@/lib/annual-report";
import { fmtDollars, fmtPercent } from "@/lib/format";
import { getReferenceValues } from "@/lib/queries";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { getWorkspace } from "@/lib/workspace-server";

export default async function AnnualReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [principal, workspace] = await Promise.all([getWebPrincipal(), getWorkspace()]);
  const [rows, lists] = await Promise.all([
    listRoundsWithJobsForPrincipal(principal),
    getReferenceValues(),
  ]);

  const availableYears = [...new Set(rows.map((r) => r.round.bidYear))].sort();
  const latest = availableYears.at(-1) ?? new Date().getFullYear();
  const earliest = availableYears[0] ?? latest;

  const toYear = pickYear(params.to, availableYears, latest);
  const fromYear = Math.min(pickYear(params.from, availableYears, Math.max(earliest, toYear - 2)), toYear);
  const regionParam = workspace.region ?? params.region ?? "all";
  const region = regionParam === "all" ? null : regionParam;

  const report = buildAnnualReport({ rows, region, fromYear, toYear });

  const exportQuery = new URLSearchParams({
    from: String(fromYear),
    to: String(toYear),
    ...(region ? { region } : {}),
  }).toString();

  const currentParams = {
    from: String(fromYear),
    to: String(toYear),
    region: regionParam,
  };

  const yearOptions = toOptions(availableYears.map(String));

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2.5 gap-1.5 px-2.5 text-muted-foreground"
        nativeButton={false}
        render={<Link href="/reports" />}
      >
        <ArrowLeft className="size-4" /> Report Builder
      </Button>

      <PageHeader
        title="Annual Regional Report"
        description={`Leadership-ready summary of ${report.scope} preconstruction activity across bid years ${fromYear}–${toYear} — multi-year trends, the year's scorecard, sector and department breakdowns, and the wins.`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              nativeButton={false}
              render={<a href={`/api/export/annual?format=xlsx&${exportQuery}`} />}
            >
              <Download className="size-4" /> Excel
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              nativeButton={false}
              render={
                <a
                  href={`/api/export/annual?format=pdf&${exportQuery}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <FileText className="size-4" /> PDF
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {workspace.region == null && (
          <UrlSelect
            pathname="/reports/annual"
            param="region"
            value={regionParam}
            currentParams={currentParams}
            options={[
              { value: "all", label: "Corporate — All Regions" },
              ...(lists.region ?? []).map((r) => ({ value: r, label: r })),
            ]}
          />
        )}
        <UrlSelect
          pathname="/reports/annual"
          param="from"
          value={String(fromYear)}
          currentParams={currentParams}
          options={yearOptions}
        />
        <span className="text-xs text-muted-foreground">through</span>
        <UrlSelect
          pathname="/reports/annual"
          param="to"
          value={String(toYear)}
          currentParams={currentParams}
          options={yearOptions}
        />
      </div>

      {report.emptyReason ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {report.emptyReason}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: `${report.focusYear} Pursuit Volume`, value: fmtDollars(report.focus.volume, true), sub: `${report.focus.rounds} estimate rounds` },
              { label: "Win Rate by Value", value: fmtPercent(report.focus.winRateByValue), sub: `${fmtDollars(report.focus.wonVolume, true)} won` },
              { label: "Expected Fee", value: fmtDollars(report.focus.totalFee, true), sub: `${fmtPercent(report.focus.weightedFeePct)} of volume` },
              { label: "Revenue per PM Year", value: fmtDollars(report.focus.revenuePerPmYear, true), sub: `${Math.round(report.focus.totalPmMonths).toLocaleString()} PM months` },
            ].map((k) => (
              <Card key={k.label} className="gap-2 py-3">
                <CardHeader className="pb-0">
                  <CardDescription className="text-2xs">{k.label}</CardDescription>
                  <CardTitle className="font-mono text-lg font-medium tabular-nums">
                    {k.value}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xs text-muted-foreground">{k.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Bid year trend</CardTitle>
              <CardDescription>
                Every estimate round counts as its own record, matching how the
                Project Estimate Summary reports volume.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Bid Year</TableHead>
                    <TableHead className="text-right">Rounds</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Won Volume</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                    <TableHead className="text-right">Fee %</TableHead>
                    <TableHead className="pr-4 text-right">Fee / PM Mo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.years.map(({ year, stats }) => (
                    <TableRow key={year}>
                      <TableCell className="pl-6 font-medium">{year}</TableCell>
                      <TableCell className="text-right tabular-nums">{stats.rounds}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtDollars(stats.volume, true)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtDollars(stats.wonVolume, true)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPercent(stats.winRate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPercent(stats.weightedFeePct)}</TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">{fmtDollars(stats.feePerPmMonth, true)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <GroupCard
              title={`${report.focusYear} by market sector`}
              groupLabel="Market Sector"
              groups={report.bySector}
            />
            <GroupCard
              title={`${report.focusYear} by precon department`}
              groupLabel="Precon Department"
              groups={report.byDepartment}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{report.focusYear} wins</CardTitle>
              <CardDescription>
                Largest successful outcomes recorded for the year.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Project</TableHead>
                    <TableHead>Market Sector</TableHead>
                    <TableHead>Precon Department</TableHead>
                    <TableHead className="pr-4 text-right">Estimate Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.wins.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                        No successful outcomes recorded for {report.focusYear} yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {report.wins.map((w) => (
                    <TableRow key={`${w.jobNumber}-${w.jobName}-${w.estimatePhase}`}>
                      <TableCell className="pl-6">
                        <span className="font-medium">{w.jobName}</span>
                        <p className="text-xs text-muted-foreground">
                          #{w.jobNumber} · {w.estimatePhase}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">{w.marketSector ?? "—"}</TableCell>
                      <TableCell className="text-sm">{w.preconDepartment}</TableCell>
                      <TableCell className="pr-4 text-right text-sm tabular-nums">
                        {fmtDollars(w.estimateValue, true)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function GroupCard({
  title,
  groupLabel,
  groups,
}: {
  title: string;
  groupLabel: string;
  groups: { key: string; rounds: number; volume: number; winRate: number | null; weightedFeePct: number | null }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">{groupLabel}</TableHead>
              <TableHead className="text-right">Rounds</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right">Win Rate</TableHead>
              <TableHead className="pr-4 text-right">Fee %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.slice(0, 12).map((g) => (
              <TableRow key={g.key}>
                <TableCell className="pl-6 text-sm font-medium">{g.key}</TableCell>
                <TableCell className="text-right tabular-nums">{g.rounds}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtDollars(g.volume, true)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPercent(g.winRate)}</TableCell>
                <TableCell className="pr-4 text-right tabular-nums">{fmtPercent(g.weightedFeePct)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function pickYear(raw: string | undefined, available: number[], fallback: number): number {
  const n = Number(raw);
  return available.includes(n) ? n : fallback;
}
