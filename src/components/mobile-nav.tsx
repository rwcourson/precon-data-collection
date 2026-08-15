"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
          { href: "/bid-schedule?section=all", label: "All", match: (s) => !s.includes("section=") || s.includes("section=all") },
          { href: "/bid-schedule?section=active", label: "Active", match: (s) => s.includes("section=active") },
          { href: "/bid-schedule?section=upcoming", label: "Upcoming", match: (s) => s.includes("section=upcoming") },
          { href: "/bid-schedule?section=outstanding", label: "Outstanding", match: (s) => s.includes("section=outstanding") },
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
          { href: "/dashboards?level=corporate", label: "Corporate", match: (s, p) => p === "/dashboards" && (!s.includes("level=") || s.includes("level=corporate")) },
          { href: "/dashboards?level=region", label: "Region", match: (s, p) => p === "/dashboards" && s.includes("level=region") },
          { href: "/dashboards?level=division", label: "Division", match: (s, p) => p === "/dashboards" && s.includes("level=division") },
        ],
      },
      {
        href: "/reports",
        label: "Reports",
        children: [
          { href: "/reports", label: "Report Builder", match: (_, p) => p === "/reports" },
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
          { href: "/admin?tab=columns", label: "Data Columns", match: (s) => !s.includes("tab=") || s.includes("tab=columns") },
          { href: "/admin?tab=lists", label: "Reference Lists", match: (s) => s.includes("tab=lists") },
          { href: "/admin?tab=audit", label: "Audit Log", match: (s) => s.includes("tab=audit") },
          { href: "/admin?tab=integrations", label: "Integrations", match: (s) => s.includes("tab=integrations") },
          { href: "/admin/destini", label: "Destini import", match: (_, p) => p.startsWith("/admin/destini") },
          { href: "/trash", label: "Trash", match: (_, p) => p.startsWith("/trash") },
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
      { href: "/dashboards/copilot", label: "Magnus" },
    ],
  },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams().toString();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" />}
      >
        <Menu className="size-4" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-12 items-center gap-3 border-b px-3">
          <span
            aria-hidden
            className="size-7 shrink-0 rounded bg-brand"
            style={{
              mask: 'url("/bg-ampersand.png") center / 70% no-repeat',
              WebkitMask: 'url("/bg-ampersand.png") center / 70% no-repeat',
            }}
          />
          <p className="text-[13px] font-medium">B&amp;G Precon</p>
        </div>
        <nav className="space-y-4 p-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="space-y-0.5">
              <p className="px-2.5 pb-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {section.label}
              </p>
              {section.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const expanded = Boolean(active && item.children?.length);

                return (
                  <div key={item.href} className="space-y-0.5">
                    <Link
                      href={item.href}
                      onClick={() => !item.children && setOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-r-md border-l-2 border-transparent px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground",
                        active && "border-l-primary bg-info-soft font-medium text-primary",
                      )}
                    >
                      <span className="flex-1">{item.label}</span>
                      {item.children && (
                        <ChevronDown
                          className={cn(
                            "size-3.5 transition-transform duration-300",
                            expanded ? "rotate-0" : "-rotate-90 opacity-40",
                          )}
                        />
                      )}
                    </Link>
                    {item.children && (
                      <div
                        className={cn(
                          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                        )}
                      >
                        <div className="overflow-hidden">
                          <div className="ml-2 space-y-0.5 border-l border-border/70 py-0.5 pl-2">
                            {item.children.map((sub) => {
                              const subActive =
                                active && (sub.match ? sub.match(search, pathname) : false);
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  onClick={() => setOpen(false)}
                                  className={cn(
                                    "block rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
                                    subActive && "bg-info-soft font-medium text-primary",
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
