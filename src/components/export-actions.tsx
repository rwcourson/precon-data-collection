"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Paired Excel / PDF downloads used on dashboards, reports, sheets, and
 * Bid Schedule. PDF opens in a new tab so the HTML print fallback still works
 * when Chromium is unavailable.
 */
export function ExportActions({
  excelHref,
  pdfHref,
  className,
}: {
  excelHref?: string;
  pdfHref?: string;
  className?: string;
}) {
  if (!excelHref && !pdfHref) return null;
  return (
    <div
      className={cn(
        "inline-flex h-7 items-center rounded-md border border-border bg-card p-0.5",
        className
      )}
    >
      {excelHref ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-full gap-1.5 px-2.5 text-xs"
          nativeButton={false}
          render={<a href={excelHref} />}
        >
          <FileSpreadsheet className="size-3.5" />
          Excel
        </Button>
      ) : null}
      {pdfHref ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-full gap-1.5 px-2.5 text-xs"
          nativeButton={false}
          render={<a href={pdfHref} target="_blank" rel="noreferrer" />}
        >
          <FileText className="size-3.5" />
          PDF
        </Button>
      ) : null}
    </div>
  );
}
