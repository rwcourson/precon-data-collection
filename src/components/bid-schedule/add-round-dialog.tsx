"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Layers, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addEstimateRound } from "@/actions/pursuits";

export function AddRoundDialog({
  jobId,
  jobName,
  jobNumber,
  lists,
  trigger,
}: {
  jobId: number;
  jobName: string;
  jobNumber: string;
  lists: Record<string, string[]>;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState("");
  const [year, setYear] = useState("2026");
  const [due, setDue] = useState("");
  const [status, setStatus] = useState("upcoming");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!phase) {
      toast.error("Estimate Phase is required");
      return;
    }
    startTransition(async () => {
      try {
        await addEstimateRound({
          jobId,
          estimatePhase: phase,
          bidYear: Number(year),
          bidDueDate: due || undefined,
          initialStatus: status as "active" | "upcoming" | "outstanding",
        });
        toast.success(`New estimate round added to #${jobNumber}`);
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to add round");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={<Button variant="ghost" size="sm" className="gap-1 px-2" />}
        >
          <Layers className="size-3.5" /> Add Round
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Estimate Round</DialogTitle>
          <DialogDescription>
            #{jobNumber} — {jobName}. Each pricing effort is its own record with its
            own lifecycle; core fields carry forward from the latest round.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Estimate Phase *</Label>
            <Select value={phase} onValueChange={(v) => setPhase(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select phase…" />
              </SelectTrigger>
              <SelectContent>
                {(lists.estimatePhase ?? []).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bid Year</Label>
            <Select value={year} onValueChange={(v) => setYear(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(lists.bidYear ?? []).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bid Due Date</Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Bid Schedule Section</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "upcoming")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="outstanding">Outstanding</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Add Round
        </Button>
      </DialogContent>
    </Dialog>
  );
}
