"use client";

import {
  useCallback,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { NotesDirectoryUser } from "@/actions/notes";
import { formatMentionToken } from "@/lib/note-body";
import { cn } from "@/lib/utils";

export function mentionTrigger(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  if (before.endsWith("@[") || /@\[\d*$/.test(before)) return null;
  const match = before.match(/@([^\s@[]*)$/);
  if (!match) return null;
  return { start: caret - match[0].length, query: match[1].toLowerCase() };
}

type MentionPickerProps = {
  users: NotesDirectoryUser[];
  query: string;
  activeIndex: number;
  onPick: (user: NotesDirectoryUser) => void;
  className?: string;
};

export function filterMentionUsers(users: NotesDirectoryUser[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return users
    .map((user) => {
      const name = user.name.toLowerCase();
      const words = name.split(/\s+/);
      const title = (user.title ?? "").toLowerCase();
      const region = (user.region ?? "").toLowerCase();
      let score = 0;
      if (name.startsWith(q)) score = 300;
      else if (words.some((word) => word.startsWith(q))) score = 200;
      else if (q.length >= 2 && name.includes(q)) score = 100;
      else if (q.length >= 2 && title.split(/\s+/).some((word) => word.startsWith(q))) score = 40;
      else if (q.length >= 2 && region.startsWith(q)) score = 20;
      else return null;
      return { user, score, name };
    })
    .filter((row): row is { user: NotesDirectoryUser; score: number; name: string } => row != null)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 6)
    .map((row) => row.user);
}

export function MentionPicker({
  users,
  query,
  activeIndex,
  onPick,
  className,
}: MentionPickerProps) {
  const filtered = filterMentionUsers(users, query);
  if (filtered.length === 0) {
    return (
      <p
        role="status"
        data-testid="mention-picker"
        className={cn(
          "w-full rounded-md border bg-popover px-2 py-1.5 text-xs text-muted-foreground shadow-md",
          className,
        )}
      >
        No matching people
      </p>
    );
  }
  return (
    <ul
      role="listbox"
      data-testid="mention-picker"
      className={cn(
        "max-h-44 w-full overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 shadow-md",
        className,
      )}
    >
      {filtered.map((user, index) => (
        <li key={user.id} role="option" aria-selected={index === activeIndex}>
          <button
            type="button"
            aria-label={`Mention ${user.name}`}
            className={`flex w-full flex-col items-start rounded-md px-1.5 py-1 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 ${
              index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/70"
            }`}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(user);
            }}
          >
            <span className="font-medium">{user.name}</span>
            <span className="text-xs text-muted-foreground">
              {[user.title, user.region].filter(Boolean).join(" · ")}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const PICKER_MAX_HEIGHT = 176;
const PICKER_MIN_HEIGHT = 72;
const PICKER_GAP = 6;
const PICKER_WIDTH = 288;

export function AnchoredMentionPicker({
  anchorRef,
  ...pickerProps
}: MentionPickerProps & { anchorRef: RefObject<HTMLElement | null> }) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const spaceAbove = Math.max(0, rect.top - PICKER_GAP);
    const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - PICKER_GAP);
    // Stay above the composer so the list never covers the note you are typing.
    const openAbove = spaceAbove >= PICKER_MIN_HEIGHT || spaceAbove >= spaceBelow;
    const available = openAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(PICKER_MAX_HEIGHT, Math.max(PICKER_MIN_HEIGHT, available));
    const width = Math.min(PICKER_WIDTH, Math.max(220, rect.width));
    setStyle({
      position: "fixed",
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
      maxHeight,
      zIndex: 50,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + PICKER_GAP }
        : { top: rect.bottom + PICKER_GAP }),
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [pickerProps.query, pickerProps.users, update]);

  if (!style || typeof document === "undefined") return null;

  return createPortal(
    <div style={style}>
      <MentionPicker {...pickerProps} className="max-h-full" />
    </div>,
    document.body,
  );
}

export function insertMention(
  body: string,
  caret: number,
  start: number,
  user: NotesDirectoryUser,
): { body: string; caret: number } {
  const token = `${formatMentionToken(user.id)} `;
  const next = `${body.slice(0, start)}${token}${body.slice(caret)}`;
  return { body: next, caret: start + token.length };
}
