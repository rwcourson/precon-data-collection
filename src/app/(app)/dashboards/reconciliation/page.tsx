import Link from "next/link";
import { desc } from "drizzle-orm";
import { DmrUpload } from "@/components/dashboards/dmr-upload";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
import { getDmrReconciliation } from "@/actions/dmr";
import { db } from "@/db";
import { dmrImports } from "@/db/schema";
import { fmtDateTime, fmtDollars } from "@/lib/format";
import { notFound } from "next/navigation";
import { loadAdminSectionForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const principal = await getWebPrincipal();
  if (!(await loadAdminSectionForPrincipal(principal, "integrations"))) notFound();
  const importId = params.importId ? Number(params.importId) : null;

  const imports = await db.select().from(dmrImports).orderBy(desc(dmrImports.createdAt));

  const reconciliation =
    importId != null && Number.isFinite(importId)
      ? await getDmrReconciliation(importId)
      : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="DMR reconciliation"
        description="Compare DMR warehouse values against precon estimate values. DMR and precon sources stay separate — only deltas are computed."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Upload DMR extract</CardTitle>
            <CardDescription>
              Paste a simple CSV with job number and DMR value columns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DmrUpload />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Past imports</CardTitle>
            <CardDescription>Select an import to view reconciliation.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {imports.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No imports yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Name</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Imported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((imp) => (
                    <TableRow key={imp.id}>
                      <TableCell className="pl-6 font-medium">
                        <Link
                          href={`/dashboards/reconciliation?importId=${imp.id}`}
                          className="hover:underline"
                        >
                          {imp.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{imp.source}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmtDateTime(imp.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {reconciliation && importId != null && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reconciliation</CardTitle>
            <CardDescription>
              Import #{importId} — {reconciliation.rows.length} job
              {reconciliation.rows.length === 1 ? "" : "s"} compared.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                DMR total:{" "}
                <strong className="font-mono tabular-nums">
                  {fmtDollars(reconciliation.totals.dmr, true)}
                </strong>
              </span>
              <span>
                Precon total:{" "}
                <strong className="font-mono tabular-nums">
                  {fmtDollars(reconciliation.totals.precon, true)}
                </strong>
              </span>
              <span>
                Delta:{" "}
                <strong className="font-mono tabular-nums">
                  {fmtDollars(reconciliation.totals.delta, true)}
                </strong>
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Job #</TableHead>
                  <TableHead>Job name</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">DMR</TableHead>
                  <TableHead className="text-right">Precon</TableHead>
                  <TableHead className="pr-4 text-right">Delta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliation.rows.map((row) => (
                  <TableRow key={row.jobNumber}>
                    <TableCell className="pl-6 font-mono text-sm">{row.jobNumber}</TableCell>
                    <TableCell className="max-w-48 truncate text-sm">{row.jobName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.region || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "matched"
                            ? "secondary"
                            : row.status === "dmr_only"
                              ? "outline"
                              : "outline"
                        }
                        size="sm"
                      >
                        {row.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {row.dmrValue != null ? fmtDollars(row.dmrValue, true) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {row.preconValue != null ? fmtDollars(row.preconValue, true) : "—"}
                    </TableCell>
                    <TableCell className="pr-4 text-right font-mono text-sm tabular-nums">
                      {row.delta != null ? fmtDollars(row.delta, true) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
