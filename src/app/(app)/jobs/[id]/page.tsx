import { asc, eq } from "drizzle-orm";
import { ArrowLeft, CheckCircle2, Unlink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSalesforceCandidates } from "@/actions/pursuits";
import { getJobVisibility } from "@/actions/visibility";
import { AddRoundDialog } from "@/components/bid-schedule/add-round-dialog";
import { GroupMembershipEditor } from "@/components/jobs/group-membership-editor";
import { LinkSalesforceCard } from "@/components/jobs/link-salesforce-card";
import { ParentJobEditor } from "@/components/jobs/parent-job-editor";
import { RegionsEditor } from "@/components/jobs/regions-editor";
import { ReportingFlags } from "@/components/jobs/reporting-flags";
import { UnlinkSalesforceButton } from "@/components/jobs/unlink-salesforce-button";
import { OutcomeBadge, StatusBadge } from "@/components/status-badge";
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
import { db } from "@/db";
import { estimateRounds } from "@/db/schema";
import { principalCanCreatePursuit } from "@/lib/authorization/decisions";
import {
  loadAdminSectionForPrincipal,
  loadJobForPrincipal,
} from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { fmtDate, fmtDollars } from "@/lib/format";
import {
  HPP_SUGGEST_THRESHOLD,
  suggestHppFromEstimateValue,
} from "@/lib/product";
import { getReferenceValues } from "@/lib/queries";
import {
  listJobGroupMemberships,
  listJobRelationship,
  listOrganizationGroups,
} from "@/services/organization-service";
import { roundtableFeatureEnabled } from "@/services/rollout-service";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const principal = await getWebPrincipal();
  const loaded = await loadJobForPrincipal(principal, Number(id));
  if (!loaded) notFound();
  const job = loaded.value;
  const canReadSalesforce = Boolean(
    await loadAdminSectionForPrincipal(principal, "salesforce")
  );

  const [
    rounds,
    lists,
    candidates,
    visibility,
    groups,
    memberships,
    relationship,
    organizationGroupsEnabled,
  ] = await Promise.all([
    db
      .select()
      .from(estimateRounds)
      .where(eq(estimateRounds.jobId, job.id))
      .orderBy(asc(estimateRounds.roundNumber)),
    getReferenceValues(),
    job.isLinked || !canReadSalesforce
      ? Promise.resolve([])
      : getSalesforceCandidates(job.id),
    getJobVisibility(job.id),
    listOrganizationGroups(),
    listJobGroupMemberships(job.id),
    listJobRelationship(job.id),
    roundtableFeatureEnabled(principal, "organizationGroups"),
  ]);

  const totalVolume = rounds.reduce((s, r) => s + (r.estimateValue ?? 0), 0);
  const canEditJob = principalCanCreatePursuit(principal, job.region);

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2.5 gap-1.5 px-2.5 text-muted-foreground"
        nativeButton={false}
        render={<Link href="/bid-schedule" />}
      >
        <ArrowLeft className="size-4" /> Bid Schedule
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-medium">{job.jobName}</h1>
            {job.isLinked ? (
              <Badge variant="success">
                <CheckCircle2 /> Connect-linked
              </Badge>
            ) : (
              <Badge variant="warning">
                <Unlink /> Unlinked
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Job #{job.jobNumber} · {job.region} · {job.preconDepartment}
            {job.salesforceId ? ` · ${job.salesforceId}` : ""}
          </p>
        </div>
        {principalCanCreatePursuit(principal, job.region) && (
          <AddRoundDialog
            jobId={job.id}
            jobName={job.jobName}
            jobNumber={job.jobNumber}
            lists={lists}
          />
        )}
      </div>

      {canReadSalesforce && !job.isLinked && (
        <LinkSalesforceCard jobId={job.id} candidates={candidates} />
      )}
      {job.isLinked && job.salesforceShadow && (
        <Card className="border-info-border bg-info-soft/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Salesforce reference</CardTitle>
            <CardDescription>
              Job number is linked. Local schedule values remain authoritative
              and later Salesforce updates do not overwrite them.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-xs sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Local name:</span>{" "}
              {job.jobName}
            </p>
            <p>
              <span className="text-muted-foreground">Salesforce says:</span>{" "}
              {job.salesforceShadow.jobName ?? "—"}
            </p>
            <div className="sm:col-span-2">
              <UnlinkSalesforceButton jobId={job.id} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reporting flags</CardTitle>
          <CardDescription>
            HPP, go/no-go, and IJV board are explicit decisions. A value at or
            above {fmtDollars(HPP_SUGGEST_THRESHOLD, true)} suggests HPP but
            never selects it automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportingFlags
            jobId={job.id}
            hppFlag={job.hppFlag}
            goNoGoFlag={job.goNoGoFlag}
            ijvBoardFlag={job.ijvBoardFlag}
            hppSuggested={rounds.some((round) =>
              suggestHppFromEstimateValue(round.estimateValue)
            )}
            canEdit={canEditJob}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Who can see this</CardTitle>
          <CardDescription>
            Home region is {job.region}. Turn on a region so everyone there can
            see this job, then add anyone from outside those regions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegionsEditor jobId={job.id} initial={visibility} />
        </CardContent>
      </Card>

      {organizationGroupsEnabled ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Collaboration groups</CardTitle>
            <CardDescription>
              One job can belong to several Preconstruction or support groups.
              This controls filtering and IJV context; it does not grant access
              or define the round staffing team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GroupMembershipEditor
              jobId={job.id}
              groups={groups.map((group) => ({
                id: group.id,
                name: group.name,
                region: group.region,
              }))}
              initial={memberships}
              canEdit={canEditJob}
            />
          </CardContent>
        </Card>
      ) : null}

      {organizationGroupsEnabled ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Parent and nested jobs</CardTitle>
            <CardDescription>
              Tenant improvements and sub-jobs stay on this record. They do not
              appear as a second board row.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ParentJobEditor
              jobId={job.id}
              parentJobId={relationship.parent?.parentJobId ?? null}
              kind={relationship.parent?.kind ?? null}
              childCount={relationship.children.length}
              canEdit={canEditJob}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Estimate Rounds ({rounds.length})
          </CardTitle>
          <CardDescription>
            Every pricing effort is its own record with its own lifecycle.
            Combined pursuit volume across rounds:{" "}
            {fmtDollars(totalVolume, true)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Round</TableHead>
                <TableHead>Estimate Phase</TableHead>
                <TableHead>Bid Year</TableHead>
                <TableHead>Bid Due</TableHead>
                <TableHead className="text-right">Est. Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-6 font-medium tabular-nums">
                    {r.roundNumber}
                  </TableCell>
                  <TableCell className="text-sm">{r.estimatePhase}</TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {r.bidYear}
                  </TableCell>
                  <TableCell className="text-sm">
                    {fmtDate(r.bidDueDate)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {fmtDollars(r.estimateValue, true)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell>
                    <OutcomeBadge outcome={r.outcome} />
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2"
                      nativeButton={false}
                      render={<Link href={`/rounds/${r.id}`} />}
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
