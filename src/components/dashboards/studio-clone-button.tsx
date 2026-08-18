"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cloneDashboard } from "@/actions/dashboards";
import { Button } from "@/components/ui/button";

export function StudioCloneButton({
  dashboardId,
  label = "Clone",
}: {
  dashboardId: number;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const id = await cloneDashboard(dashboardId);
            toast.success(label === "Duplicate to personal" ? "Duplicated to personal." : "Dashboard cloned.");
            router.push(`/dashboards/studio/${id}`);
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Clone failed");
          }
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
      {label}
    </Button>
  );
}
