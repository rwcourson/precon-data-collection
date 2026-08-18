"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { renameFolder } from "@/actions/sheets";
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

/**
 * Renaming a folder moves every sheet in it that the person is allowed to move,
 * which is why the count comes back in the confirmation rather than a bare "done".
 */
export function RenameFolderDialog({
  folder,
  movable,
  total,
  onClose,
}: {
  folder: string;
  movable: number;
  total: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(folder);
  const [pending, startTransition] = useTransition();

  function submit() {
    const target = name.trim();
    if (!target || target === folder) {
      onClose();
      return;
    }
    startTransition(async () => {
      try {
        const { moved } = await renameFolder(folder, target);
        toast.success(
          `Moved ${moved} sheet${moved === 1 ? "" : "s"} into "${target}"`
        );
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not rename the folder"
        );
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename folder</DialogTitle>
          <DialogDescription>
            {movable === total
              ? `All ${total} sheet${total === 1 ? "" : "s"} will move with it.`
              : `${movable} of ${total} sheets will move. The rest are owned by someone else and stay in "${folder}".`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-xs">Folder name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
          />
        </div>
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Rename folder
        </Button>
      </DialogContent>
    </Dialog>
  );
}
