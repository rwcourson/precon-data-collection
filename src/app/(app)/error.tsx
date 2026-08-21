"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-6 text-center">
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          An unexpected error kept this page from loading.
          {error.digest ? ` Reference: ${error.digest}` : ""}
        </p>
        <Button onClick={() => retry()}>Try again</Button>
      </div>
    </div>
  );
}
