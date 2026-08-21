import { eq, inArray } from "drizzle-orm";
import { CalendarRange, LayoutGrid, Table2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listBidScheduleViews } from "@/actions/bid-schedule-views";
import { AcknowledgeVisibleChangesButton } from "@/components/bid-schedule/acknowledge-visible-button";
import { ExportDialog } from "@/components/bid-schedule/export-dialog";
import { BidScheduleGanttLazy } from "@/components/bid-schedule/gantt-lazy";
import { NewPursuitDialog } from "@/components/bid-schedule/new-pursuit-dialog";
import {
  PendingApprovalStrip,
  type PendingApprovalSummary,
} from "@/components/bid-schedule/pending-approval-strip";
import { RegionMarketFilter } from "@/components/bid-schedule/region-market-filter";
import {
  BidScheduleCards,
  type ScheduleModeJob,
} from "@/components/bid-schedule/schedule-modes";
import { BidScheduleSheet } from "@/components/bid-schedule/sheet-table";
import { TablePrefsDensitySync } from "@/components/bid-schedule/table-prefs-density-sync";
import { ExportActions } from "@/components/export-actions";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  ToolbarField,
  ToolbarSegment,
  ToolbarSegmented,
} from "@/components/ui/toolbar-controls";
import { UrlSelect } from "@/components/url-select";
import { db } from "@/db";
import type { RoundStatus } from "@/db/schema";
import {
  jobGroupMemberships,
  jobRegionVisibility,
  organizationGroups,
  reportTemplates,
} from "@/db/schema";
import {
  principalCanEditBidSchedule,
  principalCanMarkStaffing,
} from "@/lib/authorization/decisions";
import { allowedTransitions } from "@/lib/authorization/lifecycle";
import {
  listCustomColumnsForPrincipal,
  listRoundsWithJobsForPrincipal,
} from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import {
  BID_SCHEDULE_GROUP_OPTIONS,
  BID_SCHEDULE_SORT_OPTIONS,
  bidSchedulePrefsHref,
  bidScheduleViewHref,
  parseBidScheduleGroupBy,
  parseBidScheduleSort,
} from "@/lib/bid-schedule";
import {
  filterByHierarchy,
  filterBySelfPerformIntent,
  parseHierarchyFromSearchParams,
  serializeHierarchy,
} from "@/lib/bid-schedule-filter";
import { latestNoteBoardLoadForRounds } from "@/lib/latest-note-query";
import { calendarDate } from "@/lib/overview-queues";
import { getMultiValuesForRounds, getReferenceValues } from "@/lib/queries";
import { regionDepartmentTree } from "@/lib/region-departments";
import {
  excludeChildJobRows,
  projectScheduleJobs,
} from "@/lib/schedule-projection";
import { NEEDS_STAFFING_QUEUE } from "@/lib/staffing";
import {
  BID_SCHEDULE_SURFACE,
  resolveBidScheduleTableState,
} from "@/lib/table-prefs";
import { parseBidScheduleViewConfig } from "@/lib/view-config";
import { getWorkspace } from "@/lib/workspace-server";
import { approvalService } from "@/services/approval-service";
import { loadRoundChanges } from "@/services/change-awareness-service";
import { listChildJobIds } from "@/services/organization-service";
import { roundtableFeaturesFor } from "@/services/rollout-service";
import { tablePrefsService } from "@/services/table-prefs-service";

const PRE_BID_STATUSES: RoundStatus[] = ["active", "upcoming", "outstanding"];

const SECTIONS: { key: string; label: string; statuses: RoundStatus[] }[] = [
  {
    key: "pipeline",
    label: "Upcoming + Active",
    statuses: ["active", "upcoming"],
  },
  { key: "all", label: "All", statuses: PRE_BID_STATUSES },
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
  const [principal, workspace] = await Promise.all([
    getWebPrincipal(),
    getWorkspace(),
  ]);
  const user = principal.user;
  const [
    rows,
    lists,
    templates,
    customCols,
    views,
    prefs,
    approvals,
    highlights,
    childJobIds,
    features,
  ] = await Promise.all([
    listRoundsWithJobsForPrincipal(principal, { statuses: PRE_BID_STATUSES }),
    getReferenceValues(),
    db.select().from(reportTemplates),
    listCustomColumnsForPrincipal(principal),
    listBidScheduleViews(),
    tablePrefsService.load(principal, BID_SCHEDULE_SURFACE),
    approvalService.list(principal),
    approvalService.listRecentHighlights(principal),
    listChildJobIds(),
    roundtableFeaturesFor(principal),
  ]);

  const skipDefaultView = params.source === "prefs";
  const urlViewId = params.view ? Number(params.view) : undefined;
  const presentation = resolveBidScheduleTableState({
    urlViewId: urlViewId && Number.isInteger(urlViewId) ? urlViewId : undefined,
    skipDefaultView,
    urlDensity:
      params.density === "detail" || params.density === "summary"
        ? params.density
        : undefined,
    urlViewMode:
      params.viewMode === "cards" || params.viewMode === "gantt"
        ? params.viewMode
        : params.viewMode === "table"
          ? "table"
          : undefined,
    urlColumns: params.columns
      ? params.columns
          .split(",")
          .map((key) => key.trim())
          .filter(Boolean)
      : undefined,
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
    const defaultView = views.find(
      (view) => view.id === presentation.activeViewId
    );
    if (defaultView) {
      redirect(
        bidScheduleViewHref(
          parseBidScheduleViewConfig(defaultView.config),
          defaultView.id
        )
      );
    }
  }

  const activeViewId = presentation.activeViewId;
  const activeView =
    activeViewId != null ? views.find((v) => v.id === activeViewId) : undefined;
  const parsedView = activeView
    ? parseBidScheduleViewConfig(activeView.config)
    : undefined;

  const section =
    SECTIONS.find((s) => s.key === (params.section ?? "pipeline")) ??
    SECTIONS[0];
  const allowedRegions =
    principal.allowedRegions === "all"
      ? ("all" as const)
      : principal.allowedRegions;
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
  const viewMode = features.scheduleModes ? presentation.viewMode : "table";
  const queue = params.queue;
  const spIntent = params.spIntent?.trim() || undefined;
  const todayKey = calendarDate(new Date());

  const allJobIds = [...new Set(rows.map((row) => row.job.id))];
  const groupMembershipRows =
    allJobIds.length > 0
      ? await db
          .select({
            jobId: jobGroupMemberships.jobId,
            department: organizationGroups.name,
          })
          .from(jobGroupMemberships)
          .innerJoin(
            organizationGroups,
            eq(organizationGroups.id, jobGroupMemberships.groupId)
          )
          .where(inArray(jobGroupMemberships.jobId, allJobIds))
      : [];
  const departmentsByJob = new Map<number, string[]>();
  for (const membership of groupMembershipRows) {
    const current = departmentsByJob.get(membership.jobId) ?? [];
    current.push(membership.department);
    departmentsByJob.set(membership.jobId, current);
  }

  // Pre-bid statuses are already filtered in SQL by the loader.
  const preBid = rows;
  const hierarchicallyVisible = filterByHierarchy(
    preBid.map((r) => ({
      ...r,
      preconDepartment: r.round.preconDepartment,
      preconDepartments: departmentsByJob.get(r.job.id) ?? [],
    })),
    hierarchy
  );
  const counts = Object.fromEntries(
    SECTIONS.map((s) => [
      s.key,
      new Set(
        hierarchicallyVisible
          .filter((r) => s.statuses.includes(r.round.status))
          .map((r) => r.job.id)
      ).size,
    ])
  );

  let scoped = hierarchicallyVisible.filter((r) =>
    section.statuses.includes(r.round.status)
  );

  if (queue === "past-due") {
    scoped = scoped.filter(
      (r) =>
        r.round.status === "active" &&
        r.round.bidDueDate != null &&
        r.round.bidDueDate < todayKey
    );
  } else if (queue === "unlinked") {
    scoped = scoped.filter((r) => !r.job.isLinked);
  } else if (queue === NEEDS_STAFFING_QUEUE) {
    scoped = hierarchicallyVisible.filter(
      (r) => r.round.status === "upcoming" && r.round.teamAssignedAt == null
    );
  }
  if (spIntent) {
    const intentMap = await getMultiValuesForRounds(
      scoped.map((row) => row.round.id)
    );
    scoped = filterBySelfPerformIntent(scoped, spIntent, intentMap);
  }
  const projected = features.scheduleProjection
    ? projectScheduleJobs(
        features.organizationGroups
          ? excludeChildJobRows(scoped, childJobIds)
          : scoped,
        features.organizationGroups
          ? excludeChildJobRows(hierarchicallyVisible, childJobIds)
          : hierarchicallyVisible
      )
    : scoped.map((row) => ({
        jobId: row.job.id,
        focal: row,
        efforts: [row],
      }));

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
    viewMode: viewMode !== "table" ? viewMode : undefined,
    queue,
    spIntent,
    columns: presentation.columns?.join(","),
    view: activeView && params.view ? String(activeView.id) : undefined,
    source: skipDefaultView && !params.view ? "prefs" : undefined,
  };
  const queryString = new URLSearchParams(
    Object.entries(queryParams).filter(([, v]) => Boolean(v)) as [
      string,
      string,
    ][]
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
  // Only jobs that appear in the scoped rows need sibling entries.
  const scopedJobIds = new Set(projected.map((r) => r.jobId));
  for (const { round, job } of rows) {
    if (!scopedJobIds.has(job.id)) continue;
    const siblings = siblingsByJobId[job.id] ?? [];
    siblings.push({
      id: round.id,
      estimatePhase: round.estimatePhase,
      bidDueDate: round.bidDueDate,
      status: round.status,
      roundNumber: round.roundNumber,
    });
    siblingsByJobId[job.id] = siblings;
  }

  const jobIds = allJobIds;
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
  const focalRoundIds = projected.map(({ focal }) => focal.round.id);
  const [latestNotes, changeMap] = await Promise.all([
    latestNoteBoardLoadForRounds(focalRoundIds),
    features.changeAwareness
      ? loadRoundChanges(principal, focalRoundIds)
      : Promise.resolve(new Map()),
  ]);
  const newlyPublishedRoundIds = new Set(
    highlights
      .map((item) => item.roundId)
      .filter((id): id is number => id != null)
  );
  const newlyPublishedJobIds = new Set(
    highlights
      .map((item) => item.jobId)
      .filter((id): id is number => id != null)
  );

  const sheetRows = projected.map(
    ({ focal: { round, job, estimateLeadName } }) => ({
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
      interviewDate: round.interviewDate,
      bidDueDate: round.bidDueDate,
      projectStartDate: round.projectStartDate,
      projectStartMonth: round.projectStartMonth,
      projectScheduleDuration: round.projectScheduleDuration,
      awardability: round.awardability,
      city: round.city,
      state: round.state,
      estimateLeadName,
      estimateValue: round.estimateValue,
      latestNote: latestNotes.cells.get(round.id) ?? "",
      latestNoteLoadFailed: latestNotes.failed,
      changedFields: changeMap.get(round.id)?.fields ?? [],
      latestAuditId: changeMap.get(round.id)?.latestAuditId ?? null,
      changeCount: changeMap.get(round.id)?.count ?? 0,
      newlyPublished:
        newlyPublishedRoundIds.has(round.id) ||
        newlyPublishedJobIds.has(job.id),
      updatedAt: round.updatedAt?.toISOString() ?? null,
      status: round.status,
      isLinked: job.isLinked,
      homeRegion: job.region,
      visibilityRegions: visibilityByJob.get(job.id) ?? [job.region],
      teamAssignedAt: round.teamAssignedAt?.toISOString() ?? null,
      allowed: canEdit ? allowedTransitions(principal, round) : [],
    })
  );
  const modeRows: ScheduleModeJob[] = projected.map(({ focal, efforts }) => ({
    jobId: focal.job.id,
    jobName: focal.job.jobName,
    jobNumber: focal.job.jobNumber,
    focalRoundId: focal.round.id,
    estimateLeadName: focal.estimateLeadName,
    preconDepartment: focal.round.preconDepartment,
    marketSector: focal.round.marketSector,
    efforts: efforts.map((effort) => ({
      id: effort.round.id,
      roundNumber: effort.round.roundNumber,
      estimatePhase: effort.round.estimatePhase,
      status: effort.round.status,
      drawingsDueDate: effort.round.drawingsDueDate,
      bidDueDate: effort.round.bidDueDate,
      updatedAt: effort.round.updatedAt?.toISOString() ?? null,
    })),
  }));
  const currentExportConfig = {
    columns: presentation.columns?.length
      ? presentation.columns
      : [
          "jobNumber",
          "jobName",
          "preconDepartment",
          "estimatePhase",
          "drawingsDueDate",
          "bidDueDate",
          "estimateLead",
          "marketSector",
          "projectStartDate",
          "awardability",
        ],
    groupBy:
      groupBy === "none"
        ? []
        : [groupBy === "bidDueMonth" ? "bidDueDate" : groupBy],
    sortBy: [
      {
        field: sort.field === "bidDueMonth" ? "bidDueDate" : sort.field,
        dir: sort.dir,
      },
    ],
    header: "Bid Schedule",
    footer: "Brasfield & Gorrie Preconstruction — Confidential",
  };
  const currentExportConfigJson = encodeURIComponent(
    JSON.stringify(currentExportConfig)
  );
  const currentExportQuery = `${queryString ? `&${queryString}` : ""}`;
  const currentExcelHref = `/api/export/bid-schedule?format=xlsx&compact=1&config=${currentExportConfigJson}${currentExportQuery}`;
  const currentPdfHref = `/api/export/bid-schedule?format=pdf&compact=1&config=${currentExportConfigJson}${currentExportQuery}`;
  const pendingApprovalSummaries: PendingApprovalSummary[] = approvals.map(
    (request) => {
      const pursuit = request.payload.pursuit ?? {};
      const round = request.roundId
        ? rows.find((row) => row.round.id === request.roundId)
        : undefined;
      return {
        id: request.id,
        kind: request.kind === "edit" ? "edit" : "create",
        title:
          request.kind === "create"
            ? String(
                pursuit.jobName ??
                  (pursuit.sfId
                    ? `Salesforce pursuit ${pursuit.sfId}`
                    : "New pursuit")
              )
            : (round?.job.jobName ?? `Round ${request.roundId}`),
        detail:
          request.kind === "create"
            ? "New pursuit draft"
            : "Proposed schedule changes",
        requestedAt: request.requestedAt.toISOString(),
      };
    }
  );

  const sectionHref = (key: string) => {
    const p = new URLSearchParams();
    if (hierarchyParams.regions) p.set("regions", hierarchyParams.regions);
    if (hierarchyParams.departments)
      p.set("departments", hierarchyParams.departments);
    else if (region !== "all" && !hierarchyParams.regions)
      p.set("region", region);
    p.set("section", key);
    if (groupBy !== "none") p.set("group", groupBy);
    if (sort.field !== "bidDueDate") p.set("sort", sort.field);
    if (sort.dir !== "asc") p.set("dir", sort.dir);
    if (density !== "summary") p.set("density", density);
    if (viewMode !== "table") p.set("viewMode", viewMode);
    if (spIntent) p.set("spIntent", spIntent);
    return `/bid-schedule?${p.toString()}`;
  };
  const modeHref = (mode: "table" | "cards" | "gantt") => {
    const p = new URLSearchParams(
      Object.entries(queryParams).filter((entry): entry is [string, string] =>
        Boolean(entry[1])
      )
    );
    if (mode === "table") p.delete("viewMode");
    else p.set("viewMode", mode);
    return `/bid-schedule?${p.toString()}`;
  };

  const shareLabel =
    principal.workspace.kind === "region"
      ? `Share with ${principal.workspace.region}`
      : "Share company-wide";

  const scheduleToolbar = (
    <>
      <ToolbarField label="Section">
        <ToolbarSegmented>
          {SECTIONS.map((s) => (
            <ToolbarSegment
              key={s.key}
              href={sectionHref(s.key)}
              active={section.key === s.key}
            >
              {s.label}
              <Badge variant="secondary" size="sm">
                {counts[s.key]}
              </Badge>
            </ToolbarSegment>
          ))}
        </ToolbarSegmented>
      </ToolbarField>
      <ToolbarField label="View">
        <ToolbarSegmented>
          {(
            [
              { key: "table" as const, label: "Table", icon: Table2 },
              { key: "cards" as const, label: "Cards", icon: LayoutGrid },
              { key: "gantt" as const, label: "Gantt", icon: CalendarRange },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <ToolbarSegment
              key={key}
              href={modeHref(key)}
              active={viewMode === key}
            >
              <Icon className="size-3.5" />
              {label}
            </ToolbarSegment>
          ))}
        </ToolbarSegmented>
      </ToolbarField>
      <ToolbarField label="Region">
        <RegionMarketFilter
          tree={regionDepartmentTree(allowedRegions)}
          selection={hierarchy}
          currentParams={queryParams}
        />
      </ToolbarField>
      <ToolbarField label="Density">
        <UrlSelect
          pathname="/bid-schedule"
          param="density"
          value={density}
          currentParams={queryParams}
          omitValues={["summary"]}
          options={[
            { value: "summary", label: "Summary" },
            { value: "detail", label: "Detail" },
          ]}
        />
      </ToolbarField>
      {(lists.selfPerformWorkType ?? []).length > 0 && (
        <ToolbarField label="Self-perform">
          <UrlSelect
            pathname="/bid-schedule"
            param="spIntent"
            value={spIntent ?? "all"}
            currentParams={queryParams}
            omitValues={["all"]}
            options={[
              { value: "all", label: "Any" },
              ...(lists.selfPerformWorkType ?? []).map((value) => ({
                value,
                label: value,
              })),
            ]}
          />
        </ToolbarField>
      )}
      <ToolbarField label="Group by">
        <UrlSelect
          pathname="/bid-schedule"
          param="group"
          value={groupBy}
          currentParams={queryParams}
          omitValues={["none"]}
          options={BID_SCHEDULE_GROUP_OPTIONS}
        />
      </ToolbarField>
      <ToolbarField label="Sort">
        <UrlSelect
          pathname="/bid-schedule"
          param="sort"
          value={sort.field}
          currentParams={queryParams}
          omitValues={["bidDueDate"]}
          options={BID_SCHEDULE_SORT_OPTIONS}
        />
      </ToolbarField>
      <ToolbarField label="Direction">
        <UrlSelect
          pathname="/bid-schedule"
          param="dir"
          value={sort.dir}
          currentParams={queryParams}
          omitValues={["asc"]}
          options={[
            { value: "asc", label: "Ascending" },
            { value: "desc", label: "Descending" },
          ]}
        />
      </ToolbarField>
    </>
  );

  return (
    <div className="space-y-3">
      <PageHeader
        title="Bid Schedule"
        description={`One job per line with every pricing effort attached. Salesforce suggests; local schedule decisions stay local. ${
          workspace.region
            ? `${workspace.region} workspace.`
            : "Corporate view — all Regions."
        }`}
        actions={
          <>
            <ExportActions
              excelHref={currentExcelHref}
              pdfHref={currentPdfHref}
            />
            <AcknowledgeVisibleChangesButton
              items={[...changeMap.entries()].map(([roundId, change]) => ({
                roundId,
                throughAuditId: change.latestAuditId,
              }))}
            />
            <ExportDialog
              queryString={queryString}
              templates={templates.map((t) => ({
                id: t.id,
                name: t.name,
                config: t.config,
              }))}
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
                  principal.allowedRegions === "all" &&
                  principal.workspace.kind === "corporate"
                }
                previewDuplicates={params.preview === "duplicates"}
              />
            )}
          </>
        }
      />

      {queue && QUEUE_LABELS[queue] && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-info-border bg-info-soft px-3 py-2 text-sm text-info-foreground">
          <span>Queue · {QUEUE_LABELS[queue]}</span>
          <Link
            href={sectionHref(section.key)}
            className="text-xs font-medium hover:underline"
          >
            Clear
          </Link>
        </div>
      )}

      {viewMode === "table" ? null : (
        <div className="flex flex-wrap items-end gap-2">{scheduleToolbar}</div>
      )}

      <TablePrefsDensitySync
        density={density}
        viewMode={viewMode}
        enabled={!activeView}
      />
      {viewMode === "table" && (
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
          canMarkStaffing={canMarkStaffing}
          activeViewId={activeView?.id}
          defaultViewId={presentation.defaultViewId}
          toolbar={scheduleToolbar}
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
            viewMode,
          })}
          fieldPolicy={features.fieldPolicy}
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
            viewMode,
          }}
          shareLabel={shareLabel}
        />
      )}
      {features.scheduleModes && viewMode === "cards" && (
        <BidScheduleCards jobs={modeRows} />
      )}
      {features.scheduleModes && viewMode === "gantt" && (
        <BidScheduleGanttLazy jobs={modeRows} canEdit={canEdit} />
      )}
      {features.approvalWorkflow ? (
        <PendingApprovalStrip
          requests={pendingApprovalSummaries}
          canDecide={["rpd", "corporate_admin"].includes(user.role)}
        />
      ) : null}
    </div>
  );
}
