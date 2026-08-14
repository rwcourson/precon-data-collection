"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/sidebar-context";

export function AppMain({ children }: { children: ReactNode }) {
  const { collapsed, ready } = useSidebar();
  return (
    <div
      className={cn(
        "flex min-h-screen flex-col",
        ready && "transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed ? "md:pl-16" : "md:pl-52",
      )}
    >
      {children}
    </div>
  );
}
