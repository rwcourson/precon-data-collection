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
}: {
  roundId: number;
  throughAuditId: number;
  count: number;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      disabled={pending}
      title={`Acknowledge ${count} change${count === 1 ? "" : "s"}`}
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
      <CheckCheck className="size-3" />
      Acknowledge
    </Button>
  );
}
