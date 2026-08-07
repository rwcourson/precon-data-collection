import { PageHeader } from "@/components/page-header";
import { SheetBrowser } from "@/components/sheets/sheet-browser";
import { getCurrentUser } from "@/lib/current-user";
import { canCreateSheet } from "@/lib/sheets";
import { listArchivedSheets, listFolders, listSheets } from "@/lib/sheets-server";
import { getWorkspace } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

export default async function SheetsPage() {
  const [user, workspace] = await Promise.all([getCurrentUser(), getWorkspace()]);
  const [sheets, folders, archived] = await Promise.all([
    listSheets(workspace, user),
    listFolders(workspace),
    listArchivedSheets(workspace, user),
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
        canCreate={canCreateSheet(user, workspace.region)}
      />
    </div>
  );
}
