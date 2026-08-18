"use client";

import { format, isSameDay, isSameMonth, isToday } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  calendarMonthDays,
  parseIsoDate,
  shiftMonth,
  toIsoDate,
  WEEKDAY_LABELS,
} from "@/lib/calendar-grid";
import { cn } from "@/lib/utils";

export function Calendar({
  value,
  onSelect,
  className,
}: {
  value?: string;
  onSelect: (next: string) => void;
  className?: string;
}) {
  const selected = parseIsoDate(value);
  const [month, setMonth] = useState(() => selected ?? new Date());
  const days = calendarMonthDays(month);

  return (
    <div className={cn("w-[252px]", className)}>
      <div className="flex h-7 items-center justify-between gap-2 px-0.5">
        <p className="text-sm font-medium">{format(month, "MMMM yyyy")}</p>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Previous month"
            onClick={() => setMonth((current) => shiftMonth(current, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Next month"
            onClick={() => setMonth((current) => shiftMonth(current, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="mt-1.5 grid grid-cols-7">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="flex h-7 items-center justify-center text-2xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
        {days.map((day) => {
          const iso = toIsoDate(day);
          const inMonth = isSameMonth(day, month);
          const active = selected ? isSameDay(day, selected) : false;
          return (
            <button
              key={iso}
              type="button"
              aria-label={format(day, "MMMM d, yyyy")}
              aria-pressed={active}
              onClick={() => onSelect(iso)}
              className={cn(
                "flex size-9 items-center justify-center rounded-md p-0 text-sm leading-none tabular-nums outline-none transition-colors",
                "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/30",
                !inMonth &&
                  "text-muted-foreground/45 hover:text-muted-foreground",
                inMonth &&
                  !active &&
                  isToday(day) &&
                  "bg-accent/70 text-foreground",
                active &&
                  "bg-primary text-primary-foreground hover:bg-accent-hover hover:text-primary-foreground"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
