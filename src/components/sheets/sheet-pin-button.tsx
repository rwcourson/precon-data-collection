"use client";

import { Loader2, Pin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { toggleSheetPin } from "@/actions/sheets";
import { Button } from "@/components/ui/button";

export function SheetPinButton({ sheetId }: { sheetId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const pinned = await toggleSheetPin(sheetId);
            toast.success(pinned ? "Pinned to the sidebar" : "Unpinned");
            router.refresh();
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "Could not update the pin"
            );
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Pin />}
      Pin
    </Button>
  );
}
