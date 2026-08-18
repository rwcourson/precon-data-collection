"use client";

import {
  Copy,
  Folder,
  FolderOpen,
  Grid3x3,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Table2,
  Trash2,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  archiveSheet,
  duplicateSheet,
  restoreSheet,
  toggleSheetPin,
} from "@/actions/sheets";
import { NewSheetDialog } from "@/components/sheets/new-sheet-dialog";
import { RenameFolderDialog } from "@/components/sheets/rename-folder-dialog";
import { RenameSheetDialog } from "@/components/sheets/rename-sheet-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { groupIntoFolders, type SheetSummary } from "@/lib/sheets";

/**
 * The workspace browser. Smartsheet's left rail is a folder tree, and people
 * navigate by folder name, so this keeps the same shape rather than flattening
 * everything into one list of saved views.
 */
export type ArchivedSheet = {
  id: number;
  name: string;
  folder: string;
  archivedAt: string;
  canRestore: boolean;
};

export function SheetBrowser({
  sheets,
  folders,
  archived,
  workspaceLabel,
  workspaceRegion,
  canCreate,
}: {
  sheets: SheetSummary[];
  folders: string[];
  archived: ArchivedSheet[];
  workspaceLabel: string;
  workspaceRegion: string | null;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState<SheetSummary | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<{
    name: string;
    movable: number;
    total: number;
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sheets;
    return sheets.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.folder.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q)
    );
  }, [sheets, query]);

  const pinned = filtered.filter((s) => s.pinned);
  const tree = groupIntoFolders(filtered);

  const run = (fn: () => Promise<unknown>, message?: string) =>
    startTransition(async () => {
      try {
        await fn();
        if (message) toast.success(message);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "That did not work");
      }
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a sheet or folder…"
            className="h-9 pl-8"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {sheets.length} sheet{sheets.length === 1 ? "" : "s"} in{" "}
          {workspaceLabel}
        </p>
        {pending && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
        <div className="ml-auto">
          {canCreate ? (
            <NewSheetDialog folders={folders} workspaceLabel={workspaceLabel} />
          ) : (
            <Badge variant="outline" size="sm">
              Read-only role
            </Badge>
          )}
        </div>
      </div>

      {pinned.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Pin className="size-3.5" /> Pinned
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {pinned.map((s) => (
              <SheetCard
                key={`pin-${s.id}`}
                sheet={s}
                canDuplicate={canCreate}
                onPin={() => run(() => toggleSheetPin(s.id))}
                onDuplicate={() =>
                  run(() => duplicateSheet(s.id), `Copied "${s.name}"`)
                }
                onArchive={() =>
                  run(() => archiveSheet(s.id), `Archived "${s.name}"`)
                }
                onRename={() => setRenaming(s)}
              />
            ))}
          </div>
        </section>
      )}

      {tree.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium">
            No sheets yet in {workspaceLabel}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            {workspaceRegion
              ? "Create a bid schedule view, a post-bid checklist, or a standalone tracker. Sheets you make here stay in this Region's workspace."
              : "Corporate sheets are shared with every Region — a standard each Region can copy and adapt."}
          </p>
        </div>
      )}

      {tree.map((folder) => (
        <section key={folder.name} className="space-y-2">
          <h2 className="group/folder flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <FolderOpen className="size-3.5" />
            {folder.name}
            <span className="font-normal normal-case">
              ({folder.sheets.length})
            </span>
            {folder.sheets.some((s) => s.canManage) && (
              <button
                type="button"
                aria-label={`Rename folder ${folder.name}`}
                className="rounded p-0.5 text-muted-foreground/50 transition-colors outline-none group-hover/folder:text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                onClick={() =>
                  setRenamingFolder({
                    name: folder.name,
                    movable: folder.sheets.filter((s) => s.canManage).length,
                    total: folder.sheets.length,
                  })
                }
              >
                <Pencil className="size-3" />
              </button>
            )}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {folder.sheets.map((s) => (
              <SheetCard
                key={s.id}
                sheet={s}
                canDuplicate={canCreate}
                onPin={() => run(() => toggleSheetPin(s.id))}
                onDuplicate={() =>
                  run(() => duplicateSheet(s.id), `Copied "${s.name}"`)
                }
                onArchive={() =>
                  run(() => archiveSheet(s.id), `Archived "${s.name}"`)
                }
                onRename={() => setRenaming(s)}
              />
            ))}
          </div>
        </section>
      ))}

      {archived.length > 0 && (
        <section className="space-y-2 border-t pt-4">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-1.5 rounded-sm text-xs font-semibold tracking-wide text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Trash2 className="size-3.5" />
            Archived
            <span className="font-normal normal-case">({archived.length})</span>
          </button>
          {showArchived && (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {archived.map((s) => (
                <div
                  key={`archived-${s.id}`}
                  className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-muted-foreground">
                      {s.name}
                    </p>
                    <p className="truncate text-2xs text-muted-foreground">
                      {s.folder} · archived{" "}
                      {new Date(s.archivedAt).toLocaleDateString("en-US")}
                    </p>
                  </div>
                  {s.canRestore ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      disabled={pending}
                      onClick={() =>
                        run(() => restoreSheet(s.id), `Restored "${s.name}"`)
                      }
                    >
                      <Undo2 className="size-3.5" /> Restore
                    </Button>
                  ) : (
                    <span className="shrink-0 text-2xs text-muted-foreground">
                      Owner or RPD restores
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {renaming && (
        <RenameSheetDialog
          sheet={renaming}
          folders={folders}
          onClose={() => setRenaming(null)}
        />
      )}

      {renamingFolder && (
        <RenameFolderDialog
          folder={renamingFolder.name}
          movable={renamingFolder.movable}
          total={renamingFolder.total}
          onClose={() => setRenamingFolder(null)}
        />
      )}
    </div>
  );
}

function SheetCard({
  sheet,
  canDuplicate,
  onPin,
  onDuplicate,
  onArchive,
  onRename,
}: {
  sheet: SheetSummary;
  canDuplicate: boolean;
  onPin: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRename: () => void;
}) {
  const Icon = sheet.kind === "view" ? Table2 : Grid3x3;
  return (
    <div className="group relative rounded-lg border bg-card p-3 transition-colors hover:border-primary/40">
      <Link href={`/sheets/${sheet.id}`} className="block space-y-1.5 pr-7">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{sheet.name}</span>
          {sheet.pinned && <Pin className="size-3 shrink-0 text-primary" />}
        </div>
        <p className="line-clamp-2 min-h-8 text-2xs text-muted-foreground">
          {sheet.description ??
            (sheet.kind === "view"
              ? "Live view of pursuit records."
              : "Standalone sheet with its own columns.")}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" size="sm">
            {sheet.rowCount.toLocaleString()} row
            {sheet.rowCount === 1 ? "" : "s"}
          </Badge>
          <Badge variant={sheet.region == null ? "teal" : "outline"} size="sm">
            {sheet.region ?? "Corporate"}
          </Badge>
          {sheet.sourceSheet && (
            <Badge
              variant="outline"
              size="sm"
              className="text-muted-foreground"
            >
              from Smartsheet
            </Badge>
          )}
        </div>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="absolute top-2.5 right-2.5 rounded p-1 text-muted-foreground/50 transition-colors outline-none group-hover:text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 data-popup-open:bg-muted data-popup-open:text-foreground"
              aria-label={`Actions for ${sheet.name}`}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={onPin}>
            {sheet.pinned ? (
              <>
                <PinOff className="size-4" /> Unpin from sidebar
              </>
            ) : (
              <>
                <Pin className="size-4" /> Pin to sidebar
              </>
            )}
          </DropdownMenuItem>
          {sheet.canManage && (
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="size-4" /> Rename or move
            </DropdownMenuItem>
          )}
          {canDuplicate && (
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="size-4" /> Duplicate
            </DropdownMenuItem>
          )}
          {sheet.canManage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onArchive}>
                <Trash2 className="size-4" /> Archive
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { Folder as SheetFolderIcon, Plus as SheetPlusIcon };
