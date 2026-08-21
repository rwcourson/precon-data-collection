import Link from "next/link";
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Shared chrome for page toolbars: labels, chips, and compact selects. */
export const toolbarLabelClass =
  "flex h-4 items-center text-xs font-medium leading-4 text-muted-foreground whitespace-nowrap";

export const toolbarSelectClass =
  "h-7 min-w-[8.5rem] max-w-[min(22rem,100%)] px-2.5 text-xs font-medium *:data-[slot=select-value]:line-clamp-none";

export const toolbarSegmentedClass =
  "flex h-7 w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-md bg-muted p-0.5";

export function toolbarSegmentClass(active: boolean) {
  return cn(
    "inline-flex h-full shrink-0 items-center gap-1.5 rounded px-2.5 text-xs font-medium leading-none whitespace-nowrap",
    active
      ? "bg-card text-foreground"
      : "text-muted-foreground hover:text-foreground"
  );
}

export function ToolbarField({
  label,
  children,
  className,
  srOnlyLabel = false,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  srOnlyLabel?: boolean;
}) {
  return (
    <div className={cn("flex flex-col justify-end gap-1", className)}>
      <Label
        className={cn(toolbarLabelClass, srOnlyLabel && "invisible")}
        aria-hidden={srOnlyLabel || undefined}
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

export function ToolbarSegmented({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(toolbarSegmentedClass, className)}>{children}</div>;
}

export function ToolbarSegment({
  href,
  active,
  children,
  className,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(toolbarSegmentClass(active), className)}>
      {children}
    </Link>
  );
}
