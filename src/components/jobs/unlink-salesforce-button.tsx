"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { unlinkJobFromSalesforce } from "@/actions/pursuits";
import { Button } from "@/components/ui/button";

export function UnlinkSalesforceButton({ jobId }: { jobId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await unlinkJobFromSalesforce(jobId);
            toast.success(
              "Salesforce job number unlinked. Shadow values remain."
            );
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not unlink"
            );
          }
        })
      }
    >
      Unlink Salesforce number
    </Button>
  );
}
