import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { FormSheetToggle } from "@/components/rounds/form-sheet-toggle";
import { RoundEntrySheet } from "@/components/rounds/round-entry-sheet";
import { SectionFilter } from "@/components/rounds/section-filter";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
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
import {
  ToolbarField,
  ToolbarSegment,
  ToolbarSegmented,
} from "@/components/ui/toolbar-controls";
import { principalCanEnterPostBid } from "@/lib/authorization/decisions";
import {
  listCustomColumnsForPrincipal,
  listRoundsWithJobsForPrincipal,
} from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import {
  cellsFromFlatRow,
  columnsForRoundEntry,
  entrySectionOptions,
  entryViewHref,
  parseEntrySection,
  parseEntryViewMode,
} from "@/lib/entry-view";
import { fmtDate, fmtDateTime, fmtDollars } from "@/lib/format";
import { postBidQueueRow, postBidShowsMineOnly } from "@/lib/post-bid-queue";
import {
  getCustomValuesForRounds,
  getMultiValuesForRounds,
  getReferenceValues,
} from "@/lib/queries";
import { companyScopedColumns } from "@/lib/region-custom-columns";
import { flattenRound } from "@/lib/report-engine";
import { legacyZeroFieldLabels, requiredCompletion } from "@/lib/validation";
import { getWorkspace } from "@/lib/workspace-server";
import { roundtableFeatureEnabled } from "@/services/rollout-service";

export default async function PostBidPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [principal, workspace] = await Promise.all([
    getWebPrincipal(),
    getWorkspace(),
  ]);
  const fieldPolicy = await roundtableFeatureEnabled(principal, "fieldPolicy");
  const [rows, lists, customColsAll] = await Promise.all([
    listRoundsWithJobsForPrincipal(principal),
    getReferenceValues(),
    listCustomColumnsForPrincipal(principal),
  ]);

  const region = workspace.region ?? params.region ?? "all";
  const queueFilter = params.queue;
  const mine = postBidShowsMineOnly(principal.user.role, params.mine);
  const inScope = rows.filter(
    (r) =>
      (region === "all" || r.round.region === region) &&
      (!mine || r.round.estimateLeadId === principal.user.id)
  );

  let queue = inScope
    .filter((r) => ["submitted", "post_bid"].includes(r.round.status))
    .sort(
      (a, b) =>
        (a.round.submittedAt?.getTime() ?? 0) -
        (b.round.submittedAt?.getTime() ?? 0)
    );
  const recentlyLocked = inScope
    .filter((r) => r.round.status === "locked")
    .sort(
      (a, b) =>
        (b.round.lockedAt?.getTime() ?? 0) - (a.round.lockedAt?.getTime() ?? 0)
    );

  const multiMap = await getMultiValuesForRounds(queue.map((r) => r.round.id));

  if (queueFilter === "awaiting-lock") {
    queue = queue.filter((r) => r.round.status === "post_bid");
  } else if (queueFilter === "incomplete") {
    queue = queue.filter(({ round, job, estimateLeadName }) => {
      const { done, total } = requiredCompletion(
        round,
        multiMap.get(round.id) ?? {},
        {
          jobNumber: job.jobNumber,
          jobName: job.jobName,
          estimateLeadName,
        },
        {},
        { fieldPolicy }
      );
      return done < total;
    });
  } else if (queueFilter === "legacy-zeros") {
    queue = inScope.filter(
      ({ round }) => legacyZeroFieldLabels(round).length > 0
    );
  }

  const queueLabel =
    queueFilter === "incomplete"
      ? "Incomplete required fields"
      : queueFilter === "awaiting-lock"
        ? "Awaiting RPD lock"
        : queueFilter === "legacy-zeros"
          ? "Historical zeros to remediate"
          : null;

  const customMap = await getCustomValuesForRounds(
    queue.map((r) => r.round.id)
  );
  const viewMode = parseEntryViewMode(params.viewMode);
  const section = parseEntrySection(params.section);
  const queryParams: Record<string, string | undefined> = {
    region: params.region,
    queue: params.queue,
    mine: params.mine,
    viewMode: viewMode === "sheet" ? "sheet" : undefined,
    section: section === "all" ? undefined : section,
  };
  const href = (
    overrides: Record<string, string | undefined>,
    mode = viewMode
  ) => entryViewHref("/post-bid", { ...queryParams, ...overrides }, mode);
  const sheetColumns = columnsForRoundEntry({
    mode: "postBid",
    lists,
    customCols: companyScopedColumns(customColsAll),
  });
  const sectionOptions = entrySectionOptions({
    mode: "postBid",
    includeCompanyColumns: companyScopedColumns(customColsAll).length > 0,
  });
  const sheetRows = queue.map(({ round, job, estimateLeadName }) => {
    const canEditRow = principalCanEnterPostBid(principal, round);
    return {
      id: round.id,
      cells: cellsFromFlatRow(
        flattenRound(
          round,
          job,
          estimateLeadName,
          multiMap.get(round.id) ?? {},
          customMap.get(round.id) ?? {}
        ),
        sheetColumns
      ),
      locked: !canEditRow,
      lockReason: canEditRow ? undefined : "Your role has read-only access.",
    };
  });
  const expectedUpdatedAtById = Object.fromEntries(
    queue.map(({ round }) => [round.id, round.updatedAt.toISOString()])
  );
  const sheetCanEdit = queue.some(({ round }) =>
    principalCanEnterPostBid(principal, round)
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Post-Bid Data Entry"
        description={`Submitted rounds awaiting their remaining required fields, then RPD review.${
          region !== "all" ? ` Showing ${region}.` : " Showing all Regions."
        }`}
      />

      <div className="flex flex-wrap items-end justify-between gap-2">
        <ToolbarField label="Queue" srOnlyLabel>
          <ToolbarSegmented>
            {(
              [
                {
                  key: "in-queue",
                  label: "In queue",
                  href: href({
                    mine: mine ? "1" : "0",
                    queue: undefined,
                  }),
                  active: !queueFilter,
                },
                {
                  key: "region",
                  label: "Region queue",
                  href: href({ mine: "0", queue: undefined }),
                  active: !mine,
                },
                {
                  key: "mine",
                  label: "My post-bid",
                  href: href({ mine: "1", queue: undefined }),
                  active: mine,
                },
                {
                  key: "awaiting-lock",
                  label: "Ready for RPD",
                  href: href({
                    queue: "awaiting-lock",
                    mine: undefined,
                  }),
                  active: queueFilter === "awaiting-lock",
                },
                {
                  key: "locked-history",
                  label: "Locked history",
                  href: "#locked-history",
                  active: false,
                },
                ...(fieldPolicy
                  ? [
                      {
                        key: "legacy-zeros",
                        label: "Historical zeros",
                        href: href({
                          queue: "legacy-zeros",
                          mine: undefined,
                        }),
                        active: queueFilter === "legacy-zeros",
                      },
                    ]
                  : []),
              ] as const
            ).map((chip) => (
              <ToolbarSegment
                key={chip.key}
                href={chip.href}
                active={chip.active}
              >
                {chip.label}
              </ToolbarSegment>
            ))}
          </ToolbarSegmented>
        </ToolbarField>
        <div className="flex flex-wrap items-end gap-2">
          <FormSheetToggle
            formHref={href({}, "form")}
            sheetHref={href({}, "sheet")}
            value={viewMode}
            formLabel="Queue"
          />
          {viewMode === "sheet" ? (
            <SectionFilter
              pathname="/post-bid"
              value={section}
              options={sectionOptions}
              currentParams={queryParams}
            />
          ) : null}
        </div>
      </div>

      {queueLabel && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-info-border bg-info-soft px-3 py-2 text-sm text-info-foreground">
          <span>Queue · {queueLabel}</span>
          <Link
            href={href({ queue: undefined })}
            className="text-xs font-medium hover:underline"
          >
            Clear
          </Link>
        </div>
      )}

      <Card id="locked-history">
        <CardHeader className="pb-2">
          <CardTitle>In queue ({queue.length})</CardTitle>
          <CardDescription>
            The Estimate Lead is the primary owner of post-bid entry; Admins can
            enter on their behalf. Required fields block approval while blank.
            {viewMode === "sheet"
              ? " Double-click a cell to edit the same fields as the round form."
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent
          className={viewMode === "sheet" ? "p-3 pt-0" : "px-0 pb-0"}
        >
          {viewMode === "sheet" ? (
            <RoundEntrySheet
              columns={sheetColumns}
              rows={sheetRows}
              canEdit={sheetCanEdit}
              expectedUpdatedAtById={expectedUpdatedAtById}
              showOpen
              section={section}
              emptyMessage="Nothing waiting — all submitted rounds are complete."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Job</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Estimate Lead</TableHead>
                  <TableHead className="text-right">Est. Value</TableHead>
                  <TableHead className="w-44">Required Fields</TableHead>
                  <TableHead className="w-56">Queue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-28 text-center text-sm text-muted-foreground"
                    >
                      Nothing waiting — all submitted rounds are complete.
                    </TableCell>
                  </TableRow>
                )}
                {queue.map(({ round, job, estimateLeadName }) => {
                  const extras = {
                    jobNumber: job.jobNumber,
                    jobName: job.jobName,
                    estimateLeadName,
                  };
                  const queueRow = postBidQueueRow(
                    round,
                    multiMap.get(round.id) ?? {},
                    extras,
                    { fieldPolicy }
                  );
                  const pct =
                    queueRow.total === 0
                      ? 100
                      : Math.round((queueRow.done / queueRow.total) * 100);
                  return (
                    <TableRow
                      key={round.id}
                      className="[&_td]:py-3.5 [&_td]:align-middle"
                    >
                      <TableCell className="pl-6">
                        <div className="flex flex-col justify-center gap-0.5">
                          <Link
                            href={`/rounds/${round.id}`}
                            className="font-medium leading-snug hover:underline"
                          >
                            {job.jobName}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            #{job.jobNumber} · {round.region}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col justify-center gap-0.5">
                          <span className="leading-snug">
                            {round.estimatePhase}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            BY {round.bidYear}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {fmtDate(round.submittedAt?.toISOString().slice(0, 10))}
                      </TableCell>
                      <TableCell className="text-sm">
                        {estimateLeadName ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {fmtDollars(round.estimateValue, true)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${pct === 100 ? "bg-success" : "bg-warning"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {queueRow.done}/{queueRow.total}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {queueRow.state === "ready-to-lock" ? (
                          <Badge variant="success" size="sm">
                            Ready to lock
                          </Badge>
                        ) : (
                          <div className="flex flex-col justify-center gap-1">
                            <Badge variant="warning" size="sm">
                              Awaiting required fields
                            </Badge>
                            <p className="max-w-52 text-xs leading-snug text-pretty text-muted-foreground">
                              Missing: {queueRow.missing.slice(0, 3).join(", ")}
                              {queueRow.missing.length > 3
                                ? ` +${queueRow.missing.length - 3} more`
                                : ""}
                            </p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={round.status} />
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="px-2.5"
                          nativeButton={false}
                          render={<Link href={`/rounds/${round.id}`} />}
                        >
                          {queueRow.state === "ready-to-lock"
                            ? "Review"
                            : "Enter Data"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Locked history ({recentlyLocked.length})
          </CardTitle>
          <CardDescription>
            Approved records roll into the Project Estimate Summary and
            dashboards.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Job</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Locked</TableHead>
                <TableHead className="text-right">Est. Value</TableHead>
                <TableHead className="pr-6 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentlyLocked.map(({ round, job }) => (
                <TableRow
                  key={round.id}
                  className="[&_td]:py-3.5 [&_td]:align-middle"
                >
                  <TableCell className="pl-6">
                    <div className="flex flex-col justify-center gap-0.5">
                      <Link
                        href={`/rounds/${round.id}`}
                        className="font-medium leading-snug hover:underline"
                      >
                        {job.jobName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        #{job.jobNumber}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {round.estimatePhase}
                  </TableCell>
                  <TableCell className="text-sm">
                    {fmtDateTime(round.lockedAt)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {fmtDollars(round.estimateValue, true)}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2.5"
                      nativeButton={false}
                      render={<Link href={`/rounds/${round.id}`} />}
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
