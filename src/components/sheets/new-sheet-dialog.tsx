"use client";

import { Grid3x3, Loader2, Plus, Table2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createSheet, createSheetFromUpload } from "@/actions/sheets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Kind = "view" | "grid" | "import";

/**
 * Creating a sheet is the moment the Smartsheet comparison is won or lost, so
 * the choice is framed the way a Region thinks about it: a slice of pursuit
 * data, or a table of something else entirely.
 */
export function NewSheetDialog({
  folders,
  workspaceLabel,
}: {
  folders: string[];
  workspaceLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("view");
  const [name, setName] = useState("");
  const [folder, setFolder] = useState(folders[0] ?? "General");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setOpen(false);
    setName("");
    setDescription("");
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function submit() {
    if (kind === "import") {
      if (!file) {
        toast.error("Choose a spreadsheet to import");
        return;
      }
      startTransition(async () => {
        try {
          const form = new FormData();
          form.set("file", file);
          form.set("name", name);
          form.set("folder", folder);
          form.set("description", description);
          const result = await createSheetFromUpload(form);
          reset();
          toast.success(
            `Imported ${result.rows.toLocaleString()} rows across ${result.columns} columns` +
              (result.skipped > 0
                ? ` — ${result.skipped.toLocaleString()} rows past the import limit were left out.`
                : ".")
          );
          router.push(`/sheets/${result.id}`);
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "Could not import that file"
          );
        }
      });
      return;
    }

    if (!name.trim()) {
      toast.error("Give the sheet a name");
      return;
    }
    startTransition(async () => {
      try {
        const id = await createSheet({ kind, name, folder, description });
        reset();
        router.push(`/sheets/${id}`);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not create the sheet"
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="size-4" /> New sheet
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New sheet in {workspaceLabel}</DialogTitle>
          <DialogDescription>
            Sheets live in this workspace and are yours to change. Nothing here
            needs an IT request.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-3">
          <KindCard
            active={kind === "view"}
            onClick={() => setKind("view")}
            icon={<Table2 className="size-4" />}
            title="Pursuit view"
            body="A slice of the live estimate records — pick columns, filter, group. Edits go straight to the record, so two sheets can never disagree."
          />
          <KindCard
            active={kind === "grid"}
            onClick={() => setKind("grid")}
            icon={<Grid3x3 className="size-4" />}
            title="Standalone sheet"
            body="Your own columns and rows for things that are not pursuits — a roster, monthly cost tracking, an action list."
          />
          <KindCard
            active={kind === "import"}
            onClick={() => setKind("import")}
            icon={<Upload className="size-4" />}
            title="Import a file"
            body="Bring a spreadsheet across as-is. Columns and their types are read from the file, so nothing gets retyped."
          />
        </div>

        <div className="space-y-3">
          {kind === "import" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Spreadsheet</Label>
              <Input
                ref={fileInput}
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls"
                onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  setFile(picked);
                  if (picked && !name.trim())
                    setName(picked.name.replace(/\.[^.]+$/, ""));
                }}
              />
              <p className="text-xs text-muted-foreground">
                .csv, .tsv or .xlsx. The first row is read as column headings.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                kind === "view"
                  ? "e.g. CBG Bid Schedule — Active"
                  : "e.g. 2026 Precon Monthly Cost Tracking"
              }
              autoFocus={kind !== "import"}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Folder</Label>
            <Input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              list="sheet-folders"
              placeholder="Bid Schedule & Post Bid Data Collection"
            />
            <datalist id="sheet-folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What this sheet is for, and who keeps it current."
            />
          </div>
        </div>

        <Button onClick={submit} disabled={pending} className="w-full">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {kind === "import" ? "Import sheet" : "Create sheet"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function KindCard({
  active,
  onClick,
  icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
        active ? "border-primary bg-primary/5" : "hover:border-primary/40"
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
        {body}
      </span>
    </button>
  );
}
