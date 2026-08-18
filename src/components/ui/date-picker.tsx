"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { parseIsoDate, toIsoDate } from "@/lib/calendar-grid";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DatePicker({
  value,
  onChange,
  onDismiss,
  className,
  disabled,
  required,
  autoFocus,
  defaultOpen = false,
  size = "default",
  placeholder = "Select date",
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  onDismiss?: () => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  defaultOpen?: boolean;
  size?: "sm" | "default";
  placeholder?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const selected = parseIsoDate(value);

  function close(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) onDismiss?.();
  }

  return (
    <Popover open={open} onOpenChange={close}>
      <PopoverTrigger
        disabled={disabled}
        autoFocus={autoFocus}
        aria-required={required}
        id={id}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-input/80 bg-transparent text-left text-sm transition-colors outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
          size === "sm" ? "h-7 px-1.5 text-[13px]" : "h-7 px-2.5",
          !selected && "text-muted-foreground",
          className,
        )}
      >
        <span className="min-w-0 truncate">
          {selected ? fmtDate(value) : placeholder}
        </span>
        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 p-2">
        <Calendar
          value={value}
          onSelect={(next) => {
            onChange(next);
            close(false);
          }}
        />
        <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-primary"
            disabled={!value}
            onClick={() => {
              onChange("");
              close(false);
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-primary"
            onClick={() => {
              onChange(toIsoDate(new Date()));
              close(false);
            }}
          >
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
