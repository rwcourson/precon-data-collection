"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setOutcome } from "@/actions/post-bid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      items={[
        { value: "pending", label: "Pending" },
        { value: "successful", label: "Successful" },
        { value: "unsuccessful", label: "Unsuccessful" },
      ]}
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
      <SelectTrigger
        size="sm"
        className="h-7 w-auto gap-1 px-2.5 *:data-[slot=select-value]:flex-none"
      >
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
