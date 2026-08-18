import { PageHeader } from "@/components/page-header";
import { SheetBrowser } from "@/components/sheets/sheet-browser";
import { principalCanCreateSheet } from "@/lib/authorization/decisions";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import {
  listArchivedSheets,
  listFolders,
  listSheets,
} from "@/lib/sheets-server";

export const dynamic = "force-dynamic";

export default async function SheetsPage() {
  const principal = await getWebPrincipal();
  const workspace = {
    region: principal.workspace.region,
    label: principal.workspace.region ?? "Corporate",
  };
  const [sheets, folders, archived] = await Promise.all([
    listSheets(principal),
    listFolders(principal),
    listArchivedSheets(principal),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sheets"
        description={`The ${workspace.label} workspace — the same folder-and-sheet structure as Smartsheet, except a pursuit sheet is a live view of one record set rather than its own copy of the data. Build sheets yourself; no IT request needed.`}
      />
      <SheetBrowser
        sheets={sheets}
        folders={folders}
        archived={archived}
        workspaceLabel={workspace.label}
        workspaceRegion={workspace.region}
        canCreate={principalCanCreateSheet(principal, workspace.region)}
      />
    </div>
  );
}
