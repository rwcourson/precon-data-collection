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
import { parseHierarchyFromSearchParams } from "@/lib/bid-schedule-filter";
import { fmtDollars } from "@/lib/format";
import { STATUS_ORDER } from "@/lib/labels";
import { buildOverviewQueues } from "@/lib/overview-queues";
import { getMultiValuesForRounds } from "@/lib/queries";
import { missingRequiredFields } from "@/lib/validation";
import { getWorkspace } from "@/lib/workspace-server";

export default async function OverviewPage() {
  const workspace = await getWorkspace();
  const principal = await getWebPrincipal();
  const user = principal.user;
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
        ? missingRequiredFields(round, multiMap.get(round.id) ?? {}, {
            jobNumber: job.jobNumber,
            jobName: job.jobName,
            estimateLeadName,
          }).length
        : 0,
      preconDepartment: round.preconDepartment,
      teamAssignedAt: round.teamAssignedAt,
    })),
    new Date(),
    hierarchy
  );

  const kpis = [
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
      sub: `${wins} of ${decided} decided rounds`,
    },
  ];

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
              <Link key={q.id} href={q.href} className="group">
                <Card className="h-full transition-colors group-hover:bg-info-soft/60">
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
                  {q.preview.length > 0 && (
                    <CardContent className="pt-0">
                      <ul className="space-y-1">
                        {q.preview.map((item) => (
                          <li
                            key={item.roundId}
                            className="truncate text-[13px] text-muted-foreground"
                          >
                            <span className="font-mono">{item.jobNumber}</span>
                            {" · "}
                            {item.jobName}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  )}
                </Card>
              </Link>
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
          {modules.map(({ href, icon: Icon, title, desc }) => (
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
