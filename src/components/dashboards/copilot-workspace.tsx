"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  askMagnus,
  saveCopilotDashboard,
  type CopilotPreviewResult,
} from "@/actions/copilot";
import { WidgetCanvas } from "@/components/dashboards/widget-canvas";
import { MagnusIcon } from "@/components/magnus-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatItem =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      preview?: CopilotPreviewResult | null;
      engine?: string;
    };

const SUGGESTIONS = [
  "What's our win rate in Florida?",
  "Build a region scorecard",
  "Pursuit volume by year",
];

export function CopilotWorkspace() {
  const [prompt, setPrompt] = useState("");
  const [chat, setChat] = useState<ChatItem[]>([
    {
      role: "assistant",
      text: "Ask about pursuit volume, win rate, fees, regions — or ask me to build a dashboard view you can save.",
    },
  ]);
  const [preview, setPreview] = useState<CopilotPreviewResult | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const run = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPrompt("");
    setChat((c) => [...c, { role: "user", text: trimmed }]);
    startTransition(async () => {
      try {
        const result = await askMagnus(trimmed);
        if (result.preview) setPreview(result.preview);
        setChat((c) => [
          ...c,
          {
            role: "assistant",
            text: result.turn.text,
            preview: result.preview,
            engine: result.turn.engine,
          },
        ]);
        requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Magnus could not respond");
        setChat((c) => [
          ...c,
          { role: "assistant", text: e instanceof Error ? e.message : "Something went wrong." },
        ]);
      }
    });
  };

  const save = () => {
    if (!preview) return;
    startTransition(async () => {
      try {
        const id = await saveCopilotDashboard(preview.plan);
        toast.success("Dashboard saved to Studio");
        router.push(`/dashboards/studio/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });
  };

  return (
    <div className="grid min-h-[70vh] gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-md border bg-card lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)]">
        <div className="flex items-center gap-2.5 border-b bg-muted/40 px-3.5 py-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <MagnusIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">Magnus AI</p>
            <p className="text-2xs text-muted-foreground">Claude Opus 5 · ZDR</p>
          </div>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
          {chat.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-6 rounded-md bg-primary px-3 py-2 text-xs leading-relaxed text-primary-foreground"
                  : "rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-foreground/90"
              }
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.role === "assistant" && m.preview && (
                <p className="mt-2 border-t border-border/60 pt-2 text-2xs text-muted-foreground">
                  Canvas updated with {m.preview.plan.widgets.length} widgets
                  {m.preview.plan.widgets[0]
                    ? ` · ${m.preview.plan.widgets
                        .slice(0, 3)
                        .map((w) => w.title)
                        .join(", ")}`
                    : ""}
                  .
                </p>
              )}
            </div>
          ))}
          {pending && (
            <div className="flex items-center gap-2 px-1 text-2xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin text-primary" />
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {chat.length <= 1 && (
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
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask a question, or describe a dashboard…"
            className="min-h-[88px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run(prompt);
              }
            }}
          />
          <Button
            className="w-full gap-1.5"
            size="sm"
            disabled={pending || !prompt.trim()}
            onClick={() => run(prompt)}
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

      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {preview?.plan.name ?? "Canvas"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {preview
                ? preview.plan.description
                : "Ask about win rate, volume, or fees — answers stay in chat and a Power BI–style view appears here."}
            </p>
          </div>
          {preview && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" size="sm">
                {preview.plan.widgets.length} widgets
              </Badge>
              <Badge variant="info" size="sm">
                {preview.plan.engine === "opus5-zdr" ? "Opus 5 · ZDR" : "Rules"}
              </Badge>
              <Button size="sm" className="gap-1.5" disabled={pending} onClick={save}>
                {pending ? (
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
          <WidgetCanvas widgets={preview.widgets} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/30 px-6 py-20 text-center">
            <span className="flex size-11 items-center justify-center rounded-md bg-info-soft text-primary">
              <Sparkles className="size-5" />
            </span>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              Ask something like “What’s our win rate in Florida?” or “Build a region scorecard.”
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
