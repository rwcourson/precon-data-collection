"use client";

import { CheckCheck } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { acknowledgeVisibleScheduleChanges } from "@/actions/change-awareness";
import { Button } from "@/components/ui/button";

export function AcknowledgeVisibleChangesButton({
  items,
}: {
  items: { roundId: number; throughAuditId: number }[];
}) {
  const [pending, startTransition] = useTransition();
  if (items.length === 0) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await acknowledgeVisibleScheduleChanges({ items });
            toast.success("Visible changes acknowledged");
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
      Acknowledge visible changes
    </Button>
  );
}
