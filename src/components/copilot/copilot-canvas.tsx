"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEveAgent } from "eve/react";
import { ArrowUp, BarChart3, ClipboardList, Loader2, UserRound, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CopilotMarkdown } from "@/components/copilot/copilot-markdown";
import { WidgetCanvas } from "@/components/dashboards/widget-canvas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  columnDisplayLabel,
  formatColumnValue,
  tableColumnKeys,
} from "@/lib/column-labels";
import type { CopilotPlan } from "@/lib/dashboard-copilot";
import type { WidgetResolved } from "@/lib/dashboard-query";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  {
    label: "Staffing",
    prompt: "Which upcoming efforts in my region have no team assigned?",
    icon: Users,
  },
  {
    label: "People",
    prompt: "What efforts did Marcus Webb work in 2026?",
    icon: UserRound,
  },
  {
    label: "Notes",
    prompt: "What did notes say about the ROM package?",
    icon: ClipboardList,
  },
  {
    label: "Charts",
    prompt: "Build a region scorecard",
    icon: BarChart3,
  },
] as const;

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: Array<Record<string, unknown>>;
};

type ChartPreview = {
  plan: CopilotPlan;
  widgets: WidgetResolved[];
};

function extractText(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => String(part.text))
    .join("");
}

function toolName(part: Record<string, unknown>): string {
  const type = String(part.type ?? "");
  if (type.startsWith("tool-")) return type.replace(/^tool-/, "");
  if (type === "dynamic-tool") return String(part.toolName ?? part.name ?? "");
  return "";
}

function toolOutput(part: Record<string, unknown>): unknown {
  const state = String(part.state ?? "");
  if (state && !["output-available", "result", "done"].includes(state)) return null;
  return part.output ?? part.result ?? null;
}

function extractChart(messages: ChatMessage[]): ChartPreview | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      const name = toolName(part);
      if (!/plan_chart|plan_dashboard|refine_dashboard/.test(name)) continue;
      const output = toolOutput(part) as ChartPreview | null;
      if (output?.plan?.widgets && output.widgets) return output;
    }
  }
  return null;
}

const TOOL_LABELS: Record<string, string> = {
  query_efforts: "Reading efforts",
  query_needs_staffing: "Checking staffing",
  search_notes: "Searching notes",
  person_history: "Looking up people",
  plan_chart: "Building the chart",
  plan_dashboard: "Laying out the scorecard",
  refine_dashboard: "Refining the layout",
  get_portfolio_brief: "Gathering the brief",
};

function extractActivity(messages: ChatMessage[]): { label: string; done: boolean }[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    const steps: { label: string; done: boolean }[] = [];
    for (const part of message.parts) {
      const name = toolName(part);
      if (!name) continue;
      const state = String(part.state ?? "");
      steps.push({
        label: TOOL_LABELS[name] ?? name.replaceAll("_", " "),
        done: ["output-available", "result", "done"].includes(state),
      });
    }
    return steps;
  }
  return [];
}

function pendingHint(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const text = lastUser ? extractText(lastUser).toLowerCase() : "";
  if (/scorecard|dashboard/.test(text)) return "Laying out the scorecard";
  if (/chart|graph/.test(text)) return "Building the chart";
  if (/staff/.test(text)) return "Checking staffing";
  if (/note/.test(text)) return "Searching notes";
  if (/history|worked|who/.test(text)) return "Looking up people";
  return "Working on your question";
}

function CopilotStreamingStage({
  hint,
  steps,
}: {
  hint: string;
  steps: { label: string; done: boolean }[];
}) {
  const active = steps.find((step) => !step.done)?.label ?? hint;
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{active}…</p>
        <div className="copilot-progress">
          <span />
        </div>
        {steps.length > 0 ? (
          <ul className="space-y-1">
            {steps.map((step, index) => (
              <li
                key={`${step.label}-${index}`}
                className={cn(
                  "text-2xs",
                  step.done ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {step.done ? "Done · " : "Now · "}
                {step.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <div className="copilot-shimmer h-7 rounded-md lg:col-span-5" />
        <div className="hidden lg:col-span-7 lg:block" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="copilot-shimmer h-24 rounded-lg lg:col-span-3" />
        ))}
        <div className="copilot-shimmer h-52 rounded-lg lg:col-span-6" />
        <div className="copilot-shimmer h-52 rounded-lg lg:col-span-6" />
      </div>
    </div>
  );
}

function extractTableRows(messages: ChatMessage[]): { title: string; rows: Record<string, unknown>[] } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      const name = toolName(part);
      const output = toolOutput(part);
      if (!output) continue;
      if (name === "query_needs_staffing" || name === "query_efforts") {
        const rows = Array.isArray(output) ? output : [];
        return { title: name === "query_needs_staffing" ? "Needs staffing" : "Efforts", rows };
      }
      if (name === "search_notes" && Array.isArray(output)) {
        return { title: "Notes", rows: output as Record<string, unknown>[] };
      }
      if (name === "person_history" && output && typeof output === "object") {
        const efforts = (output as { efforts?: Record<string, unknown>[] }).efforts ?? [];
        return { title: "Person history", rows: efforts };
      }
    }
  }
  return null;
}

function CopilotResultTable({
  title,
  rows,
}: {
  title: string;
  rows: Record<string, unknown>[];
}) {
  const columns = tableColumnKeys(rows[0] ?? {});
  return (
    <div className="copilot-result-enter overflow-x-auto rounded-lg border bg-card">
      <table className="w-full table-fixed text-left text-sm">
        <caption className="sr-only">{title}</caption>
        <colgroup>
          {columns.map((key) => (
            <col
              key={key}
              style={{ width: key === "jobName" ? "36%" : `${Math.round(64 / Math.max(columns.length - 1, 1))}%` }}
            />
          ))}
        </colgroup>
        <thead className="bg-muted/40 text-2xs tracking-wide text-muted-foreground">
          <tr>
            {columns.map((key) => (
              <th key={key} className="px-3 py-2 font-medium">
                {columnDisplayLabel(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 24).map((row, index) => (
            <tr key={index} className="border-t">
              {columns.map((key) => (
                <td
                  key={key}
                  className={cn(
                    "px-3 py-2 align-top",
                    key === "jobName" ? "truncate" : "whitespace-nowrap",
                  )}
                  title={formatColumnValue(key, row[key])}
                >
                  {formatColumnValue(key, row[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function adaptEveMessages(
  messages: ReadonlyArray<{ id: string; role: string; parts: readonly unknown[] }>,
): ChatMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.id,
      role: message.role as "user" | "assistant",
      parts: message.parts as Array<Record<string, unknown>>,
    }));
}

const magnusTransport = new DefaultChatTransport({
  api: "/api/v1/ai/magnus",
});

function CopilotShell({
  messages,
  pending,
  send,
}: {
  messages: ChatMessage[];
  pending: boolean;
  send: (text: string) => void;
}) {
  const [input, setInput] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);
  const open = messages.length > 0 || pending;
  const chart = useMemo(() => extractChart(messages), [messages]);
  const table = useMemo(() => extractTableRows(messages), [messages]);
  const activity = useMemo(() => extractActivity(messages), [messages]);
  const lastIsUser = messages[messages.length - 1]?.role === "user";
  const showStreaming = pending && (lastIsUser || (!chart && !(table && table.rows.length > 0)));

  useEffect(() => {
    if (lastIsUser) pinnedToBottomRef.current = true;
  }, [lastIsUser]);

  useEffect(() => {
    const el = threadRef.current;
    if (!open || !el || !pinnedToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, pending, open]);

  const run = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    pinnedToBottomRef.current = true;
    setInput("");
    send(trimmed);
  };

  return (
    <div
      data-testid="copilot-shell"
      data-state={open ? "open" : "idle"}
      className="copilot-shell"
    >
      <section
        className={cn(
          "mx-auto flex w-full flex-col transition-[max-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          open ? "max-w-none self-stretch" : "max-w-xl justify-center",
        )}
      >
        {!open ? (
          <p className="mb-2 text-center text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Copilot
          </p>
        ) : null}
        <h1
          className={cn(
            "copilot-title font-heading font-semibold tracking-tight text-foreground",
            open ? "mb-3 text-left text-sm" : "text-center text-[1.75rem] leading-tight",
          )}
        >
          Ask precon
        </h1>

        <div className="copilot-hero" aria-hidden={open} inert={open}>
          <div className="copilot-hero-inner">
            <p className="mx-auto mt-2 max-w-md text-center text-sm leading-relaxed text-muted-foreground text-pretty">
              Efforts, notes, staffing, and people history — scoped to what you can see.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((suggestion) => {
                const Icon = suggestion.icon;
                return (
                  <button
                    key={suggestion.prompt}
                    type="button"
                    disabled={pending}
                    onClick={() => run(suggestion.prompt)}
                    className="rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-info-border hover:bg-info-soft/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      <Icon className="size-3.5 text-primary" />
                      {suggestion.label}
                    </span>
                    <span className="mt-1 block text-[13px] leading-snug text-foreground">
                      {suggestion.prompt}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          ref={threadRef}
          onScroll={() => {
            const el = threadRef.current;
            if (!el) return;
            pinnedToBottomRef.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 56;
          }}
          className={cn(
            "copilot-thread min-h-0 space-y-2.5 overflow-y-auto overscroll-contain pr-0.5",
            open ? "mb-3 max-h-[42vh] flex-1 lg:max-h-none" : "hidden",
          )}
        >
          {messages.map((message) => {
            const text = extractText(message);
            if (!text) return null;
            if (message.role === "user") {
              return (
                <div
                  key={message.id}
                  className="ml-auto max-w-[92%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                >
                  {text}
                </div>
              );
            }
            return (
              <div key={message.id} className="rounded-lg bg-muted/40 px-3 py-2.5">
                <CopilotMarkdown text={text} />
              </div>
            );
          })}
          {pending ? (
            <p className="flex items-center gap-2 px-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1" aria-hidden>
                <span className="copilot-dot" />
                <span className="copilot-dot" />
                <span className="copilot-dot" />
              </span>
              {pendingHint(messages)}
            </p>
          ) : null}
        </div>

        <div className={cn("w-full", open && "mt-auto")}>
          <div className="rounded-xl border bg-card shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about staffing, notes, a person, or a chart…"
              aria-label="Ask precon"
              className={cn(
                "resize-none border-0 bg-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent",
                open ? "min-h-16" : "min-h-[5.5rem]",
              )}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  run(input);
                }
              }}
            />
            <div className="flex items-center justify-end px-2 pb-2">
              <Button
                className="gap-1.5"
                size={open ? "icon-sm" : "sm"}
                disabled={pending || !input.trim()}
                onClick={() => run(input)}
                aria-label="Send"
              >
                <ArrowUp className="size-4" />
                {!open && "Send"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section
        data-testid="copilot-canvas"
        className="copilot-stage space-y-4"
        data-chart-tokens="product"
        aria-hidden={!open}
      >
        {showStreaming ? (
          <CopilotStreamingStage hint={pendingHint(messages)} steps={activity} />
        ) : chart ? (
          <div className="copilot-result-enter space-y-3" data-testid="copilot-chart">
            {pending ? (
              <div className="copilot-progress mb-1">
                <span />
              </div>
            ) : null}
            <div>
              <h2 className="font-heading text-lg font-semibold tracking-tight">{chart.plan.name}</h2>
              <p className="text-xs text-muted-foreground">{chart.plan.description}</p>
            </div>
            <WidgetCanvas widgets={chart.widgets} loading={pending && !chart.widgets.length} />
          </div>
        ) : table && table.rows.length > 0 ? (
          <CopilotResultTable title={table.title} rows={table.rows} />
        ) : (
          <div className="flex h-full min-h-[16rem] items-center justify-center rounded-lg border border-dashed bg-muted/25 px-6 text-sm text-muted-foreground">
            {table ? "No matching rows in your scope." : "Answers, tables, and charts land here."}
          </div>
        )}
      </section>
    </div>
  );
}

function EveCopilot() {
  const agent = useEveAgent({
    onError: (error) => toast.error(error.message || "Copilot could not respond"),
  });
  const pending = agent.status === "submitted" || agent.status === "streaming";
  return (
    <CopilotShell
      messages={adaptEveMessages(agent.data.messages)}
      pending={pending}
      send={(text) => {
        void agent.send(text);
      }}
    />
  );
}

function MagnusCopilot() {
  const { messages, sendMessage, status, error } = useChat({
    transport: magnusTransport,
  });
  useEffect(() => {
    if (error) toast.error(error.message || "Copilot could not respond");
  }, [error]);
  return (
    <CopilotShell
      messages={messages as unknown as ChatMessage[]}
      pending={status === "submitted" || status === "streaming"}
      send={(text) => {
        void sendMessage({ text });
      }}
    />
  );
}

export function CopilotCanvas() {
  const [mode, setMode] = useState<"eve" | "magnus" | "pending">("pending");

  useEffect(() => {
    let cancelled = false;
    fetch("/eve/v1/health")
      .then((response) => {
        if (!cancelled) setMode(response.ok ? "eve" : "magnus");
      })
      .catch(() => {
        if (!cancelled) setMode("magnus");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (mode === "pending") {
    return (
      <div className="flex min-h-[min(36rem,78dvh)] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Starting copilot…
      </div>
    );
  }
  return mode === "eve" ? <EveCopilot /> : <MagnusCopilot />;
}
