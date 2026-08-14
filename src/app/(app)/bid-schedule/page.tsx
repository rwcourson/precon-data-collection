import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { NewPursuitDialog } from "@/components/bid-schedule/new-pursuit-dialog";
import { ExportDialog } from "@/components/bid-schedule/export-dialog";
import { BidScheduleSheet } from "@/components/bid-schedule/sheet-table";
import { PageHeader } from "@/components/page-header";
import { UrlSelect } from "@/components/url-select";
import { getReferenceValues } from "@/lib/queries";
import {
  listCustomColumnsForPrincipal,
  listRoundsWithJobsForPrincipal,
} from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { allowedTransitions, canEditBidSchedule } from "@/lib/permissions";
import {
  BID_SCHEDULE_GROUP_OPTIONS,
  BID_SCHEDULE_SORT_OPTIONS,
  parseBidScheduleGroupBy,
  parseBidScheduleSort,
} from "@/lib/bid-schedule";
import { calendarDate } from "@/lib/overview-queues";
import { getWorkspace } from "@/lib/workspace-server";
import { db } from "@/db";
import { reportTemplates } from "@/db/schema";
import type { RoundStatus } from "@/db/schema";
import { listBidScheduleViews } from "@/actions/bid-schedule-views";

const SECTIONS: { key: string; label: string; statuses: RoundStatus[] }[] = [
  { key: "all", label: "All", statuses: ["active", "upcoming", "outstanding"] },
  { key: "active", label: "Active", statuses: ["active"] },
  { key: "upcoming", label: "Upcoming", statuses: ["upcoming"] },
  { key: "outstanding", label: "Outstanding", statuses: ["outstanding"] },
];

const QUEUE_LABELS: Record<string, string> = {
  "past-due": "Active rounds past bid due",
  unlinked: "Unlinked TBD jobs",
};

export default async function BidSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [principal, workspace] = await Promise.all([getWebPrincipal(), getWorkspace()]);
  const user = principal.user;
  const [rows, lists, templates, customCols, views] = await Promise.all([
    listRoundsWithJobsForPrincipal(principal),
    getReferenceValues(),
    db.select().from(reportTemplates),
    listCustomColumnsForPrincipal(principal),
    listBidScheduleViews(),
  ]);

  const activeViewId = params.view ? Number(params.view) : undefined;
  const activeView =
    activeViewId && Number.isInteger(activeViewId)
      ? views.find((v) => v.id === activeViewId)
      : undefined;

  const section = SECTIONS.find((s) => s.key === (params.section ?? "all")) ?? SECTIONS[0];
  const region = workspace.region ?? params.region ?? "all";
  const groupBy = parseBidScheduleGroupBy(params.group);
  const sort = parseBidScheduleSort(params.sort, params.dir);
  const density = params.density === "detail" ? "detail" : "summary";
  const queue = params.queue;
  const todayKey = calendarDate(new Date());

  const preBid = rows.filter((r) =>
    ["active", "upcoming", "outstanding"].includes(r.round.status),
  );
  const counts = Object.fromEntries(
    SECTIONS.map((s) => [
      s.key,
      preBid.filter(
        (r) =>
          s.statuses.includes(r.round.status) &&
          (region === "all" || r.round.region === region),
      ).length,
    ]),
  );

  let scoped = preBid
    .filter((r) => section.statuses.includes(r.round.status))
    .filter((r) => region === "all" || r.round.region === region);

  if (queue === "past-due") {
    scoped = scoped.filter(
      (r) => r.round.status === "active" && r.round.bidDueDate != null && r.round.bidDueDate < todayKey,
    );
  } else if (queue === "unlinked") {
    scoped = scoped.filter((r) => !r.job.isLinked);
  }

  const canEdit = canEditBidSchedule(user);
  const queryParams: Record<string, string | undefined> = {
    region: region !== "all" ? region : undefined,
    section: section.key !== "all" ? section.key : undefined,
    group: groupBy !== "none" ? groupBy : undefined,
    sort: sort.field !== "bidDueDate" ? sort.field : undefined,
    dir: sort.dir !== "asc" ? sort.dir : undefined,
    density: density !== "summary" ? density : undefined,
    queue,
    view: activeView ? String(activeView.id) : undefined,
  };
  const queryString = new URLSearchParams(
    Object.entries(queryParams).filter(([, v]) => Boolean(v)) as [string, string][],
  ).toString();

  const siblingsByJobId: Record<
    number,
    {
      id: number;
      estimatePhase: string;
      bidDueDate: string | null;
      status: RoundStatus;
      roundNumber: number;
    }[]
  > = {};
  for (const { round, job } of rows) {
    (siblingsByJobId[job.id] ??= []).push({
      id: round.id,
      estimatePhase: round.estimatePhase,
      bidDueDate: round.bidDueDate,
      status: round.status,
      roundNumber: round.roundNumber,
    });
  }

  const sheetRows = scoped.map(({ round, job, estimateLeadName }) => ({
    id: round.id,
    jobId: job.id,
    jobNumber: job.jobNumber,
    jobName: job.jobName,
    region: round.region,
    preconDepartment: round.preconDepartment,
    marketSector: round.marketSector,
    contractType: round.contractType,
    procurement: round.procurement,
    mlt: round.mlt,
    statusAtPricing: round.statusAtPricing,
    roundNumber: round.roundNumber,
    estimatePhase: round.estimatePhase,
    bidYear: round.bidYear,
    drawingsDueDate: round.drawingsDueDate,
    bidReviewDate: round.bidReviewDate,
    bidDueDate: round.bidDueDate,
    projectStartDate: round.projectStartDate,
    city: round.city,
    state: round.state,
    estimateLeadName,
    estimateValue: round.estimateValue,
    status: round.status,
    isLinked: job.isLinked,
    allowed: canEdit ? allowedTransitions(user, round) : [],
  }));

  const sectionHref = (key: string) => {
    const p = new URLSearchParams();
    if (region !== "all") p.set("region", region);
    p.set("section", key);
    if (groupBy !== "none") p.set("group", groupBy);
    if (sort.field !== "bidDueDate") p.set("sort", sort.field);
    if (sort.dir !== "asc") p.set("dir", sort.dir);
    if (density !== "summary") p.set("density", density);
    return `/bid-schedule?${p.toString()}`;
  };

  const shareLabel =
    principal.workspace.kind === "region"
      ? `Share with ${principal.workspace.region}`
      : "Share company-wide";

  return (
    <div className="space-y-3">
      <PageHeader
        title="Bid Schedule"
        description={`Pre-bid pursuit pipeline — standalone module, independent of post-bid data entry. ${
          workspace.region ? `${workspace.region} workspace.` : "Corporate view — all Regions."
        }`}
        actions={
          <>
            <ExportDialog
              queryString={queryString}
              templates={templates.map((t) => ({ id: t.id, name: t.name, config: t.config }))}
              customCols={customCols.map((c) => ({
                key: `custom:${c.id}`,
                label: `${c.label} (${c.region ?? "company"})`,
              }))}
            />
            {canEdit && <NewPursuitDialog lists={lists} />}
          </>
        }
      />

      {queue && QUEUE_LABELS[queue] && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-info-border bg-info-soft px-3 py-2 text-[13px] text-info-foreground">
          <span>Queue · {QUEUE_LABELS[queue]}</span>
          <Link href={sectionHref(section.key)} className="text-2xs font-medium hover:underline">
            Clear
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded bg-muted p-0.5">
          {SECTIONS.map((s) => (
            <Link
              key={s.key}
              href={sectionHref(s.key)}
              className={`flex shrink-0 items-center rounded px-2.5 py-1 text-[13px] font-medium transition-colors ${
                section.key === s.key
                  ? "bg-card text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
              <Badge variant="secondary" size="sm" className="ml-1.5">
                {counts[s.key]}
              </Badge>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {workspace.region == null && (
            <UrlSelect
              pathname="/bid-schedule"
              param="region"
              value={region}
              currentParams={queryParams}
              omitValues={["all"]}
              options={[
                { value: "all", label: "All Regions" },
                ...(lists.region ?? []).map((r) => ({ value: r, label: r })),
              ]}
            />
          )}
          <UrlSelect
            pathname="/bid-schedule"
            param="density"
            value={density}
            currentParams={queryParams}
            omitValues={["summary"]}
            className="min-w-[8.5rem]"
            options={[
              { value: "summary", label: "Summary" },
              { value: "detail", label: "Detail" },
            ]}
          />
          <UrlSelect
            pathname="/bid-schedule"
            param="group"
            value={groupBy}
            currentParams={queryParams}
            omitValues={["none"]}
            className="min-w-[9.5rem]"
            options={BID_SCHEDULE_GROUP_OPTIONS}
          />
          <UrlSelect
            pathname="/bid-schedule"
            param="sort"
            value={sort.field}
            currentParams={queryParams}
            omitValues={["bidDueDate"]}
            className="min-w-[9.5rem]"
            options={BID_SCHEDULE_SORT_OPTIONS.map((o) => ({
              value: o.value,
              label: `Sort: ${o.label}`,
            }))}
          />
          <UrlSelect
            pathname="/bid-schedule"
            param="dir"
            value={sort.dir}
            currentParams={queryParams}
            omitValues={["asc"]}
            className="min-w-[7.5rem]"
            options={[
              { value: "asc", label: "Ascending" },
              { value: "desc", label: "Descending" },
            ]}
          />
        </div>
      </div>

      <BidScheduleSheet
        key={`${density}-${activeView?.id ?? "none"}`}
        rows={sheetRows}
        canEdit={canEdit}
        lists={lists}
        groupBy={groupBy}
        sort={sort}
        density={density}
        initialColumns={activeView?.config.columns}
        siblingsByJobId={siblingsByJobId}
        views={views}
        currentUserId={user.id}
        activeViewId={activeView?.id}
        viewConfig={{
          section: section.key,
          group: groupBy,
          sort: sort.field,
          dir: sort.dir,
          region: region !== "all" ? region : undefined,
          queue,
          density,
        }}
        shareLabel={shareLabel}
      />
    </div>
  );
}
