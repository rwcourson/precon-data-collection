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

const NAV: {
  href: string;
  label: string;
  exact?: boolean;
  children?: SubItem[];
}[] = [
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
  { href: "/sheets", label: "Sheets" },
  {
    href: "/dashboards",
    label: "Dashboards",
    children: [
      { href: "/dashboards?level=corporate", label: "Corporate", match: (s) => !s.includes("level=") || s.includes("level=corporate") },
      { href: "/dashboards?level=region", label: "Region", match: (s) => s.includes("level=region") },
      { href: "/dashboards?level=division", label: "Division", match: (s) => s.includes("level=division") },
      { href: "/dashboards/studio", label: "Studio", match: (_, p) => p.startsWith("/dashboards/studio") },
      { href: "/dashboards/forecast", label: "Forecast", match: (_, p) => p.startsWith("/dashboards/forecast") },
      { href: "/dashboards/reconciliation", label: "Reconciliation", match: (_, p) => p.startsWith("/dashboards/reconciliation") },
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
  { href: "/dashboards/copilot", label: "Magnus AI" },
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
        <div className="flex h-12 items-center gap-2.5 border-b px-3">
          <span
            aria-hidden
            className="size-7 shrink-0 rounded"
            style={{
              mask: 'url("/bg-ampersand.png") center / 70% no-repeat',
              WebkitMask: 'url("/bg-ampersand.png") center / 70% no-repeat',
              backgroundColor: "var(--primary)",
            }}
          />
          <p className="text-[13px] font-medium">B&amp;G Precon</p>
        </div>
        <nav className="space-y-0.5 p-2">
          {NAV.map((item) => {
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
                    "flex items-center gap-2 rounded px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground",
                    active && "bg-muted font-medium text-foreground",
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
                                subActive && "bg-muted/80 font-medium text-foreground",
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
      </SheetContent>
    </Sheet>
  );
}
