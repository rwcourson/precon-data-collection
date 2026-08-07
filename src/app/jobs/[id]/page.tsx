import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, CheckCircle2, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, OutcomeBadge } from "@/components/status-badge";
import { AddRoundDialog } from "@/components/bid-schedule/add-round-dialog";
import { LinkSalesforceCard } from "@/components/jobs/link-salesforce-card";
import { db } from "@/db";
import { estimateRounds, jobs } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { getReferenceValues } from "@/lib/queries";
import { getSalesforceCandidates } from "@/actions/pursuits";
import { canCreatePursuit } from "@/lib/permissions";
import { fmtDate, fmtDollars } from "@/lib/format";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, Number(id)));
  if (!job) notFound();

  const [rounds, user, lists, candidates] = await Promise.all([
    db
      .select()
      .from(estimateRounds)
      .where(eq(estimateRounds.jobId, job.id))
      .orderBy(asc(estimateRounds.roundNumber)),
    getCurrentUser(),
    getReferenceValues(),
    job.isLinked ? Promise.resolve([]) : getSalesforceCandidates(job.id),
  ]);

  const totalVolume = rounds.reduce((s, r) => s + (r.estimateValue ?? 0), 0);

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
        {canCreatePursuit(user) && (
          <AddRoundDialog
            jobId={job.id}
            jobName={job.jobName}
            jobNumber={job.jobNumber}
            lists={lists}
          />
        )}
      </div>

      {!job.isLinked && <LinkSalesforceCard jobId={job.id} candidates={candidates} />}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Estimate Rounds ({rounds.length})
          </CardTitle>
          <CardDescription>
            Every pricing effort is its own record with its own lifecycle. Combined
            pursuit volume across rounds: {fmtDollars(totalVolume, true)}.
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
                  <TableCell className="text-sm tabular-nums">{r.bidYear}</TableCell>
                  <TableCell className="text-sm">{fmtDate(r.bidDueDate)}</TableCell>
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
                      className="px-2" nativeButton={false}
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
