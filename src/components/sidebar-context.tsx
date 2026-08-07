"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const STORAGE_KEY = "precon-sidebar-collapsed";

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggle: () => void;
  ready: boolean;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  notify();
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const setCollapsed = useCallback((value: boolean) => {
    writeCollapsed(value);
  }, []);

  const toggle = useCallback(() => {
    writeCollapsed(!readCollapsed());
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggle, ready }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
