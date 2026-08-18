"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEveAgent } from "eve/react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { WidgetCanvas } from "@/components/dashboards/widget-canvas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CopilotPlan } from "@/lib/dashboard-copilot";
import type { WidgetResolved } from "@/lib/dashboard-query";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Which upcoming efforts in my region have no team assigned?",
  "What efforts did Marcus Webb work in 2026?",
  "What did notes say about the ROM package?",
  "Build a region scorecard",
];

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
  const open = messages.length > 0 || pending;
  const chart = useMemo(() => extractChart(messages), [messages]);
  const table = useMemo(() => extractTableRows(messages), [messages]);

  const run = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setInput("");
    send(trimmed);
  };

  return (
    <div
      data-testid="copilot-shell"
      data-state={open ? "open" : "idle"}
      className={cn(
        "copilot-shell grid min-h-[min(36rem,78dvh)] transition-[grid-template-columns,place-items] duration-500 ease-out motion-reduce:transition-none",
        open
          ? "grid-cols-1 items-stretch lg:grid-cols-[minmax(17rem,1fr)_minmax(0,2fr)]"
          : "place-items-center",
      )}
    >
      <section
        className={cn(
          "flex w-full flex-col",
          open
            ? "max-w-none"
            : "max-w-xl items-center text-center",
        )}
      >
        {!open && (
          <div className="mb-6 space-y-2">
            <span className="inline-flex size-11 items-center justify-center rounded-md bg-info-soft text-primary">
              <Sparkles className="size-5" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">Ask precon</h1>
            <p className="text-sm text-muted-foreground">
              Efforts, notes, staffing, and people history — scoped to what you can see.
            </p>
          </div>
        )}

        {open && (
          <div className="mb-3 max-h-[46vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(78dvh-11rem)]">
            {messages.map((message) => {
              const text = extractText(message);
              if (!text) return null;
              return (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-6 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
                  }
                >
                  {text}
                </div>
              );
            })}
            {pending && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Working…
              </p>
            )}
          </div>
        )}

        <div className={cn("w-full space-y-3", open && "mt-auto")}>
          {!open && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={pending}
                  onClick={() => run(suggestion)}
                  className="min-h-8 rounded-md border bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-info-border hover:bg-info-soft hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about staffing, notes, a person, or a chart…"
            className="min-h-[88px] resize-none text-sm"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                run(input);
              }
            }}
          />
          <Button
            className="w-full gap-1.5"
            size="sm"
            disabled={pending || !input.trim()}
            onClick={() => run(input)}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            Send
          </Button>
        </div>
      </section>

      {open && (
        <section
          data-testid="copilot-canvas"
          className="min-w-0 space-y-4 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
          data-chart-tokens="product"
        >
          {chart ? (
            <div className="space-y-3" data-testid="copilot-chart">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{chart.plan.name}</h2>
                <p className="text-xs text-muted-foreground">{chart.plan.description}</p>
              </div>
              <WidgetCanvas widgets={chart.widgets} loading={pending && !chart.widgets.length} />
            </div>
          ) : table && table.rows.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{table.title}</caption>
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    {Object.keys(table.rows[0] ?? {})
                      .slice(0, 6)
                      .map((key) => (
                        <th key={key} className="px-3 py-2 font-medium">
                          {key}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.slice(0, 24).map((row, index) => (
                    <tr key={index} className="border-t">
                      {Object.keys(table.rows[0] ?? {})
                        .slice(0, 6)
                        .map((key) => (
                          <td key={key} className="px-3 py-2 align-top">
                            {String(row[key] ?? "—")}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-[16rem] items-center justify-center rounded-md border border-dashed bg-muted/30 px-6 text-sm text-muted-foreground">
              {pending
                ? "Streaming…"
                : table
                  ? "No matching rows in your scope."
                  : "Answers, tables, and charts land here."}
            </div>
          )}
        </section>
      )}
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
