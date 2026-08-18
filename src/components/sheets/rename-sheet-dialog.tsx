"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSheetMeta } from "@/actions/sheets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SheetSummary } from "@/lib/sheets";

export function RenameSheetDialog({
  sheet,
  folders,
  onClose,
}: {
  sheet: SheetSummary;
  folders: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(sheet.name);
  const [folder, setFolder] = useState(sheet.folder);
  const [description, setDescription] = useState(sheet.description ?? "");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        await updateSheetMeta(sheet.id, { name, folder, description });
        toast.success("Sheet updated");
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not update the sheet"
        );
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename or move</DialogTitle>
          <DialogDescription>
            Moving a sheet to a new folder name creates that folder.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Folder</Label>
            <Input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              list="rename-sheet-folders"
            />
            <datalist id="rename-sheet-folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>
      </DialogContent>
    </Dialog>
  );
}
