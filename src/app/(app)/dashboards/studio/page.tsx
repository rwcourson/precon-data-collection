import Link from "next/link";
import { StudioCreateForm } from "@/components/dashboards/studio-create-form";
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
import { listDashboardsForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { fmtDateTime } from "@/lib/format";

export default async function DashboardStudioPage() {
  const principal = await getWebPrincipal();
  const rows = await listDashboardsForPrincipal(principal);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard Studio"
        description="Build custom dashboards with KPIs, charts, and tables across personal, region, or corporate scopes."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Create dashboard</CardTitle>
          <CardDescription>
            Start with a blank canvas and add widgets on the detail page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StudioCreateForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your dashboards</CardTitle>
          <CardDescription>
            {rows.length} dashboard{rows.length === 1 ? "" : "s"} available.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {rows.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No dashboards yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="pl-6 font-medium">
                      <Link
                        href={`/dashboards/studio/${d.id}`}
                        className="hover:underline"
                      >
                        {d.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" size="sm">
                        {d.scope}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.region ?? "—"}
                    </TableCell>
                    <TableCell>
                      {d.isStandard ? (
                        <Badge variant="secondary" size="sm">
                          Standard
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Personal
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.published ? "Yes" : "No"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDateTime(d.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
