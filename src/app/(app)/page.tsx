import {
  ArrowRight,
  CalendarRange,
  ClipboardList,
  FileBarChart2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { UnlinkedSyncCard } from "@/components/overview/unlinked-sync-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { RoundStatus } from "@/db/schema";
import { principalCanIntegrate } from "@/lib/authorization/decisions";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import {
  awardableCoverage,
  shadowAwardableHitRate,
  shadowAwardableHitRateByLead,
  shadowAwardableHitRateBySector,
  toAwardableReportingRows,
} from "@/lib/awardable-reporting";
import { parseHierarchyFromSearchParams } from "@/lib/bid-schedule-filter";
import { fmtDollars } from "@/lib/format";
import { STATUS_ORDER } from "@/lib/labels";
import { buildOverviewQueues } from "@/lib/overview-queues";
import { getMultiValuesForRounds } from "@/lib/queries";
import { missingRequiredFields } from "@/lib/validation";
import { getWorkspace } from "@/lib/workspace-server";
import { loadNotApplicableKeysByRound } from "@/services/field-exceptions-service";
import { roundtableFeaturesFor } from "@/services/rollout-service";

export default async function OverviewPage() {
  const workspace = await getWorkspace();
  const principal = await getWebPrincipal();
  const user = principal.user;
  const features = await roundtableFeaturesFor(principal);
  const regionRows = await listRoundsWithJobsForPrincipal(principal);

  const byStatus = new Map<RoundStatus, number>();
  for (const s of STATUS_ORDER) byStatus.set(s, 0);
  for (const r of regionRows)
    byStatus.set(r.round.status, (byStatus.get(r.round.status) ?? 0) + 1);

  const ytd = regionRows.filter((r) => r.round.bidYear === 2026);
  const ytdVolume = ytd.reduce(
    (sum, r) => sum + (r.round.estimateValue ?? 0),
    0
  );
  const awaitingPostBid = regionRows.filter((r) =>
    ["submitted", "post_bid"].includes(r.round.status)
  );
  const awaitingApproval = regionRows.filter(
    (r) => r.round.status === "post_bid"
  );
  const locked2026 = ytd.filter((r) => r.round.status === "locked");
  const wins = locked2026.filter(
    (r) => r.round.outcome === "successful"
  ).length;
  const decided = locked2026.filter(
    (r) => r.round.outcome !== "pending"
  ).length;
  const awardableTotal = locked2026.reduce(
    (sum, item) => sum + (item.round.awardableAmount ?? 0),
    0
  );
  const signedTotal = locked2026.reduce(
    (sum, item) => sum + (item.round.contractAmountSigned ?? 0),
    0
  );
  const awardableRows = toAwardableReportingRows(
    locked2026.map(({ round, estimateLeadName }) => ({
      ...round,
      estimateLeadName,
    })),
    await loadNotApplicableKeysByRound(locked2026.map(({ round }) => round.id))
  );
  const awardableCover = awardableCoverage(awardableRows);
  const awardableHit = shadowAwardableHitRate(awardableRows);
  const awardableHitBySector = shadowAwardableHitRateBySector(awardableRows);
  const awardableHitByLead = shadowAwardableHitRateByLead(awardableRows);

  const scopeLabel = workspace.region ?? "All Regions";

  const postBidIds = regionRows
    .filter((r) => ["submitted", "post_bid"].includes(r.round.status))
    .map((r) => r.round.id);
  const multiMap = await getMultiValuesForRounds(postBidIds);
  const allowedRegions =
    principal.allowedRegions === "all"
      ? ("all" as const)
      : principal.allowedRegions;
  const hierarchy = parseHierarchyFromSearchParams(
    {},
    { workspaceRegion: workspace.region, allowedRegions }
  );
  const queues = buildOverviewQueues(
    regionRows.map(({ round, job, estimateLeadName }) => ({
      roundId: round.id,
      jobId: job.id,
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      status: round.status,
      bidDueDate: round.bidDueDate,
      isLinked: job.isLinked,
      missingRequiredCount: ["submitted", "post_bid"].includes(round.status)
        ? missingRequiredFields(
            round,
            multiMap.get(round.id) ?? {},
            {
              jobNumber: job.jobNumber,
              jobName: job.jobName,
              estimateLeadName,
            },
            {},
            { fieldPolicy: features.fieldPolicy }
          ).length
        : 0,
      preconDepartment: round.preconDepartment,
      teamAssignedAt: round.teamAssignedAt,
      estimateLeadId: round.estimateLeadId,
    })),
    new Date(),
    hierarchy,
    {
      uniqueJobs: features.scheduleProjection,
      owedLeadId:
        principal.user.role === "estimate_lead" ? principal.user.id : undefined,
    }
  );

  const kpis: { label: string; value: string; sub: string }[] = [
    {
      label: `2026 Pursuit Volume — ${scopeLabel}`,
      value: fmtDollars(ytdVolume, true),
      sub: `${ytd.length} estimate rounds`,
    },
    {
      label: "Awaiting Post-Bid Data",
      value: String(awaitingPostBid.length),
      sub: "Submitted or in data entry",
    },
    {
      label: "Awaiting RPD Approval",
      value: String(awaitingApproval.length),
      sub: "In post-bid data entry",
    },
    {
      label: "2026 Win Rate (decided)",
      value: decided > 0 ? `${Math.round((wins / decided) * 100)}%` : "—",
      sub: `${wins} of ${decided} decided rounds · legacy count definition`,
    },
  ];
  if (features.awardableReporting) {
    kpis.push(
      {
        label: "Awardable conversion (shadow)",
        value:
          awardableTotal > 0
            ? `${Math.round((signedTotal / awardableTotal) * 100)}%`
            : "—",
        sub: `${fmtDollars(signedTotal, true)} signed of ${fmtDollars(awardableTotal, true)} awardable`,
      },
      {
        label: "Awardable data coverage",
        value:
          awardableCover.coverage != null
            ? `${Math.round(awardableCover.coverage * 100)}%`
            : "—",
        sub: `${awardableCover.withAwardable} of ${awardableCover.locked} locked · ${awardableCover.grain}`,
      },
      {
        label: "Awardable hit rate (shadow)",
        value:
          awardableHit.rate != null
            ? `${Math.round(awardableHit.rate * 100)}%`
            : "—",
        sub: `${awardableHit.wins} of ${awardableHit.attempts} · ${awardableHit.grain}`,
      },
      {
        label: "Awardable hit by sector (shadow)",
        value:
          awardableHitBySector[0]?.rate != null
            ? `${Math.round(awardableHitBySector[0].rate * 100)}%`
            : "—",
        sub:
          awardableHitBySector.length === 0
            ? awardableHit.grain
            : awardableHitBySector
                .map((row) => `${row.sector} ${row.wins}/${row.attempts}`)
                .join(" · "),
      },
      {
        label: "Awardable hit by lead (shadow)",
        value:
          awardableHitByLead[0]?.rate != null
            ? `${Math.round(awardableHitByLead[0].rate * 100)}%`
            : "—",
        sub:
          awardableHitByLead.length === 0
            ? awardableHit.grain
            : awardableHitByLead
                .map((row) => `${row.lead} ${row.wins}/${row.attempts}`)
                .join(" · "),
      }
    );
  }

  const modules = [
    {
      href: "/bid-schedule",
      icon: CalendarRange,
      title: "Bid Schedule",
      desc: "Active, Upcoming, and Outstanding pursuits — create pursuits, add estimate rounds, export to Excel/PDF.",
    },
    {
      href: "/post-bid",
      icon: ClipboardList,
      title: "Post-Bid Entry",
      desc: "Complete the required data set for submitted rounds. Validation blocks approval until every required field is filled.",
    },
    {
      href: "/dashboards",
      icon: FileBarChart2,
      title: "Dashboards",
      desc: "Division, Region, and Corporate rollups with calculated metrics and multi-year trends.",
    },
    {
      href: "/admin",
      icon: ShieldCheck,
      title: "Governance",
      desc: "Managed reference lists, two-tier column governance, and the full audit trail.",
    },
  ];
  const visibleModules = modules.filter(({ href }) => {
    if (["pcm", "estimate_lead"].includes(user.role)) {
      return href === "/bid-schedule" || href === "/post-bid";
    }
    if (user.role === "leadership") return href !== "/admin";
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description={`${scopeLabel} — this week’s queues, then the pipeline.`}
      />

      <div>
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Action queues
          </h2>
          <Separator className="flex-1" />
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {queues.map((q) =>
            q.id === "unlinked" ? (
              <UnlinkedSyncCard
                key={q.id}
                title={q.title}
                description={q.description}
                href={q.href}
                count={q.count}
                preview={q.preview}
                canSync={principalCanIntegrate(principal)}
              />
            ) : (
              <Card key={q.id} className="h-full">
                <Link href={q.href} className="group block">
                  <div className="transition-colors group-hover:bg-info-soft/60">
                    <CardHeader className="gap-1.5 pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardDescription className="text-[13px] font-medium text-foreground">
                            {q.title}
                          </CardDescription>
                          <CardTitle className="font-mono text-xl font-medium tabular-nums">
                            {q.count}
                          </CardTitle>
                        </div>
                        <ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </div>
                      <CardDescription>{q.description}</CardDescription>
                    </CardHeader>
                  </div>
                </Link>
                {q.preview.length > 0 && (
                  <CardContent className="pt-0">
                    <ul className="space-y-1">
                      {q.preview.map((item) => (
                        <li
                          key={item.roundId}
                          className="truncate rounded px-1 py-0.5 text-[13px] text-muted-foreground hover:bg-info-soft hover:text-foreground"
                        >
                          <Link
                            href={`/jobs/${item.jobId}`}
                            className="font-mono hover:underline"
                          >
                            {item.jobNumber.startsWith("TBD-")
                              ? "Pending job number"
                              : item.jobNumber}
                          </Link>
                          {" · "}
                          <Link
                            href={`/rounds/${item.roundId}`}
                            className="hover:underline"
                          >
                            {item.jobName}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                )}
              </Card>
            )
          )}
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-0.5">
              <CardDescription className="text-[13px]">
                {k.label}
              </CardDescription>
              <CardTitle className="font-mono text-xl font-medium tabular-nums">
                {k.value}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] text-muted-foreground">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Pipeline by status</CardTitle>
          <CardDescription>
            Every estimate round moves through an explicit, audited lifecycle —
            no checkbox automations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {STATUS_ORDER.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className="flex items-center gap-2 rounded bg-muted/50 px-2.5 py-1.5">
                  <StatusBadge status={s} />
                  <span className="font-mono text-[13px] font-medium tabular-nums">
                    {byStatus.get(s)}
                  </span>
                </div>
                {i < STATUS_ORDER.length - 1 && (
                  <ArrowRight className="size-3 shrink-0 text-muted-foreground/60" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Jump in</h2>
          <Separator className="flex-1" />
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {visibleModules.map(({ href, icon: Icon, title, desc }) => (
            <Link key={href} href={href} className="group">
              <Card className="h-full transition-colors group-hover:bg-muted/40">
                <CardHeader className="gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                      <CardTitle>{title}</CardTitle>
                    </div>
                    <ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                  <CardDescription>{desc}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
