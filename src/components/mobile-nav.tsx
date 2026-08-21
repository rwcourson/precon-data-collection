"use client";

import {
  CalendarRange,
  ChevronDown,
  ClipboardList,
  FileBarChart2,
  LayoutDashboard,
  Menu,
  Settings2,
  Sheet as SheetIcon,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
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
import type { Role } from "@/db/schema";
import {
  isNavigationItemActive,
  type NavigationIcon,
  navigationForRole,
} from "@/lib/navigation";
import { PRODUCT_SHORT_NAME, PRODUCT_TAGLINE } from "@/lib/product";
import { cn } from "@/lib/utils";

const ICONS: Record<NavigationIcon, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  schedule: CalendarRange,
  postBid: ClipboardList,
  dashboard: FileBarChart2,
  reports: Table2,
  admin: Settings2,
  sheets: SheetIcon,
  copilot: Sparkles,
};

export function MobileNav({
  role,
  roleChrome = true,
}: {
  role: Role;
  roleChrome?: boolean;
}) {
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
                {PRODUCT_SHORT_NAME}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {PRODUCT_TAGLINE}
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
          {navigationForRole(role, { roleChrome }).map((section) => (
            <div key={section.label} className="space-y-0.5 pb-3">
              <p className="px-2.5 pb-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {section.label}
              </p>
              {section.items.map((item) => {
                const active = isNavigationItemActive(item, pathname);
                const expanded = Boolean(active && item.children?.length);
                const Icon = ICONS[item.icon];

                return (
                  <div key={item.href} className="space-y-0.5">
                    <Link
                      href={item.href}
                      onClick={() => {
                        if (!item.children) close();
                      }}
                      className={cn(
                        "flex min-h-10 items-center gap-2 rounded-r-md border-l-2 border-transparent px-2.5 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        active &&
                          "border-l-primary bg-info-soft font-medium text-primary"
                      )}
                    >
                      <Icon className="size-[18px] shrink-0 stroke-[1.75]" />
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
                                  ? sub.match(pathname, search)
                                  : false);
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  onClick={close}
                                  className={cn(
                                    "flex min-h-9 items-center rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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
