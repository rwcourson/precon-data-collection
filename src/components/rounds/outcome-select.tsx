"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setOutcome } from "@/actions/post-bid";

export function OutcomeSelect({
  roundId,
  outcome,
  disabled,
}: {
  roundId: number;
  outcome: "pending" | "successful" | "unsuccessful";
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Select
      value={outcome}
      disabled={disabled || pending}
      onValueChange={(v) =>
        startTransition(async () => {
          try {
            await setOutcome(roundId, (v ?? "pending") as typeof outcome);
            toast.success("Outcome updated");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Update failed");
          }
        })
      }
    >
      <SelectTrigger size="sm" className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="successful">Successful</SelectItem>
        <SelectItem value="unsuccessful">Unsuccessful</SelectItem>
      </SelectContent>
    </Select>
  );
}
