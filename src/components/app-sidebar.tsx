"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentType } from "react";
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
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MagnusIcon } from "@/components/magnus-icon";
import { useSidebar } from "@/components/sidebar-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SubItem = {
  href: string;
  label: string;
  match?: (pathname: string, search: string) => boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  children?: SubItem[];
};

export type PinnedSheet = { id: number; name: string };

const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  {
    href: "/bid-schedule",
    label: "Bid Schedule",
    icon: CalendarRange,
    children: [
      {
        href: "/bid-schedule?section=all",
        label: "All",
        match: (_, s) => !s.includes("section=") || s.includes("section=all"),
      },
      {
        href: "/bid-schedule?section=active",
        label: "Active",
        match: (_, s) => s.includes("section=active"),
      },
      {
        href: "/bid-schedule?section=upcoming",
        label: "Upcoming",
        match: (_, s) => s.includes("section=upcoming"),
      },
      {
        href: "/bid-schedule?section=outstanding",
        label: "Outstanding",
        match: (_, s) => s.includes("section=outstanding"),
      },
    ],
  },
  { href: "/post-bid", label: "Post-Bid Entry", icon: ClipboardList },
  { href: "/sheets", label: "Sheets", icon: Sheet },
  {
    href: "/dashboards",
    label: "Dashboards",
    icon: FileBarChart2,
    children: [
      {
        href: "/dashboards?level=corporate",
        label: "Corporate",
        match: (_, s) => !s.includes("level=") || s.includes("level=corporate"),
      },
      {
        href: "/dashboards?level=region",
        label: "Region",
        match: (_, s) => s.includes("level=region"),
      },
      {
        href: "/dashboards?level=division",
        label: "Division",
        match: (_, s) => s.includes("level=division"),
      },
      {
        href: "/dashboards/studio",
        label: "Studio",
        match: (p) => p.startsWith("/dashboards/studio"),
      },
      {
        href: "/dashboards/forecast",
        label: "Forecast",
        match: (p) => p.startsWith("/dashboards/forecast"),
      },
      {
        href: "/dashboards/reconciliation",
        label: "DMR Reconciliation",
        match: (p) => p.startsWith("/dashboards/reconciliation"),
      },
    ],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: Table2,
    children: [
      {
        href: "/reports",
        label: "Report Builder",
        match: (p) => p === "/reports",
      },
      {
        href: "/reports/annual",
        label: "Annual Regional Report",
        match: (p) => p.startsWith("/reports/annual"),
      },
    ],
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Settings2,
    children: [
      {
        href: "/admin?tab=columns",
        label: "Data Columns",
        match: (_, s) => !s.includes("tab=") || s.includes("tab=columns"),
      },
      {
        href: "/admin?tab=lists",
        label: "Reference Lists",
        match: (_, s) => s.includes("tab=lists"),
      },
      {
        href: "/admin?tab=audit",
        label: "Audit Log",
        match: (_, s) => s.includes("tab=audit"),
      },
      {
        href: "/admin?tab=integrations",
        label: "Integrations",
        match: (_, s) => s.includes("tab=integrations"),
      },
      {
        href: "/admin?tab=salesforce",
        label: "Salesforce Inbox",
        match: (_, s) => s.includes("tab=salesforce"),
      },
      {
        href: "/admin?tab=distribution",
        label: "Distribution",
        match: (_, s) => s.includes("tab=distribution"),
      },
      {
        href: "/admin/destini",
        label: "Destini import",
        match: (p) => p.startsWith("/admin/destini"),
      },
      {
        href: "/trash",
        label: "Trash",
        match: (p) => p.startsWith("/trash"),
      },
    ],
  },
  {
    href: "/dashboards/copilot",
    label: "Magnus AI",
    icon: MagnusIcon,
  },
];

function isSectionActive(item: NavItem, pathname: string) {
  if (item.exact) return pathname === item.href;
  if (item.href === "/") return pathname === "/";
  // Copilot is its own top-level section; don't also light up Dashboards.
  if (item.href === "/dashboards" && pathname.startsWith("/dashboards/copilot")) {
    return false;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function CollapsedFlyout({
  item,
  active,
  search,
  pathname,
}: {
  item: NavItem;
  active: boolean;
  search: string;
  pathname: string;
}) {
  const { href, label, icon: Icon, children } = item;
  const hasChildren = Boolean(children?.length);

  const triggerClass = cn(
    "flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
    active && "bg-muted text-foreground",
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        openOnHover
        delay={60}
        closeDelay={140}
        nativeButton={false}
        render={<Link href={href} className={triggerClass} aria-label={label} />}
      >
        <Icon className="size-[18px] shrink-0 stroke-[1.75]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={10}
        alignOffset={-2}
        className="w-52 min-w-52 origin-[left_center] p-1.5 shadow-lg"
      >
        <DropdownMenuItem
          className="rounded-md px-2.5 py-2 text-sm font-medium"
          render={<Link href={href} />}
        >
          {label}
        </DropdownMenuItem>
        {hasChildren && (
          <>
            <DropdownMenuSeparator className="my-1" />
            {children!.map((sub) => {
              const subActive =
                active &&
                (sub.match
                  ? sub.match(pathname, search)
                  : pathname + (search ? `?${search}` : "") === sub.href);
              return (
                <DropdownMenuItem
                  key={sub.href}
                  className={cn(
                    "rounded-md px-2.5 py-2 text-sm",
                    subActive && "bg-muted font-medium text-foreground",
                  )}
                  render={<Link href={sub.href} />}
                >
                  {sub.label}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarNav({ pinnedSheets }: { pinnedSheets: PinnedSheet[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { collapsed, toggle, ready } = useSidebar();

  // Pinned sheets hang under Sheets the way starred sheets do in Smartsheet:
  // the two or three grids you live in are one click away.
  const nav = pinnedSheets.length
    ? NAV.map((item) =>
        item.href === "/sheets"
          ? {
              ...item,
              children: [
                { href: "/sheets", label: "All sheets", match: (p: string) => p === "/sheets" },
                ...pinnedSheets.map((s) => ({
                  href: `/sheets/${s.id}`,
                  label: s.name,
                  match: (p: string) => p === `/sheets/${s.id}`,
                })),
              ],
            }
          : item,
      )
    : NAV;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-sidebar md:flex",
        ready && "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div
        className={cn(
          "flex h-12 items-center border-b",
          collapsed ? "justify-center px-2" : "gap-2.5 px-3.5",
        )}
      >
        <span
          aria-hidden
          className="size-8 shrink-0 rounded"
          style={{
            mask: 'url("/bg-ampersand.png") center / 72% no-repeat',
            WebkitMask: 'url("/bg-ampersand.png") center / 72% no-repeat',
            backgroundColor: "var(--primary)",
          }}
        />
        <div
          className={cn(
            "min-w-0 overflow-hidden leading-tight transition-opacity duration-200",
            collapsed ? "w-0 opacity-0" : "flex-1 opacity-100",
          )}
        >
          <p className="truncate whitespace-nowrap text-sm font-medium">
            B&amp;G Precon
          </p>
          <p className="truncate whitespace-nowrap text-2xs text-muted-foreground">
            Pursuits &amp; Data
          </p>
        </div>
      </div>

      <nav
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden py-3",
          collapsed ? "flex flex-col items-center gap-1.5 px-2" : "space-y-1 px-2.5",
        )}
      >
        {nav.map((item) => {
          const { href, label, icon: Icon, children } = item;
          const active = isSectionActive(item, pathname);
          const expanded = Boolean(active && children?.length && !collapsed);

          if (collapsed) {
            return (
              <CollapsedFlyout
                key={href}
                item={item}
                active={active}
                search={search}
                pathname={pathname}
              />
            );
          }

          const className = cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            active && "bg-muted font-medium text-foreground",
          );

          return (
            <div key={href} className="space-y-0.5">
              <Link href={href} className={className}>
                <Icon className="size-[18px] shrink-0 stroke-[1.75]" />
                <span className="min-w-0 flex-1 truncate leading-none">{label}</span>
                {children && children.length > 0 && (
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      expanded ? "rotate-0 opacity-100" : "-rotate-90 opacity-40",
                    )}
                  />
                )}
              </Link>

              {children && children.length > 0 && (
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="ml-3.5 space-y-0.5 border-l border-border/70 py-1 pl-2.5">
                      {children.map((sub) => {
                        const subActive =
                          active &&
                          (sub.match
                            ? sub.match(pathname, search)
                            : pathname + (search ? `?${search}` : "") ===
                              sub.href);
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={cn(
                              "block rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                              subActive &&
                                "bg-muted/80 font-medium text-foreground",
                            )}
                          >
                            {sub.label}
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
      </nav>

      <div className={cn("border-t p-2.5", collapsed ? "px-2" : "px-2.5")}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggle}
          className={cn(
            "h-9 w-full text-muted-foreground",
            collapsed ? "justify-center px-0" : "justify-start gap-2.5",
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

export function AppSidebar({ pinnedSheets = [] }: { pinnedSheets?: PinnedSheet[] }) {
  return (
    <Suspense fallback={null}>
      <SidebarNav pinnedSheets={pinnedSheets} />
    </Suspense>
  );
}
