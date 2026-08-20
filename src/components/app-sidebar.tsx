"use client";

import {
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileBarChart2,
  LayoutDashboard,
  Settings2,
  Sheet,
  Sparkles,
  Table2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand-mark";
import { useSidebar } from "@/components/sidebar-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/db/schema";
import {
  isNavigationItemActive,
  type NavigationIcon,
  type NavigationItem,
  type NavigationSection,
  navigationForRole,
} from "@/lib/navigation";
import { PRODUCT_SHORT_NAME, PRODUCT_TAGLINE } from "@/lib/product";
import { cn } from "@/lib/utils";

export type PipelineBucketCounts = {
  active: number;
  upcoming: number;
  outstanding: number;
};

export type PinnedSheet = { id: number; name: string };

const ICONS: Record<NavigationIcon, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  schedule: CalendarRange,
  postBid: ClipboardList,
  dashboard: FileBarChart2,
  reports: Table2,
  admin: Settings2,
  sheets: Sheet,
  copilot: Sparkles,
};

const itemClass = (active: boolean, collapsed = false) =>
  cn(
    collapsed
      ? "flex h-9 w-full shrink-0 items-center justify-center rounded-md p-0 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
      : "flex items-center gap-3 rounded-r-md border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    active &&
      (collapsed
        ? "bg-info-soft font-medium text-primary hover:bg-info-soft data-popup-open:bg-info-soft"
        : "border-l-primary bg-info-soft font-medium text-primary")
  );

function CollapsedFlyout({
  item,
  active,
  search,
  pathname,
  counts,
}: {
  item: NavigationItem;
  active: boolean;
  search: string;
  pathname: string;
  counts: PipelineBucketCounts;
}) {
  const { href, label, icon, children } = item;
  const Icon = ICONS[icon];
  const hasChildren = Boolean(children?.length);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        openOnHover
        delay={60}
        closeDelay={140}
        nativeButton={false}
        render={
          <Link
            href={href}
            className={itemClass(active, true)}
            aria-label={label}
          />
        }
      >
        <Icon className="size-[18px] shrink-0 stroke-[1.75]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={8}
        alignOffset={-2}
        className="w-44 min-w-40 origin-[left_center] p-1 shadow-lg"
      >
        <DropdownMenuItem
          className="rounded-md px-2 py-1 text-[13px] font-medium"
          render={<Link href={href} />}
        >
          {label}
        </DropdownMenuItem>
        {hasChildren && (
          <>
            <DropdownMenuSeparator className="my-0.5" />
            {children!.map((sub) => {
              const subActive =
                active &&
                (sub.match
                  ? sub.match(pathname, search)
                  : pathname + (search ? `?${search}` : "") === sub.href);
              const count = sub.countKey ? counts[sub.countKey] : undefined;
              return (
                <DropdownMenuItem
                  key={sub.href}
                  className={cn(
                    "rounded-md px-2 py-1 text-[13px]",
                    subActive && "bg-info-soft font-medium text-primary"
                  )}
                  render={<Link href={sub.href} />}
                >
                  <span className="flex w-full items-center justify-between gap-3">
                    {sub.label}
                    {count != null && (
                      <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    )}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function withPinnedSheets(
  sections: NavigationSection[],
  pinnedSheets: PinnedSheet[]
): NavigationSection[] {
  if (pinnedSheets.length === 0) return sections;
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.href === "/sheets"
        ? {
            ...item,
            children: [
              {
                href: "/sheets",
                label: "All sheets",
                match: (p: string) => p === "/sheets",
              },
              ...pinnedSheets.map((s) => ({
                href: `/sheets/${s.id}`,
                label: s.name,
                match: (p: string) => p === `/sheets/${s.id}`,
              })),
            ],
          }
        : item
    ),
  }));
}

function SidebarNav({
  pinnedSheets,
  counts,
  role,
  roleChrome,
}: {
  pinnedSheets: PinnedSheet[];
  counts: PipelineBucketCounts;
  role: Role;
  roleChrome: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { collapsed, toggle, ready } = useSidebar();
  const sections = withPinnedSheets(
    navigationForRole(role, { roleChrome }),
    pinnedSheets
  );

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-sidebar md:flex",
        ready &&
          "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed ? "w-16" : "w-52"
      )}
    >
      <div
        className={cn(
          "-mr-px flex h-14 items-center border-b border-border",
          collapsed ? "justify-center px-2" : "gap-3 px-3"
        )}
      >
        <BrandMark className="size-8" />
        <div
          className={cn(
            "min-w-0 overflow-hidden leading-tight transition-opacity duration-200",
            collapsed ? "w-0 opacity-0" : "flex-1 opacity-100"
          )}
        >
          <p className="truncate whitespace-nowrap text-sm font-semibold tracking-tight">
            {PRODUCT_SHORT_NAME}
          </p>
          <p className="truncate whitespace-nowrap text-xs text-ink-secondary">
            {PRODUCT_TAGLINE}
          </p>
        </div>
      </div>

      <nav
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden py-3",
          collapsed ? "flex flex-col gap-1 px-2" : "space-y-4 px-2"
        )}
      >
        {sections.map((section, sectionIndex) => (
          <div
            key={section.label}
            className={cn(
              collapsed &&
                sectionIndex > 0 &&
                "mt-1 w-full border-t border-sidebar-border pt-1"
            )}
          >
            {!collapsed && (
              <p className="px-3 pb-1.5 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {section.label}
              </p>
            )}
            <div
              className={cn(
                collapsed ? "flex w-full flex-col gap-0.5" : "space-y-0.5"
              )}
            >
              {section.items.map((item) => {
                const { href, label, icon, children } = item;
                const Icon = ICONS[icon];
                const active = isNavigationItemActive(item, pathname);
                const expanded = Boolean(
                  active && children?.length && !collapsed
                );

                if (collapsed) {
                  return (
                    <CollapsedFlyout
                      key={href}
                      item={item}
                      active={active}
                      search={search}
                      pathname={pathname}
                      counts={counts}
                    />
                  );
                }

                return (
                  <div key={href} className="space-y-0.5">
                    <Link href={href} className={itemClass(active)}>
                      <Icon className="size-[18px] shrink-0 stroke-[1.75]" />
                      <span className="min-w-0 flex-1 truncate leading-none">
                        {label}
                      </span>
                      {children && children.length > 0 && (
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                            expanded
                              ? "rotate-0 opacity-100"
                              : "-rotate-90 opacity-40"
                          )}
                        />
                      )}
                    </Link>

                    {children && children.length > 0 && (
                      <div
                        className={cn(
                          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        )}
                      >
                        <div className="overflow-hidden">
                          <div className="ml-3.5 space-y-0.5 border-l border-border/70 py-1 pl-2">
                            {children.map((sub) => {
                              const subActive =
                                active &&
                                (sub.match
                                  ? sub.match(pathname, search)
                                  : pathname + (search ? `?${search}` : "") ===
                                    sub.href);
                              const count = sub.countKey
                                ? counts[sub.countKey]
                                : undefined;
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  className={cn(
                                    "flex items-center gap-2 rounded-r-md border-l-2 border-transparent px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    subActive &&
                                      "border-l-primary bg-info-soft font-medium text-primary"
                                  )}
                                >
                                  <span className="min-w-0 flex-1 truncate">
                                    {sub.label}
                                  </span>
                                  {count != null && (
                                    <span className="font-mono text-2xs tabular-nums">
                                      {count}
                                    </span>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("border-t p-2", collapsed ? "px-2" : "px-2")}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggle}
          className={cn(
            "h-9 w-full text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed ? "justify-center px-0" : "justify-start gap-3"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <>
              <ChevronLeft className="size-4" />
              <span className="text-[13px]">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

const EMPTY_COUNTS: PipelineBucketCounts = {
  active: 0,
  upcoming: 0,
  outstanding: 0,
};

export function AppSidebar({
  pinnedSheets = [],
  counts = EMPTY_COUNTS,
  role,
  roleChrome = true,
}: {
  pinnedSheets?: PinnedSheet[];
  counts?: PipelineBucketCounts;
  role: Role;
  roleChrome?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <SidebarNav
        pinnedSheets={pinnedSheets}
        counts={counts}
        role={role}
        roleChrome={roleChrome}
      />
    </Suspense>
  );
}
