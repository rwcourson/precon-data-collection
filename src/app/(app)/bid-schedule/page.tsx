import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { NewPursuitDialog } from "@/components/bid-schedule/new-pursuit-dialog";
import { ExportDialog } from "@/components/bid-schedule/export-dialog";
import { BidScheduleSheet } from "@/components/bid-schedule/sheet-table";
import { PageHeader } from "@/components/page-header";
import { UrlSelect } from "@/components/url-select";
import { RegionMarketFilter } from "@/components/bid-schedule/region-market-filter";
import { getReferenceValues } from "@/lib/queries";
import { regionDepartmentTree } from "@/lib/region-departments";
import { parseBidScheduleViewConfig } from "@/lib/view-config";
import { BID_SCHEDULE_SURFACE, resolveBidScheduleTableState } from "@/lib/table-prefs";
import {
  filterByHierarchy,
  parseHierarchyFromSearchParams,
  serializeHierarchy,
} from "@/lib/bid-schedule-filter";
import {
  listCustomColumnsForPrincipal,
  listRoundsWithJobsForPrincipal,
} from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { allowedTransitions } from "@/lib/authorization/lifecycle";
import {
  principalCanEditBidSchedule,
  principalCanMarkStaffing,
} from "@/lib/authorization/decisions";
import { NEEDS_STAFFING_QUEUE } from "@/lib/staffing";
import {
  BID_SCHEDULE_GROUP_OPTIONS,
  BID_SCHEDULE_SORT_OPTIONS,
  bidSchedulePrefsHref,
  bidScheduleViewHref,
  parseBidScheduleGroupBy,
  parseBidScheduleSort,
} from "@/lib/bid-schedule";
import { inArray } from "drizzle-orm";
import { calendarDate } from "@/lib/overview-queues";
import { getWorkspace } from "@/lib/workspace-server";
import { db } from "@/db";
import { jobRegionVisibility, reportTemplates } from "@/db/schema";
import type { RoundStatus } from "@/db/schema";
import { listBidScheduleViews } from "@/actions/bid-schedule-views";
import { notesService } from "@/services/notes-service";
import { tablePrefsService } from "@/services/table-prefs-service";
import { TablePrefsDensitySync } from "@/components/bid-schedule/table-prefs-density-sync";

const SECTIONS: { key: string; label: string; statuses: RoundStatus[] }[] = [
  { key: "all", label: "All", statuses: ["active", "upcoming", "outstanding"] },
  { key: "active", label: "Active", statuses: ["active"] },
  { key: "upcoming", label: "Upcoming", statuses: ["upcoming"] },
  { key: "outstanding", label: "Outstanding", statuses: ["outstanding"] },
];

const QUEUE_LABELS: Record<string, string> = {
  "past-due": "Active rounds past bid due",
  unlinked: "Unlinked TBD jobs",
  [NEEDS_STAFFING_QUEUE]: "Upcoming · this region · no team assigned",
};

export default async function BidSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [principal, workspace] = await Promise.all([getWebPrincipal(), getWorkspace()]);
  const user = principal.user;
  const [rows, lists, templates, customCols, views, prefs] = await Promise.all([
    listRoundsWithJobsForPrincipal(principal),
    getReferenceValues(),
    db.select().from(reportTemplates),
    listCustomColumnsForPrincipal(principal),
    listBidScheduleViews(),
    tablePrefsService.load(principal, BID_SCHEDULE_SURFACE),
  ]);

  const skipDefaultView = params.source === "prefs";
  const urlViewId = params.view ? Number(params.view) : undefined;
  const presentation = resolveBidScheduleTableState({
    urlViewId: urlViewId && Number.isInteger(urlViewId) ? urlViewId : undefined,
    skipDefaultView,
    urlDensity:
      params.density === "detail" || params.density === "summary" ? params.density : undefined,
    prefs,
    views: views.map((view) => ({
      id: view.id,
      config: parseBidScheduleViewConfig(view.config),
    })),
  });

  if (
    !params.view &&
    !skipDefaultView &&
    presentation.source === "view" &&
    presentation.activeViewId != null
  ) {
    const defaultView = views.find((view) => view.id === presentation.activeViewId);
    if (defaultView) {
      redirect(bidScheduleViewHref(parseBidScheduleViewConfig(defaultView.config), defaultView.id));
    }
  }

  const activeViewId = presentation.activeViewId;
  const activeView =
    activeViewId != null ? views.find((v) => v.id === activeViewId) : undefined;
  const parsedView = activeView ? parseBidScheduleViewConfig(activeView.config) : undefined;

  const section = SECTIONS.find((s) => s.key === (params.section ?? "all")) ?? SECTIONS[0];
  const allowedRegions =
    principal.allowedRegions === "all" ? ("all" as const) : principal.allowedRegions;
  const hierarchy = parseHierarchyFromSearchParams(params, {
    workspaceRegion: workspace.region,
    viewRegions: parsedView?.regions,
    viewDepartments: parsedView?.departments,
    viewRegion: parsedView?.region,
    allowedRegions,
  });
  const hierarchyParams = serializeHierarchy(hierarchy);
  const region = workspace.region ?? params.region ?? "all";
  const groupBy = parseBidScheduleGroupBy(params.group);
  const sort = parseBidScheduleSort(params.sort, params.dir);
  const density = presentation.density;
  const queue = params.queue;
  const todayKey = calendarDate(new Date());

  const preBid = rows.filter((r) =>
    ["active", "upcoming", "outstanding"].includes(r.round.status),
  );
  const hierarchicallyVisible = filterByHierarchy(
    preBid.map((r) => ({ ...r, preconDepartment: r.round.preconDepartment })),
    hierarchy,
  );
  const counts = Object.fromEntries(
    SECTIONS.map((s) => [
      s.key,
      hierarchicallyVisible.filter((r) => s.statuses.includes(r.round.status)).length,
    ]),
  );

  let scoped = hierarchicallyVisible.filter((r) => section.statuses.includes(r.round.status));

  if (queue === "past-due") {
    scoped = scoped.filter(
      (r) => r.round.status === "active" && r.round.bidDueDate != null && r.round.bidDueDate < todayKey,
    );
  } else if (queue === "unlinked") {
    scoped = scoped.filter((r) => !r.job.isLinked);
  } else if (queue === NEEDS_STAFFING_QUEUE) {
    scoped = hierarchicallyVisible.filter(
      (r) => r.round.status === "upcoming" && r.round.teamAssignedAt == null,
    );
  }

  const canEdit = principalCanEditBidSchedule(principal);
  const canMarkStaffing = principalCanMarkStaffing(principal, {
    id: 0,
    status: "upcoming",
    region: workspace.region ?? principal.user.region ?? "Central",
  });
  const queryParams: Record<string, string | undefined> = {
    region:
      hierarchyParams.regions || hierarchyParams.departments
        ? undefined
        : region !== "all"
          ? region
          : undefined,
    regions: hierarchyParams.regions,
    departments: hierarchyParams.departments,
    section: section.key !== "all" ? section.key : undefined,
    group: groupBy !== "none" ? groupBy : undefined,
    sort: sort.field !== "bidDueDate" ? sort.field : undefined,
    dir: sort.dir !== "asc" ? sort.dir : undefined,
    density: density !== "summary" ? density : undefined,
    queue,
    view: activeView && params.view ? String(activeView.id) : undefined,
    source: skipDefaultView && !params.view ? "prefs" : undefined,
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

  const jobIds = [...new Set(rows.map((row) => row.job.id))];
  const visibilityRows =
    jobIds.length > 0
      ? await db
          .select({
            jobId: jobRegionVisibility.jobId,
            region: jobRegionVisibility.region,
          })
          .from(jobRegionVisibility)
          .where(inArray(jobRegionVisibility.jobId, jobIds))
      : [];
  const visibilityByJob = new Map<number, string[]>();
  for (const row of visibilityRows) {
    const list = visibilityByJob.get(row.jobId) ?? [];
    list.push(row.region);
    visibilityByJob.set(row.jobId, list);
  }

  const scopedRoundIds = scoped.map((row) => row.round.id);
  const [noteCounts, latestNotes] = await Promise.all([
    notesService.countForRounds(principal, scopedRoundIds),
    notesService.latestForRounds(principal, scopedRoundIds),
  ]);

  const canModerateNotes = ["corporate_admin", "rpd", "admin_jsa"].includes(principal.user.role);

  const sheetRows = scoped.map(({ round, job, estimateLeadName }) => ({
    id: round.id,
    jobId: job.id,
    jobNumber: job.jobNumber,
    jobName: job.jobName,
    owner: round.owner,
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
    homeRegion: job.region,
    visibilityRegions: visibilityByJob.get(job.id) ?? [job.region],
    noteCount: noteCounts.get(round.id) ?? 0,
    latestNotePreview: latestNotes.get(round.id),
    teamAssignedAt: round.teamAssignedAt?.toISOString() ?? null,
    allowed: canEdit ? allowedTransitions(principal, round) : [],
  }));

  const sectionHref = (key: string) => {
    const p = new URLSearchParams();
    if (hierarchyParams.regions) p.set("regions", hierarchyParams.regions);
    if (hierarchyParams.departments) p.set("departments", hierarchyParams.departments);
    else if (region !== "all" && !hierarchyParams.regions) p.set("region", region);
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
        description={`Pre-bid pursuit pipeline. New Pursuit is Salesforce-first; No job number yet (ROM) stays unlinked as TBD-…. ${
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
            {canEdit && (
              <NewPursuitDialog
                key={params.preview ?? "new-pursuit"}
                lists={lists}
                homeRegion={principal.workspace.region ?? principal.user.region}
                canChooseRegion={
                  principal.allowedRegions === "all" && principal.workspace.kind === "corporate"
                }
                previewDuplicates={params.preview === "duplicates"}
              />
            )}
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
          <RegionMarketFilter
            tree={regionDepartmentTree(allowedRegions)}
            selection={hierarchy}
            currentParams={queryParams}
          />
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

      <TablePrefsDensitySync density={density} enabled={!activeView} />
      <BidScheduleSheet
        key={`${density}-${activeView?.id ?? (skipDefaultView ? "prefs" : "none")}`}
        rows={sheetRows}
        canEdit={canEdit}
        lists={lists}
        groupBy={groupBy}
        sort={sort}
        density={density}
        initialColumns={presentation.columns}
        initialWidths={presentation.columnWidths}
        persistColumnPrefs={!activeView}
        siblingsByJobId={siblingsByJobId}
        views={views}
        currentUserId={user.id}
        canModerateNotes={canModerateNotes}
        canMarkStaffing={canMarkStaffing}
        activeViewId={activeView?.id}
        defaultViewId={presentation.defaultViewId}
        prefsHref={bidSchedulePrefsHref({
          section: section.key,
          group: groupBy,
          sort: sort.field,
          dir: sort.dir,
          region: region !== "all" ? region : undefined,
          regions: hierarchy.regions,
          departments: hierarchy.departments,
          queue,
          density,
        })}
        viewConfig={{
          section: section.key,
          group: groupBy,
          sort: sort.field,
          dir: sort.dir,
          region: region !== "all" ? region : undefined,
          regions: hierarchy.regions,
          departments: hierarchy.departments,
          queue,
          density,
        }}
        shareLabel={shareLabel}
      />
    </div>
  );
}
