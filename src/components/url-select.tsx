"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UrlSelectOption } from "@/lib/select-options";
import { cn } from "@/lib/utils";

/** Styled select that updates a query-string param immediately (no form submit). */
export function UrlSelect({
  pathname,
  param,
  value,
  options,
  currentParams = {},
  className,
  /** Values omitted from the URL (defaults). "all" keeps region filters clean. */
  omitValues = ["all"],
}: {
  pathname: string;
  param: string;
  value: string;
  options: UrlSelectOption[];
  /** Other query params to preserve (e.g. level, section). */
  currentParams?: Record<string, string | undefined>;
  className?: string;
  omitValues?: string[];
}) {
  const router = useRouter();
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <Select
      // Lets the trigger show the option's label rather than the raw value.
      items={options}
      value={value}
      onValueChange={(next) => {
        const nextVal = next ?? omitValues[0] ?? "all";
        const params = new URLSearchParams();
        for (const [key, v] of Object.entries(currentParams)) {
          // Preserve sibling params as provided; callers pass non-defaults only.
          if (key === param || !v) continue;
          params.set(key, v);
        }
        if (nextVal && !omitValues.includes(nextVal))
          params.set(param, nextVal);
        const qs = params.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
      }}
    >
      <SelectTrigger
        size="sm"
        className={cn(
          "min-w-[8.5rem] max-w-[min(22rem,100%)] border-border/80 bg-card text-[13px] *:data-[slot=select-value]:line-clamp-none",
          className
        )}
      >
        <SelectValue placeholder={current?.label} />
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-[13px]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
