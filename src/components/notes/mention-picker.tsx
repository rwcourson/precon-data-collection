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
  return users
    .filter((user) => {
      const hay = `${user.name} ${user.title ?? ""} ${user.region ?? ""}`.toLowerCase();
      return hay.includes(query);
    })
    .slice(0, 8);
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
          "w-full rounded-md border bg-popover px-2.5 py-2 text-sm text-muted-foreground shadow-md",
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
        "max-h-56 w-full overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 shadow-md",
        className,
      )}
    >
      {filtered.map((user, index) => (
        <li key={user.id} role="option" aria-selected={index === activeIndex}>
          <button
            type="button"
            aria-label={`Mention ${user.name}`}
            className={`flex w-full flex-col items-start rounded-md px-1.5 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 ${
              index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/70"
            }`}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(user);
            }}
          >
            <span className="font-medium">{user.name}</span>
            <span className="text-2xs text-muted-foreground">
              {[user.title, user.region].filter(Boolean).join(" · ")}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const PICKER_MAX_HEIGHT = 224;
const PICKER_MIN_HEIGHT = 96;
const PICKER_GAP = 6;

export function AnchoredMentionPicker({
  anchorRef,
  ...pickerProps
}: MentionPickerProps & { anchorRef: RefObject<HTMLElement | null> }) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const spaceAbove = rect.top - PICKER_GAP;
    const spaceBelow = window.innerHeight - rect.bottom - PICKER_GAP;
    const openAbove = spaceAbove >= PICKER_MIN_HEIGHT || spaceAbove >= spaceBelow;
    const available = openAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(PICKER_MIN_HEIGHT, Math.min(PICKER_MAX_HEIGHT, available));
    setStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
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
  }, [update]);

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
