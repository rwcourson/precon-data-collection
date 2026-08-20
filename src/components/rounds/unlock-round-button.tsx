"use client";

import { Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { unlockRoundAction } from "@/actions/lock-lifecycle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function UnlockRoundButton({ roundId }: { roundId: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Undo2 className="size-4" />
        Send back to edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unlock this post-bid record?</DialogTitle>
          <DialogDescription>
            It will leave locked reporting until an RPD reviews and locks a new
            revision. The reason is recorded in History.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="unlock-reason">Reason</Label>
          <Textarea
            id="unlock-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What needs to change?"
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending || reason.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                try {
                  await unlockRoundAction({ roundId, reason });
                  toast.success("Sent back for edits");
                  setOpen(false);
                  setReason("");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Unlock failed"
                  );
                }
              })
            }
          >
            {pending ? "Sending back…" : "Unlock and send back"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
