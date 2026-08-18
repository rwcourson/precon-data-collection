"use client";

import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  permanentlyDeleteTrashItem,
  restoreTrashItem,
} from "@/actions/recovery";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TrashItem } from "@/lib/recovery";

export function TrashActions({
  entityType,
  entityId,
}: {
  entityType: TrashItem["entityType"];
  entityId: number;
}) {
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const router = useRouter();

  return (
    <div className="flex justify-end gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await restoreTrashItem(entityType, entityId);
              toast.success("Item restored.");
              router.refresh();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Restore failed");
            }
          })
        }
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RotateCcw className="size-3.5" />
        )}
        Restore
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1 text-destructive hover:text-destructive"
        disabled={pending}
        onClick={() => {
          setConfirmation("");
          setDeleteOpen(true);
        }}
      >
        <Trash2 className="size-3.5" />
        Delete
      </Button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Permanently delete?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Only corporate admins can permanently
              delete already soft-deleted items. Type{" "}
              <strong>PERMANENTLY DELETE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`delete-confirm-${entityId}`}>Confirmation</Label>
            <Input
              id={`delete-confirm-${entityId}`}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="PERMANENTLY DELETE"
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || confirmation !== "PERMANENTLY DELETE"}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await permanentlyDeleteTrashItem(
                      entityType,
                      entityId,
                      confirmation
                    );
                    toast.success("Item permanently deleted.");
                    setDeleteOpen(false);
                    router.refresh();
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Delete failed"
                    );
                  }
                })
              }
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Delete forever"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
