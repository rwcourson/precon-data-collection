"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveAndLock } from "@/actions/post-bid";

export function ApproveLockButton({ roundId }: { roundId: number }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="success"
      className="gap-1.5"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await approveAndLock(roundId);
            toast.success(
              "Approved and locked by RPD/SPD. The record now rolls into the Estimate Summary.",
            );
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Approval failed", {
              duration: 6000,
            });
          }
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
      Approve &amp; Lock (RPD / SPD)
    </Button>
  );
}
