"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Paired Excel / PDF downloads used on dashboards, reports, sheets, and
 * Bid Schedule. Real `<a>` tags so assistive tech and smoke treat them as
 * links. PDF opens in a new tab so the HTML print fallback still works when
 * Chromium is unavailable.
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
  const linkClass = cn(
    buttonVariants({ variant: "ghost", size: "sm" }),
    "h-full gap-1.5 px-2.5 text-xs"
  );
  return (
    <div
      className={cn(
        "inline-flex h-7 items-center rounded-md border border-border bg-card p-0.5",
        className
      )}
    >
      {excelHref ? (
        <a href={excelHref} className={linkClass}>
          <FileSpreadsheet className="size-3.5" />
          Excel
        </a>
      ) : null}
      {pdfHref ? (
        <a
          href={pdfHref}
          target="_blank"
          rel="noreferrer"
          className={linkClass}
        >
          <FileText className="size-3.5" />
          PDF
        </a>
      ) : null}
    </div>
  );
}
