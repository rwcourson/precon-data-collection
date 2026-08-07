"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";
type Resolved = "light" | "dark";

/** Bumped so prior light-mode preference does not stick after dark becomes default. */
export const THEME_STORAGE_KEY = "precon-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/*
 * Theme state, read straight from the two places that actually hold it:
 * localStorage and the OS preference. There is no React state to keep in sync,
 * so the class on <html> and what components render can never drift apart.
 *
 * This replaces next-themes, which rendered its anti-flash script inside the
 * component tree. React 19 logs an error for any <script> encountered during a
 * client render, and that script only ever needs to run from the
 * server-rendered HTML — so it lives in the document head instead. See
 * `themeScript` below and its use in app/layout.tsx.
 */

const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

function readStored(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    /* Storage is unavailable in private mode; fall through to the default. */
  }
  return "dark";
}

function readSystem(): Resolved {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function resolve(theme: Theme): Resolved {
  return theme === "system" ? readSystem() : theme;
}

/** Mirrors what the head script does, for changes made after first paint. */
function paint(resolved: Resolved) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

const onSystemChange = () => {
  if (readStored() === "system") paint(readSystem());
  notify();
};

const onStorageChange = (event: StorageEvent) => {
  if (event.key !== THEME_STORAGE_KEY) return;
  paint(resolve(readStored()));
  notify();
};

/* One set of DOM listeners for the whole app, not one per consumer. */
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.matchMedia(DARK_QUERY).addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorageChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.matchMedia(DARK_QUERY).removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorageChange);
    }
  };
}

/* Snapshots stay primitives so React can compare them without caching. */
const themeSnapshot = () => readStored();
const serverTheme = (): Theme => "dark";
const resolvedSnapshot = () => resolve(readStored());
/* The server cannot know the OS preference, so callers get `undefined` until
   hydration rather than a guess that flashes the wrong colours. */
const serverResolved = (): Resolved | undefined => undefined;

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, themeSnapshot, serverTheme);
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    resolvedSnapshot,
    serverResolved,
  );

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* Not persisting is survivable; applying the theme is not. */
    }
    paint(resolve(next));
    notify();
  }, []);

  return { theme, resolvedTheme, setTheme };
}

/**
 * Runs before first paint so the page never flashes the wrong theme. Inlined
 * into <head> as a plain string, which keeps it out of React's client render.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}")||"dark";var d=t==="dark"||(t==="system"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}})()`;
