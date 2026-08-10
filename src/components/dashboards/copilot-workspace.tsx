"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  saveCopilotDashboard,
  type CopilotPreviewResult,
} from "@/actions/copilot";
import { WidgetCanvas } from "@/components/dashboards/widget-canvas";
import { MagnusIcon } from "@/components/magnus-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CopilotPlan } from "@/lib/dashboard-copilot";
import type { WidgetResolved } from "@/lib/dashboard-query";

const SUGGESTIONS = [
  "What's our win rate in Florida?",
  "Build a region scorecard",
  "Pursuit volume by year",
  "Executive summary report with charts",
];

type PlanPayload = {
  plan?: CopilotPlan;
  widgets?: WidgetResolved[];
};

function extractText(message: {
  parts?: Array<{ type: string; text?: string }>;
}): string {
  if (!message.parts?.length) return "";
  return message.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text ?? "")
    .join("");
}

function asPreview(payload: PlanPayload | null | undefined): CopilotPreviewResult | null {
  if (!payload?.plan?.widgets) return null;
  return {
    plan: payload.plan,
    widgets: payload.widgets ?? [],
  };
}

function extractDashboardPreview(message: {
  parts?: Array<Record<string, unknown>>;
}): CopilotPreviewResult | null {
  if (!message.parts?.length) return null;

  for (const part of message.parts) {
    const type = String(part.type ?? "");

    if (type === "data-dashboard") {
      const data = part.data as PlanPayload | undefined;
      const preview = asPreview(data);
      if (preview) return preview;
    }

    // Tool results: plan_dashboard / refine_dashboard / plan_dashboard_rules
    if (
      type === "tool-plan_dashboard" ||
      type === "tool-refine_dashboard" ||
      type === "tool-plan_dashboard_rules" ||
      /tool-.*plan_dashboard/.test(type) ||
      /tool-.*refine_dashboard/.test(type)
    ) {
      const state = String(part.state ?? "");
      if (
        state &&
        state !== "output-available" &&
        state !== "result" &&
        state !== "done"
      ) {
        continue;
      }
      const output = (part.output ?? part.result) as PlanPayload | undefined;
      const preview = asPreview(output);
      if (preview) return preview;
    }
  }
  return null;
}

function toolStatusLabel(part: Record<string, unknown>): string | null {
  const type = String(part.type ?? "");
  if (!type.startsWith("tool-")) return null;
  const name = type.replace(/^tool-/, "");
  const state = String(part.state ?? "");
  if (
    state === "input-streaming" ||
    state === "input-available" ||
    state === "call" ||
    state === "partial-call"
  ) {
    if (/portfolio|brief|metric|answer/.test(name)) return "Querying portfolio…";
    if (/plan|refine|dashboard/.test(name)) return "Building scorecard…";
    return "Working…";
  }
  return null;
}

export function CopilotWorkspace() {
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<CopilotPreviewResult | null>(null);
  const previewRef = useRef<CopilotPreviewResult | null>(null);
  const [savePending, startSave] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/v1/ai/magnus",
        prepareSendMessagesRequest: ({ messages, id, body, trigger, messageId }) => ({
          body: {
            ...body,
            id,
            messages,
            trigger,
            messageId,
            previousPlan: previewRef.current?.plan ?? null,
          },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
  });

  const pending = status === "submitted" || status === "streaming";

  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;
      const found = extractDashboardPreview(msg as never);
      if (found) {
        setPreview(found);
        break;
      }
    }
  }, [messages]);

  useEffect(() => {
    if (error) toast.error(error.message || "Magnus could not respond");
  }, [error]);

  useEffect(() => {
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
    );
  }, [messages, pending]);

  const run = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setInput("");
    void sendMessage({ text: trimmed });
  };

  const save = () => {
    if (!preview?.plan) return;
    startSave(async () => {
      try {
        const id = await saveCopilotDashboard(preview.plan);
        toast.success("Dashboard saved to Studio");
        router.push(`/dashboards/studio/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const liveStatus =
    lastAssistant?.parts
      ?.map((p) => toolStatusLabel(p as Record<string, unknown>))
      .find(Boolean) ?? null;

  return (
    <div className="grid min-h-[70vh] gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-md border bg-card lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)]">
        <div className="flex items-center gap-2.5 border-b bg-muted/40 px-3.5 py-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <MagnusIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">Magnus AI</p>
            <p className="text-2xs text-muted-foreground">
              Claude Opus 5 · ZDR · cobalt charts
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
          {messages.length === 0 && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-foreground/90">
              Ask about pursuit volume, win rate, fees, regions — or ask me to
              build a Power BI–style dashboard you can save.
            </div>
          )}
          {messages.map((m) => {
            const text = extractText(m as never);
            const dash =
              m.role === "assistant" ? extractDashboardPreview(m as never) : null;
            return (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "ml-6 rounded-md bg-primary px-3 py-2 text-xs leading-relaxed text-primary-foreground"
                    : "rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-foreground/90"
                }
              >
                {text ? (
                  <p className="whitespace-pre-wrap">{text}</p>
                ) : m.role === "assistant" && pending ? (
                  <p className="text-muted-foreground">Thinking…</p>
                ) : null}
                {dash && (
                  <p className="mt-2 border-t border-border/60 pt-2 text-2xs text-muted-foreground">
                    Canvas updated with {dash.plan.widgets.length} widgets
                    {dash.plan.widgets[0]
                      ? ` · ${dash.plan.widgets
                          .slice(0, 3)
                          .map((w) => w.title)
                          .join(", ")}`
                      : ""}
                    .
                  </p>
                )}
              </div>
            );
          })}
          {pending && (
            <div className="flex items-center gap-2 px-1 text-2xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin text-primary" />
              {liveStatus ?? "Thinking…"}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 border-t px-3.5 py-2.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={pending}
                onClick={() => run(s)}
                className="rounded-md border bg-background px-2 py-1 text-2xs text-muted-foreground transition-colors hover:border-info-border hover:bg-info-soft hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t p-3.5">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question, or describe a dashboard…"
            className="min-h-[88px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
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
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
            Send
          </Button>
        </div>
      </aside>

      <section className="min-w-0 space-y-4" data-chart-palette="cobalt">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {preview?.plan.name ?? "Canvas"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {preview
                ? preview.plan.description
                : "Ask about win rate, volume, or fees — answers stream in chat and a Power BI–style cobalt canvas appears here."}
            </p>
            {preview?.plan.rationale?.length ? (
              <p className="mt-1.5 text-2xs text-muted-foreground">
                {preview.plan.rationale.slice(0, 3).join(" · ")}
              </p>
            ) : null}
          </div>
          {preview && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" size="sm">
                {preview.plan.widgets.length} widgets
              </Badge>
              <Badge variant="info" size="sm">
                {preview.plan.engine === "opus5-zdr" ? "Opus 5 · ZDR" : "Rules"}
              </Badge>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={savePending || pending}
                onClick={save}
              >
                {savePending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save view
              </Button>
            </div>
          )}
        </div>
        {preview ? (
          <WidgetCanvas
            widgets={preview.widgets}
            loading={pending && !preview.widgets.length}
          />
        ) : pending ? (
          <WidgetCanvas widgets={[]} loading />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/30 px-6 py-20 text-center">
            <span className="flex size-11 items-center justify-center rounded-md bg-info-soft text-primary">
              <Sparkles className="size-5" />
            </span>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              Ask something like “What’s our win rate in Florida?” or “Build a
              region scorecard.”
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
