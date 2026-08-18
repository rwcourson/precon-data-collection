import { ChevronRight, Grid3x3, Table2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSheetRows } from "@/actions/sheets";
import { PageHeader } from "@/components/page-header";
import { GridSheet } from "@/components/sheets/grid-sheet";
import { SheetPinButton } from "@/components/sheets/sheet-pin-button";
import { ViewSheet } from "@/components/sheets/view-sheet";
import { Badge } from "@/components/ui/badge";
import { authorize } from "@/lib/authorization/kernel";
import { loadSheetForPrincipal } from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { getAllCustomColumns } from "@/lib/queries";
import { buildFieldCatalog } from "@/lib/report-engine";
import { BLANK_VIEW_CONFIG } from "@/lib/sheets";
import { loadSheetGrid } from "@/lib/sheets-server";

export const dynamic = "force-dynamic";

export default async function SheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sheetId = Number(id);
  if (!Number.isInteger(sheetId)) notFound();

  const principal = await getWebPrincipal();
  const loaded = await loadSheetForPrincipal(principal, sheetId);
  if (!loaded || loaded.value.archivedAt) notFound();
  const sheet = loaded.value;

  const canManage = authorize(principal, "manage", loaded.descriptor).allowed;
  const Icon = sheet.kind === "view" ? Table2 : Grid3x3;

  const header = (
    <div className="space-y-3">
      <nav className="flex items-center gap-1 text-2xs text-muted-foreground">
        <Link href="/sheets" className="hover:text-foreground hover:underline">
          Sheets
        </Link>
        <ChevronRight className="size-3" />
        <span>{sheet.region ?? "Corporate"}</span>
        <ChevronRight className="size-3" />
        <span>{sheet.folder}</span>
      </nav>
      <PageHeader
        title={sheet.name}
        description={
          sheet.description ??
          (sheet.kind === "view"
            ? "A live view of estimate records. Edits here update the record itself."
            : "A standalone sheet with its own columns and rows.")
        }
        actions={
          <>
            <Badge variant="outline" size="md" className="gap-1.5">
              <Icon />
              {sheet.kind === "view" ? "Pursuit view" : "Standalone"}
            </Badge>
            {sheet.sourceSheet && (
              <Badge
                variant="outline"
                size="md"
                className="text-muted-foreground"
              >
                Migrated from {sheet.sourceSheet}
              </Badge>
            )}
            <SheetPinButton sheetId={sheet.id} />
          </>
        }
      />
    </div>
  );

  if (sheet.kind === "grid") {
    const { columns, rows } = await loadSheetGrid(sheet);
    return (
      <div className="space-y-5">
        {header}
        <GridSheet
          sheetId={sheet.id}
          columns={columns}
          rows={rows}
          canManage={canManage}
          canEdit={authorize(principal, "edit", loaded.descriptor).allowed}
        />
      </div>
    );
  }

  const config = sheet.config ?? BLANK_VIEW_CONFIG;
  const [data, customCols] = await Promise.all([
    loadSheetRows(sheet.id, config.columns, config.filters),
    getAllCustomColumns(),
  ]);

  return (
    <div className="space-y-5">
      {header}
      <ViewSheet
        sheetId={sheet.id}
        initialConfig={config}
        initialColumns={data.columns}
        initialRows={data.rows}
        catalog={buildFieldCatalog(customCols)}
        canManage={canManage}
      />
    </div>
  );
}
