import { DestiniImport } from "@/components/admin/destini-import";
import { DestiniListGaps } from "@/components/admin/destini-list-gaps";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DestiniAdminPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Destini import"
        description="Upload a Destini post-bid report to fill Destini-sourced round fields. Matched by job number and estimate phase — review the preview before confirming."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Import Destini report</CardTitle>
          <CardDescription>
            Vertical one-estimate XLSX (Data Point / Input) or tabular CSV. Only Destini-checkmarked
            fields from the 2026 markup are written.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DestiniImport />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reference list alignment</CardTitle>
          <CardDescription>
            Destini Data Validation sheet vs seeded dropdown lists. Gaps do not block import.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DestiniListGaps />
        </CardContent>
      </Card>
    </div>
  );
}
