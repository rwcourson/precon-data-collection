import { DestiniImport } from "@/components/admin/destini-import";
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
        description="Paste a Destini estimating export to update post-bid round fields. Matched by job number and estimate phase."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">CSV import</CardTitle>
          <CardDescription>
            Headers are mapped automatically (Grand Total → estimate value, fee fields, contingency,
            labor, GSF, etc.). Unmatched rows are reported but not written.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DestiniImport />
        </CardContent>
      </Card>
    </div>
  );
}
