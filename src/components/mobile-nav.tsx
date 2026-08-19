"use client";

import { ChevronDown, Menu, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type SubItem = {
  href: string;
  label: string;
  match?: (search: string, pathname: string) => boolean;
};

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  children?: SubItem[];
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Pipeline",
    items: [
      { href: "/", label: "Overview", exact: true },
      {
        href: "/bid-schedule",
        label: "Bid Schedule",
        children: [
          {
            href: "/bid-schedule?section=all",
            label: "All",
            match: (s) => !s.includes("section=") || s.includes("section=all"),
          },
          {
            href: "/bid-schedule?section=active",
            label: "Active",
            match: (s) => s.includes("section=active"),
          },
          {
            href: "/bid-schedule?section=upcoming",
            label: "Upcoming",
            match: (s) => s.includes("section=upcoming"),
          },
          {
            href: "/bid-schedule?section=outstanding",
            label: "Outstanding",
            match: (s) => s.includes("section=outstanding"),
          },
        ],
      },
      { href: "/post-bid", label: "Post-Bid Entry" },
    ],
  },
  {
    label: "Tools",
    items: [
      {
        href: "/dashboards",
        label: "Dashboards",
        children: [
          {
            href: "/dashboards?level=corporate",
            label: "Corporate",
            match: (s, p) =>
              p === "/dashboards" &&
              (!s.includes("level=") || s.includes("level=corporate")),
          },
          {
            href: "/dashboards?level=region",
            label: "Region",
            match: (s, p) => p === "/dashboards" && s.includes("level=region"),
          },
          {
            href: "/dashboards?level=division",
            label: "Division",
            match: (s, p) =>
              p === "/dashboards" && s.includes("level=division"),
          },
        ],
      },
      {
        href: "/reports",
        label: "Reports",
        children: [
          {
            href: "/reports",
            label: "Report Builder",
            match: (_, p) => p === "/reports",
          },
          {
            href: "/reports/annual",
            label: "Annual Regional Report",
            match: (_, p) => p.startsWith("/reports/annual"),
          },
        ],
      },
      {
        href: "/admin",
        label: "Admin",
        children: [
          {
            href: "/admin?tab=columns",
            label: "Data Columns",
            match: (s) => !s.includes("tab=") || s.includes("tab=columns"),
          },
          {
            href: "/admin?tab=lists",
            label: "Reference Lists",
            match: (s) => s.includes("tab=lists"),
          },
          {
            href: "/admin?tab=audit",
            label: "Audit Log",
            match: (s) => s.includes("tab=audit"),
          },
          {
            href: "/admin?tab=mcp",
            label: "MCP Access",
            match: (s) => s.includes("tab=mcp"),
          },
          {
            href: "/admin?tab=integrations",
            label: "Integrations",
            match: (s) => s.includes("tab=integrations"),
          },
          {
            href: "/admin?tab=salesforce",
            label: "Salesforce Inbox",
            match: (s) => s.includes("tab=salesforce"),
          },
          {
            href: "/admin?tab=distribution",
            label: "Distribution",
            match: (s) => s.includes("tab=distribution"),
          },
          {
            href: "/admin/destini",
            label: "Destini import",
            match: (_, p) => p.startsWith("/admin/destini"),
          },
          {
            href: "/trash",
            label: "Trash",
            match: (_, p) => p.startsWith("/trash"),
          },
        ],
      },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/sheets", label: "Sheets" },
      { href: "/dashboards/studio", label: "Studio" },
      { href: "/dashboards/forecast", label: "Forecast" },
      { href: "/dashboards/reconciliation", label: "DMR Reconciliation" },
      { href: "/copilot", label: "AI Copilot" },
    ],
  },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-10 md:hidden"
            aria-label="Open navigation"
          />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="flex w-[min(20rem,100%)] flex-col gap-0 p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="size-7" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold tracking-tight">
                B&amp;G Precon
              </p>
              <p className="truncate text-2xs text-muted-foreground">
                Pursuits &amp; Data
              </p>
            </div>
          </div>
          <SheetClose
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-10"
                aria-label="Close navigation"
              />
            }
          >
            <X className="size-4" />
          </SheetClose>
        </div>
        <nav className="flex-1 overflow-y-auto overscroll-contain p-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="space-y-0.5 pb-3">
              <p className="px-2.5 pb-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {section.label}
              </p>
              {section.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);
                const expanded = Boolean(active && item.children?.length);
                const isCopilot = item.href === "/copilot";

                return (
                  <div key={item.href} className="space-y-0.5">
                    <Link
                      href={item.href}
                      onClick={() => {
                        if (!item.children) close();
                      }}
                      className={cn(
                        "flex min-h-10 items-center gap-2 rounded-r-md border-l-2 border-transparent px-2.5 py-2 text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        active &&
                          "border-l-primary bg-info-soft font-medium text-primary"
                      )}
                    >
                      {isCopilot && (
                        <Sparkles className="size-[18px] shrink-0 stroke-[1.75]" />
                      )}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.children && (
                        <ChevronDown
                          className={cn(
                            "size-3.5 shrink-0 transition-transform duration-300",
                            expanded ? "rotate-0" : "-rotate-90 opacity-40"
                          )}
                        />
                      )}
                    </Link>
                    {item.children && (
                      <div
                        className={cn(
                          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        )}
                      >
                        <div className="overflow-hidden">
                          <div className="ml-2 space-y-0.5 border-l border-border/70 py-0.5 pl-2">
                            {item.children.map((sub) => {
                              const subActive =
                                active &&
                                (sub.match
                                  ? sub.match(search, pathname)
                                  : false);
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  onClick={close}
                                  className={cn(
                                    "flex min-h-9 items-center rounded px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    subActive &&
                                      "bg-info-soft font-medium text-primary"
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
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
