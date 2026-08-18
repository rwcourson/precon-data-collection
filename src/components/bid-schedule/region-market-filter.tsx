"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Minus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { RegionDepartmentNode } from "@/lib/region-departments";
import {
  expandHierarchy,
  hierarchySummary,
  serializeHierarchy,
  toggleDepartment,
  toggleRegion,
  type HierarchySelection,
} from "@/lib/bid-schedule-filter";
import { cn } from "@/lib/utils";

export function RegionMarketFilter({
  tree,
  selection,
  pathname = "/bid-schedule",
  currentParams = {},
}: {
  tree: RegionDepartmentNode[];
  selection: HierarchySelection;
  pathname?: string;
  currentParams?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const expanded = new Set(expandHierarchy(selection));

  function push(next: HierarchySelection) {
    const encoded = serializeHierarchy(next);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(currentParams)) {
      if (key === "region" || key === "regions" || key === "departments" || !value) continue;
      params.set(key, value);
    }
    if (encoded.regions) params.set("regions", encoded.regions);
    if (encoded.departments) params.set("departments", encoded.departments);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Popover>
      <PopoverTrigger
        nativeButton={true}
        className="inline-flex h-8 min-w-[8.5rem] max-w-56 items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card px-2.5 text-[13px] font-normal hover:bg-accent hover:text-accent-foreground"
        data-testid="region-market-filter"
        aria-label="Filter by region and market"
      >
        <span className="truncate">{hierarchySummary(selection)}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2" data-testid="region-market-filter-tree">
        <p className="px-1 pb-1.5 text-xs text-muted-foreground">
          Regions expand into markets. Georgia is one click or three.
        </p>
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {tree.map((node) => {
            const childCount = node.departments.length;
            const selectedCount = node.departments.filter((d) => expanded.has(d)).length;
            const all = childCount > 0 && selectedCount === childCount;
            const some = selectedCount > 0 && !all;
            return (
              <li key={node.region}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-muted/60">
                  <span className="relative inline-flex">
                    <Checkbox
                      checked={all}
                      onCheckedChange={() => push(toggleRegion(selection, node.region))}
                      aria-label={node.region}
                    />
                    {some && (
                      <Minus className="pointer-events-none absolute inset-0 m-auto size-3 text-primary" />
                    )}
                  </span>
                  <span className="text-[13px] font-medium">{node.region}</span>
                  {some && (
                    <span className="text-2xs text-muted-foreground">
                      {selectedCount} of {childCount}
                    </span>
                  )}
                </label>
                {childCount > 1 && (
                  <ul className="ml-6 mt-0.5 space-y-0.5">
                    {node.departments.map((dept) => (
                      <li key={dept}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/60">
                          <Checkbox
                            checked={expanded.has(dept)}
                            onCheckedChange={() => push(toggleDepartment(selection, dept))}
                            aria-label={dept}
                          />
                          <span className={cn("text-[13px]", expanded.has(dept) ? "text-foreground" : "text-muted-foreground")}>
                            {dept.replace(`${node.region} – `, "")}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
