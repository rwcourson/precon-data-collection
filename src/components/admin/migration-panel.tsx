import { AlertTriangle, Check, Circle, FileDown } from "lucide-react";
import Link from "next/link";
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
import type { ChecklistItem, MigrationReport } from "@/lib/migration";
import {
  describeSheet,
  type ImportSource,
  skipReason,
  sourceYears,
} from "@/lib/migration-source";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * States plainly which sheets the numbers came from. The export B&G supplied
 * contains 2026 metrics sheets only, so a missing prior year is a gap in the
 * extract rather than a failed import — worth saying out loud before cutover.
 */
function SourceCard({
  source,
  importedAtLabel,
}: {
  source: ImportSource;
  importedAtLabel: string | null;
}) {
  const years = sourceYears(source.filesUsed);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Source extract</CardTitle>
        <CardDescription>
          {source.rounds.toLocaleString()} rounds and{" "}
          {source.jobs.toLocaleString()} jobs were read from{" "}
          {source.filesUsed.length} Smartsheet sheets
          {importedAtLabel ? ` on ${importedAtLabel}` : ""}.{" "}
          {years.length > 0 && (
            <>
              Only <strong>{years.join(", ")}</strong> metrics sheets are
              present — earlier bid years are still in Smartsheet and need a
              fresh export before they can migrate.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">
            {source.filesSkipped.length} sheets in the extract were not imported
          </summary>
          <ul className="mt-2 space-y-1">
            {source.filesSkipped.map((f) => {
              const { region, sheet } = describeSheet(f);
              return (
                <li
                  key={f}
                  className="flex flex-wrap gap-x-2 text-muted-foreground"
                >
                  <span className="font-medium text-foreground">
                    {region} · {sheet}
                  </span>
                  <span>— {skipReason(f)}</span>
                </li>
              );
            })}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}

export function MigrationPanel({
  report,
  checklist,
  source,
  importedAtLabel,
}: {
  report: MigrationReport;
  checklist: ChecklistItem[];
  source: ImportSource | null;
  importedAtLabel: string | null;
}) {
  const gaps = report.metrics.filter((m) => m.computable < 0.5).slice(0, 12);

  return (
    <div className="space-y-4">
      {source && (
        <SourceCard source={source} importedAtLabel={importedAtLabel} />
      )}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 pb-3">
          <div className="space-y-1.5">
            <CardTitle className="text-sm">
              Cutover checklist — {report.scope}
            </CardTitle>
            <CardDescription>
              Evaluated against live state, not a static document. Items marked
              as a launch gate depend on B&amp;G IT and cannot be cleared from
              inside the app.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            nativeButton={false}
            render={
              <a href="/api/export/status" target="_blank" rel="noreferrer" />
            }
          >
            <FileDown className="size-4" />
            Status &amp; roadmap PDF
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {checklist.map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-2.5 rounded-md border p-3"
            >
              {item.done ? (
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
              ) : item.blocker ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {item.label}
                  {item.blocker && !item.done && (
                    <Badge variant="outline" size="sm" className="ml-2">
                      Launch gate
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Migrated data by bid year</CardTitle>
          <CardDescription>
            What actually landed from each Smartsheet year, so a thin year can
            be re-pulled before cutover rather than discovered afterwards.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Bid year</TableHead>
                <TableHead>Region</TableHead>
                <TableHead className="text-right">Rounds</TableHead>
                <TableHead className="text-right">Linked jobs</TableHead>
                <TableHead className="text-right">Locked</TableHead>
                <TableHead className="text-right">Required complete</TableHead>
                <TableHead className="text-right">Has estimate value</TableHead>
                <TableHead className="pr-6 text-right">Open flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.years.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No rounds in this workspace.
                  </TableCell>
                </TableRow>
              )}
              {report.years.map((y) => (
                <TableRow key={`${y.bidYear}-${y.region}`}>
                  <TableCell className="pl-6 text-sm font-medium">
                    {y.bidYear}
                  </TableCell>
                  <TableCell className="text-xs">{y.region}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {y.rounds}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {y.linkedJobs}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {y.lockedRounds}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {pct(y.completeness)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {pct(y.estimateValueCoverage)}
                  </TableCell>
                  <TableCell className="pr-6 text-right text-xs tabular-nums">
                    {y.openFlags.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Formula reconciliation</CardTitle>
          <CardDescription>
            Share of post-bid rounds where each calculated column can be
            reproduced from migrated inputs. A low number means the source
            columns were never collected, not that the formula is wrong — those
            are the fields to chase in{" "}
            <Link href="/admin?tab=review" className="underline">
              Needs Review
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Metric</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="pr-6 text-right">Computable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gaps.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-20 text-center text-sm text-muted-foreground"
                  >
                    Every calculated column reproduces on more than half of
                    post-bid rounds.
                  </TableCell>
                </TableRow>
              )}
              {gaps.map((m) => (
                <TableRow key={m.key}>
                  <TableCell className="pl-6 text-sm">{m.label}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.group}
                  </TableCell>
                  <TableCell className="pr-6 text-right text-xs tabular-nums">
                    <span
                      className={
                        m.computable === 0
                          ? "text-warning-foreground"
                          : "text-muted-foreground"
                      }
                    >
                      {pct(m.computable)}
                    </span>
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
