import Link from "next/link";
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
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { getMultiValuesForRounds } from "@/lib/queries";
import { listRoundsWithJobsForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { getWorkspace } from "@/lib/workspace-server";
import { requiredCompletion } from "@/lib/validation";
import { fmtDate, fmtDollars, fmtDateTime } from "@/lib/format";

export default async function PostBidPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [principal, workspace] = await Promise.all([getWebPrincipal(), getWorkspace()]);
  const rows = await listRoundsWithJobsForPrincipal(principal);

  const region = workspace.region ?? params.region ?? "all";
  const queueFilter = params.queue;
  const inScope = rows.filter((r) => region === "all" || r.round.region === region);

  let queue = inScope
    .filter((r) => ["submitted", "post_bid"].includes(r.round.status))
    .sort((a, b) => (a.round.submittedAt?.getTime() ?? 0) - (b.round.submittedAt?.getTime() ?? 0));
  const recentlyLocked = inScope
    .filter((r) => r.round.status === "locked")
    .sort((a, b) => (b.round.lockedAt?.getTime() ?? 0) - (a.round.lockedAt?.getTime() ?? 0))
    .slice(0, 8);

  const multiMap = await getMultiValuesForRounds(queue.map((r) => r.round.id));

  if (queueFilter === "awaiting-lock") {
    queue = queue.filter((r) => r.round.status === "post_bid");
  } else if (queueFilter === "incomplete") {
    queue = queue.filter(({ round, job, estimateLeadName }) => {
      const { done, total } = requiredCompletion(round, multiMap.get(round.id) ?? {}, {
        jobNumber: job.jobNumber,
        jobName: job.jobName,
        estimateLeadName,
      });
      return done < total;
    });
  }

  const queueLabel =
    queueFilter === "incomplete"
      ? "Incomplete required fields"
      : queueFilter === "awaiting-lock"
        ? "Awaiting RPD lock"
        : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Post-Bid Data Entry"
        description={`Submitted rounds awaiting their remaining required fields, then RPD review.${
          region !== "all" ? ` Showing ${region}.` : " Showing all Regions."
        }`}
      />

      {queueLabel && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-info-border bg-info-soft px-3 py-2 text-[13px] text-info-foreground">
          <span>Queue · {queueLabel}</span>
          <Link href="/post-bid" className="text-2xs font-medium hover:underline">
            Clear
          </Link>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Queue ({queue.length})</CardTitle>
          <CardDescription>
            The Estimate Lead is the primary owner of post-bid entry; Admins can enter
            on their behalf. Required fields block approval while blank.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Job</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Estimate Lead</TableHead>
                <TableHead className="text-right">Est. Value</TableHead>
                <TableHead className="w-44">Required Fields</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-sm text-muted-foreground">
                    Nothing waiting — all submitted rounds are complete.
                  </TableCell>
                </TableRow>
              )}
              {queue.map(({ round, job, estimateLeadName }) => {
                const { done, total } = requiredCompletion(
                  round,
                  multiMap.get(round.id) ?? {},
                  { jobNumber: job.jobNumber, jobName: job.jobName, estimateLeadName },
                );
                const pct = Math.round((done / total) * 100);
                return (
                  <TableRow key={round.id}>
                    <TableCell className="pl-6">
                      <Link href={`/rounds/${round.id}`} className="font-medium hover:underline">
                        {job.jobName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        #{job.jobNumber} · {round.region}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {round.estimatePhase}
                      <p className="text-xs text-muted-foreground">BY {round.bidYear}</p>
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(round.submittedAt?.toISOString().slice(0, 10))}</TableCell>
                    <TableCell className="text-sm">{estimateLeadName ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {fmtDollars(round.estimateValue, true)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${pct === 100 ? "bg-success" : "bg-warning"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {done}/{total}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={round.status} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="px-2" nativeButton={false}
                        render={<Link href={`/rounds/${round.id}`} />}
                      >
                        {round.status === "post_bid" && pct === 100 ? "Review" : "Enter Data"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recently locked</CardTitle>
          <CardDescription>
            Approved records roll into the Project Estimate Summary and dashboards.
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
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentlyLocked.map(({ round, job }) => (
                <TableRow key={round.id}>
                  <TableCell className="pl-6">
                    <Link href={`/rounds/${round.id}`} className="font-medium hover:underline">
                      {job.jobName}
                    </Link>
                    <p className="text-xs text-muted-foreground">#{job.jobNumber}</p>
                  </TableCell>
                  <TableCell className="text-sm">{round.estimatePhase}</TableCell>
                  <TableCell className="text-sm">{fmtDateTime(round.lockedAt)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {fmtDollars(round.estimateValue, true)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2" nativeButton={false}
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
