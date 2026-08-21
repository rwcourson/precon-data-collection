"use client";

import { Check, Loader2, RefreshCw, Unlink, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  decideMatchCandidate,
  runSalesforceSync,
} from "@/actions/salesforce-inbox";
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

export type MatchCandidateRow = {
  id: number;
  jobNumber: string | null;
  jobName: string | null;
  sfId: string;
  proposedJobNumber: string | null;
  proposedJobName: string;
  proposedRegion: string | null;
  score: number;
  signals: Record<string, number | boolean | string>;
  discrepancy: string | null;
  status: string;
};

export type SyncRunSummary = {
  id: number;
  status: string;
  opportunitiesSeen: number;
  candidatesCreated: number;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
} | null;

function formatSignals(signals: Record<string, number | boolean | string>) {
  const entries = Object.entries(signals);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
}

export function SalesforceInbox({
  candidates,
  lastRun,
}: {
  candidates: MatchCandidateRow[];
  lastRun: SyncRunSummary;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function sync() {
    startTransition(async () => {
      try {
        const res = await runSalesforceSync();
        toast.success(
          `Sync complete — ${res.seen} opportunities, ${res.created} new candidates`
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Sync failed");
      }
    });
  }

  function decide(
    id: number,
    decision: "approve" | "reject" | "dismiss",
    note?: string
  ) {
    startTransition(async () => {
      try {
        await decideMatchCandidate(id, decision, note);
        toast.success(
          decision === "approve"
            ? "Match approved and job linked"
            : decision === "reject"
              ? "Match rejected"
              : "Match dismissed"
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Decision failed");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-sm">Salesforce match inbox</CardTitle>
            <CardDescription>
              Nightly sync proposes job ↔ opportunity links. Review each
              candidate — approve to link, reject to block, or dismiss to skip
              without suppressing future matches.
            </CardDescription>
            {lastRun && (
              <p className="text-xs text-muted-foreground">
                Last sync {lastRun.startedAt}
                {lastRun.finishedAt ? ` → ${lastRun.finishedAt}` : ""} ·{" "}
                {lastRun.status} · {lastRun.opportunitiesSeen} opps ·{" "}
                {lastRun.candidatesCreated} created
                {lastRun.error ? ` · ${lastRun.error}` : ""}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={pending}
            onClick={sync}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Run sync now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Local job</TableHead>
              <TableHead>Salesforce</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Signals</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead className="pr-4 text-right">Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  No pending match candidates. Run sync to pull opportunities
                  from Connect/Salesforce.
                </TableCell>
              </TableRow>
            )}
            {candidates.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="pl-6">
                  <p className="text-sm font-medium">
                    {c.jobName ?? c.proposedJobName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    #{c.jobNumber ?? c.proposedJobNumber ?? "—"}
                    {c.proposedRegion ? ` · ${c.proposedRegion}` : ""}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="font-mono text-xs">{c.sfId}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.proposedJobName}
                  </p>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-semibold tabular-nums">
                    {(c.score * 100).toFixed(0)}%
                  </span>
                </TableCell>
                <TableCell className="max-w-56">
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {formatSignals(c.signals)}
                  </p>
                </TableCell>
                <TableCell>
                  {c.discrepancy ? (
                    <Badge variant="warning" size="sm">
                      {c.discrepancy.replaceAll("_", " ")}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 px-2"
                      disabled={pending}
                      onClick={() =>
                        decide(
                          c.id,
                          "approve",
                          c.discrepancy?.includes("job_number_mismatch")
                            ? "confirm-job-number"
                            : undefined
                        )
                      }
                    >
                      <Check className="size-3" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 px-2"
                      disabled={pending}
                      onClick={() => decide(c.id, "reject")}
                    >
                      <X className="size-3" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 px-2 text-muted-foreground"
                      disabled={pending}
                      onClick={() => decide(c.id, "dismiss")}
                    >
                      <Unlink className="size-3" />
                      Dismiss
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
