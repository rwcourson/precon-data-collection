import { PageHeader } from "@/components/page-header";
import { TrashActions } from "@/components/trash/trash-actions";
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
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { fmtDateTime } from "@/lib/format";
import { listTrash } from "@/lib/recovery";

const TYPE_LABELS: Record<string, string> = {
  job: "Job",
  round: "Estimate round",
  sheet: "Sheet",
  sheet_row: "Sheet row",
};

export default async function TrashPage() {
  const principal = await getWebPrincipal();
  const items = await listTrash(principal);
  const workspaceRegion = principal.workspace.region;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trash"
        description={
          workspaceRegion
            ? `Soft-deleted items in ${workspaceRegion} Region. Items are purged automatically after 30 days.`
            : "Soft-deleted items across all regions. Items are purged automatically after 30 days."
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Deleted items</CardTitle>
          <CardDescription>
            Restore to bring records back, or permanently delete (manager
            approval required).
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {items.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Trash is empty.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead>Retention deadline</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${item.entityType}-${item.entityId}`}>
                    <TableCell className="pl-6">
                      <Badge variant="outline" size="sm">
                        {TYPE_LABELS[item.entityType] ?? item.entityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDateTime(item.deletedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDateTime(item.retentionDeadline)}
                    </TableCell>
                    <TableCell className="pr-4">
                      <TrashActions
                        entityType={item.entityType}
                        entityId={item.entityId}
                      />
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
