"use client";

import { Check, Clock3, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { decideApproval } from "@/actions/approvals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type PendingApprovalSummary = {
  id: number;
  kind: "create" | "edit";
  title: string;
  detail: string;
  requestedAt: string;
};

export function PendingApprovalStrip({
  requests,
  canDecide,
}: {
  requests: PendingApprovalSummary[];
  canDecide: boolean;
}) {
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [conflict, setConflict] = useState<
    | {
        field: string;
        current: string;
        proposed: string;
      }[]
    | null
  >(null);
  const [pending, startTransition] = useTransition();
  if (!requests.length) return null;

  const decide = (
    requestId: number,
    decision: "approved" | "rejected",
    decisionReason?: string
  ) =>
    startTransition(async () => {
      try {
        await decideApproval({
          requestId,
          decision,
          reason: decisionReason,
        }).then((result) => {
          if (result.status === "conflict") {
            setConflict(result.diff);
            toast.error(
              "Someone else saved first. Review the current values before resubmitting."
            );
            return;
          }
          toast.success(
            decision === "approved"
              ? "Published to the schedule"
              : "Request rejected"
          );
          setRejecting(null);
          setReason("");
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Decision could not be saved"
        );
      }
    });

  return (
    <>
      <Card className="border-warning-border bg-warning-soft/40">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock3 className="size-4" />
                Pending RPD approval
              </CardTitle>
              <CardDescription>
                Drafts stay separate from the published schedule until approved.
              </CardDescription>
            </div>
            <Badge variant="warning">{requests.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{request.title}</p>
                <p className="text-xs text-muted-foreground">
                  {request.detail} ·{" "}
                  {new Date(request.requestedAt).toLocaleString()}
                </p>
              </div>
              {canDecide && (
                <div className="flex gap-1.5">
                  <Button
                    size="xs"
                    disabled={pending}
                    onClick={() => decide(request.id, "approved")}
                  >
                    <Check className="size-3" />
                    Approve
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setRejecting(request.id)}
                  >
                    <X className="size-3" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      <Dialog
        open={rejecting != null}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this request?</DialogTitle>
            <DialogDescription>
              Give the submitter enough context to correct and resubmit it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="approval-reject-reason">Reason</Label>
            <Textarea
              id="approval-reject-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="What should change?"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || reason.trim().length < 3}
              onClick={() =>
                rejecting && decide(rejecting, "rejected", reason.trim())
              }
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={conflict != null}
        onOpenChange={(open) => {
          if (!open) setConflict(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review the current values</DialogTitle>
            <DialogDescription>
              This request was not published. Refresh the schedule, then submit
              a new request if the change is still needed.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {(conflict ?? []).map((item) => (
              <li key={item.field} className="rounded-md border px-3 py-2">
                <p className="font-medium">{item.field}</p>
                <p className="text-xs text-muted-foreground">
                  Proposed “{item.proposed}” · current “{item.current}”
                </p>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={() => setConflict(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
