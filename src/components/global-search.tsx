"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  Search,
  Sheet,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Hit = { href: string; label: string; hint?: string };
type SearchResult = { pages: Hit[]; jobs: Hit[]; rounds: Hit[]; sheets: Hit[] };

const EMPTY: SearchResult = { pages: [], jobs: [], rounds: [], sheets: [] };

const QUICK: Hit[] = [
  { href: "/bid-schedule", label: "Bid Schedule" },
  { href: "/post-bid", label: "Post-Bid Entry" },
  { href: "/sheets", label: "Sheets" },
  { href: "/dashboards", label: "Dashboards" },
  { href: "/reports", label: "Report Builder" },
  { href: "/admin", label: "Admin" },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const seq = useRef(0);
  const titleId = useId();

  const resetSearch = useCallback(() => {
    setQuery("");
    setResults(EMPTY);
    setLoading(false);
    setError(null);
    seq.current += 1;
  }, []);

  const setOpenSafe = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) resetSearch();
    },
    [resetSearch],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpenSafe(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpenSafe]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 1) return;

    const mySeq = ++seq.current;
    const controller = new AbortController();

    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (mySeq !== seq.current) return;
        if (!res.ok) {
          setError("Search failed. Try again.");
          setResults(EMPTY);
          return;
        }
        setResults((await res.json()) as SearchResult);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (mySeq !== seq.current) return;
        setError("Search failed. Try again.");
        setResults(EMPTY);
      } finally {
        if (mySeq === seq.current) setLoading(false);
      }
    }, 160);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [query, open]);

  const go = useCallback(
    (href: string) => {
      setOpenSafe(false);
      router.push(href);
    },
    [router, setOpenSafe],
  );

  const q = query.trim();
  const activeResults = q.length < 1 ? EMPTY : results;
  const hasResults =
    activeResults.pages.length +
      activeResults.jobs.length +
      activeResults.rounds.length +
      (activeResults.sheets?.length ?? 0) >
    0;
  const showQuick = q.length === 0;
  const showEmpty = q.length > 0 && !loading && !hasResults && !error;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => setOpenSafe(true)}
        className="hidden h-10 min-w-[14rem] gap-2.5 border-border/80 bg-card px-3 text-muted-foreground md:inline-flex"
      >
        <Search className="size-5" />
        <span className="text-sm">Search…</span>
        <kbd className="pointer-events-none ml-auto hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground md:inline">
          ⌘K
        </kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpenSafe(true)}
        className="size-10 md:hidden"
        aria-label="Search"
      >
        <Search className="size-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpenSafe}>
        <DialogContent
          showCloseButton={false}
          className="top-[max(1rem,env(safe-area-inset-top))] w-full max-w-[calc(100%-1.5rem)] translate-y-0 gap-0 overflow-hidden rounded-md p-0 sm:top-[18%] sm:max-w-lg"
          aria-labelledby={titleId}
        >
          <DialogHeader className="sr-only">
            <DialogTitle id={titleId}>Search</DialogTitle>
            <DialogDescription>
              Search pages, jobs, and estimate rounds across the app
            </DialogDescription>
          </DialogHeader>

          <Command shouldFilter={false} loop className="rounded-md border-0">
            <div className="relative">
              <CommandInput
                placeholder="Search jobs, rounds, pages…"
                value={query}
                onValueChange={setQuery}
              />
              {loading && (
                <Loader2 className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            <CommandList className="max-h-[min(22rem,60vh)]">
              {error && (
                <div className="px-3 py-6 text-center text-xs text-destructive">
                  {error}
                </div>
              )}

              {showQuick && (
                <CommandGroup heading="Jump to">
                  {QUICK.map((p) => (
                    <CommandItem
                      key={p.href}
                      value={`quick-${p.href}`}
                      onSelect={() => go(p.href)}
                    >
                      <LayoutDashboard className="size-3.5 opacity-60" />
                      <span>{p.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {showEmpty && (
                <CommandEmpty>No matches for “{q}”.</CommandEmpty>
              )}

              {hasResults && (
                <>
                  {activeResults.pages.length > 0 && (
                    <CommandGroup heading="Pages">
                      {activeResults.pages.map((p) => (
                        <CommandItem
                          key={`page-${p.href}`}
                          value={`page-${p.href}-${p.label}`}
                          onSelect={() => go(p.href)}
                        >
                          <LayoutDashboard className="size-3.5 opacity-60" />
                          <span>{p.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {activeResults.sheets?.length > 0 && (
                    <>
                      {activeResults.pages.length > 0 && <CommandSeparator />}
                      <CommandGroup heading="Sheets">
                        {activeResults.sheets.map((s) => (
                          <CommandItem
                            key={`sheet-${s.href}`}
                            value={`sheet-${s.href}-${s.label}`}
                            onSelect={() => go(s.href)}
                          >
                            <Sheet className="size-3.5 shrink-0 opacity-60" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate">{s.label}</p>
                              {s.hint && (
                                <p className="truncate text-2xs text-muted-foreground">
                                  {s.hint}
                                </p>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}

                  {activeResults.jobs.length > 0 && (
                    <>
                      {(activeResults.pages.length > 0 || activeResults.sheets?.length > 0) && (
                        <CommandSeparator />
                      )}
                      <CommandGroup heading="Jobs">
                        {activeResults.jobs.map((j) => (
                          <CommandItem
                            key={`job-${j.href}`}
                            value={`job-${j.href}-${j.label}`}
                            onSelect={() => go(j.href)}
                          >
                            <FolderKanban className="size-3.5 shrink-0 opacity-60" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate">{j.label}</p>
                              {j.hint && (
                                <p className="truncate text-2xs text-muted-foreground">
                                  {j.hint}
                                </p>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}

                  {activeResults.rounds.length > 0 && (
                    <>
                      {(activeResults.pages.length > 0 || activeResults.jobs.length > 0) && (
                        <CommandSeparator />
                      )}
                      <CommandGroup heading="Estimate rounds">
                        {activeResults.rounds.map((r) => (
                          <CommandItem
                            key={`round-${r.href}`}
                            value={`round-${r.href}-${r.label}`}
                            onSelect={() => go(r.href)}
                          >
                            <CalendarRange className="size-3.5 shrink-0 opacity-60" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate">{r.label}</p>
                              {r.hint && (
                                <p className="truncate text-2xs text-muted-foreground">
                                  {r.hint}
                                </p>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </>
              )}
            </CommandList>

            <div className="hidden items-center justify-between border-t px-3 py-2 text-2xs text-muted-foreground sm:flex">
              <span>↑↓ navigate · ↵ open · esc close</span>
              <span>⌘K</span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
