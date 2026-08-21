"use client";

import { CheckCheck } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { acknowledgeChanges } from "@/actions/change-awareness";
import { Button } from "@/components/ui/button";

export function AcknowledgeChangesButton({
  roundId,
  throughAuditId,
  count,
  compact = false,
}: {
  roundId: number;
  throughAuditId: number;
  count: number;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const label = `Acknowledge ${count} change${count === 1 ? "" : "s"}`;
  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon-sm" : "sm"}
      disabled={pending}
      aria-label={compact ? label : undefined}
      title={label}
      onClick={() =>
        startTransition(async () => {
          try {
            await acknowledgeChanges({ roundId, throughAuditId });
            toast.success("Changes acknowledged");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Changes could not be acknowledged"
            );
          }
        })
      }
    >
      <CheckCheck className="size-3.5" />
      {compact ? null : "Acknowledge"}
    </Button>
  );
}
