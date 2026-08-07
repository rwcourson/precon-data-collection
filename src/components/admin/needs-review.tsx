"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CheckCheck, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UrlSelect } from "@/components/url-select";
import {
  confirmLegacyBaseline,
  reopenFlag,
  rescanDataQuality,
  resolveFlag,
  resolveGroup,
} from "@/actions/data-quality";
import { FLAG_LABELS, type FlagKind } from "@/lib/data-quality";

export type ReviewRow = {
  id: number;
  roundId: number;
  jobNumber: string;
  jobName: string;
  region: string;
  bidYear: number;
  field: string;
  fieldLabel: string;
  kind: FlagKind;
  value: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
};

/** Each flag kind keeps its own hue so the queue stays scannable by colour. */
const KIND_VARIANT: Record<FlagKind, "warning" | "accent" | "info"> = {
  missing_required: "warning",
  unknown_list_value: "accent",
  unlinked_job: "info",
};

export type ReviewGroup = {
  field: string;
  fieldLabel: string;
  kind: FlagKind;
  count: number;
  /** Distinct imported values behind the group, for unknown-list issues. */
  samples: string[];
};

export function NeedsReview({
  rows,
  groups,
  counts,
  totalOpen,
  matching,
  filter,
  kind,
  canTriage,
  neverScanned,
}: {
  rows: ReviewRow[];
  groups: ReviewGroup[];
  counts: Record<FlagKind, number>;
  totalOpen: number;
  /** Flags matching the current filter, which may exceed the rows shown. */
  matching: number;
  filter: string;
  kind: string;
  canTriage: boolean;
  neverScanned: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const confirmBaseline = () =>
    startTransition(async () => {
      try {
        const res = await confirmLegacyBaseline();
        toast.success(
          `Confirmed ${res.resolved.toLocaleString()} imported values as-is — only new entries are flagged from here.`,
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });

  const rescan = () =>
    startTransition(async () => {
      try {
        const res = await rescanDataQuality();
        toast.success(
          `Scan complete — ${res.open} open, ${res.resolved} reviewed, ${res.cleared} cleared.`,
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Scan failed");
      }
    });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-sm">Import review queue</CardTitle>
            <CardDescription>
              Legacy SmartSheet rows keep their original text — nothing is rewritten
              on import. Blank required values, entries that do not match a managed
              list, and jobs with no Connect link are flagged here for a human to
              confirm or correct.
            </CardDescription>
          </div>
          {canTriage && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={rescan}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Rescan
              </Button>
              {totalOpen > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={pending}
                  onClick={confirmBaseline}
                >
                  <CheckCheck className="size-4" />
                  Confirm legacy baseline
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-0 pb-0">
        <div className="flex flex-wrap items-center gap-2 px-6">
          <UrlSelect
            pathname="/admin"
            param="review"
            value={filter}
            currentParams={{ tab: "review", review: filter, kind }}
            options={[
              { value: "open", label: `Open (${totalOpen.toLocaleString()})` },
              { value: "resolved", label: "Reviewed" },
              { value: "all", label: "All" },
            ]}
          />
          <UrlSelect
            pathname="/admin"
            param="kind"
            value={kind}
            currentParams={{ tab: "review", review: filter, kind }}
            options={[
              { value: "all", label: "All issue types" },
              ...(Object.keys(FLAG_LABELS) as FlagKind[]).map((k) => ({
                value: k,
                label: `${FLAG_LABELS[k]} (${(counts[k] ?? 0).toLocaleString()})`,
              })),
            ]}
          />
          {matching > rows.length && (
            <span className="text-xs text-muted-foreground">
              Showing the first {rows.length} of {matching.toLocaleString()} — use the
              groups below to clear whole columns at once.
            </span>
          )}
        </div>

        {groups.length > 0 && (
          <div className="space-y-2 px-6">
            <p className="text-xs font-medium text-muted-foreground">
              Most common issues — one decision clears the whole column
            </p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map((g) => (
                <GroupCard key={`${g.field}-${g.kind}`} group={g} canTriage={canTriage} />
              ))}
            </div>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Project</TableHead>
              <TableHead>Field</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Value as imported</TableHead>
              <TableHead className="pr-4 text-right">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center text-sm text-muted-foreground">
                  {neverScanned
                    ? "No scan has been run yet. Choose Rescan to build the review queue from imported data."
                    : "Nothing to review — every imported value matches a managed list and no required fields are blank."}
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-6">
                  <Link href={`/rounds/${r.roundId}`} className="text-sm font-medium hover:underline">
                    {r.jobName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    #{r.jobNumber} · {r.region} · BY {r.bidYear}
                  </p>
                </TableCell>
                <TableCell className="text-xs font-medium">{r.fieldLabel}</TableCell>
                <TableCell>
                  <Badge variant={KIND_VARIANT[r.kind]} size="sm">
                    {FLAG_LABELS[r.kind]}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-64 truncate text-xs">
                  {r.value ? (
                    <span className="font-mono">{r.value}</span>
                  ) : (
                    <span className="text-muted-foreground">(blank)</span>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {r.resolvedAt ? (
                    <ResolvedCell row={r} canTriage={canTriage} />
                  ) : (
                    <ResolveForm id={r.id} canTriage={canTriage} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GroupCard({ group, canTriage }: { group: ReviewGroup; canTriage: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{group.fieldLabel}</p>
          <Badge variant={KIND_VARIANT[group.kind]} size="sm" className="mt-1">
            {FLAG_LABELS[group.kind]}
          </Badge>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {group.count.toLocaleString()}
        </span>
      </div>
      {group.samples.length > 0 && (
        <p className="mt-2 truncate font-mono text-2xs text-muted-foreground">
          {group.samples.join(" · ")}
        </p>
      )}
      {canTriage && (
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full gap-1"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const res = await resolveGroup(group.field, group.kind, "");
                toast.success(`Confirmed ${res.resolved.toLocaleString()} flags as-is`);
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            })
          }
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          Confirm all as-is
        </Button>
      )}
    </div>
  );
}

function ResolveForm({ id, canTriage }: { id: number; canTriage: boolean }) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!canTriage) return <span className="text-xs text-muted-foreground">Open</span>;

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="h-7 w-40 text-xs"
      />
      <Button
        size="sm"
        variant="outline"
        className="gap-1 px-2"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await resolveFlag(id, note);
              toast.success("Marked as reviewed");
              router.refresh();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Failed");
            }
          })
        }
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
        Reviewed
      </Button>
    </div>
  );
}

function ResolvedCell({ row, canTriage }: { row: ReviewRow; canTriage: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="text-right">
        <p className="text-2xs font-medium text-emerald-700 dark:text-emerald-300">
          Reviewed by {row.resolvedByName ?? "—"}
        </p>
        {row.resolutionNote && (
          <p className="max-w-48 truncate text-2xs text-muted-foreground">
            {row.resolutionNote}
          </p>
        )}
      </div>
      {canTriage && (
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 px-2"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await reopenFlag(row.id);
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
          Reopen
        </Button>
      )}
    </div>
  );
}
