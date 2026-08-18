"use client";

import type { NotesDirectoryUser } from "@/actions/notes";
import { formatMentionToken } from "@/lib/note-body";

export function mentionTrigger(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  if (before.endsWith("@[") || /@\[\d*$/.test(before)) return null;
  const match = before.match(/@([^\s@[]*)$/);
  if (!match) return null;
  return { start: caret - match[0].length, query: match[1].toLowerCase() };
}

export function MentionPicker({
  users,
  query,
  activeIndex,
  onPick,
}: {
  users: NotesDirectoryUser[];
  query: string;
  activeIndex: number;
  onPick: (user: NotesDirectoryUser) => void;
}) {
  const filtered = users
    .filter((user) => {
      const hay = `${user.name} ${user.title ?? ""} ${user.region ?? ""}`.toLowerCase();
      return hay.includes(query);
    })
    .slice(0, 8);
  if (filtered.length === 0) {
    return (
      <p
        role="status"
        data-testid="mention-picker"
        className="absolute bottom-full z-20 mb-1 w-full rounded-md border bg-popover px-2.5 py-2 text-sm text-muted-foreground shadow-md"
      >
        No matching people
      </p>
    );
  }
  return (
    <ul
      role="listbox"
      data-testid="mention-picker"
      className="absolute bottom-full z-20 mb-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
    >
      {filtered.map((user, index) => (
        <li key={user.id} role="option" aria-selected={index === activeIndex}>
          <button
            type="button"
            aria-label={`Mention ${user.name}`}
            className={`flex w-full flex-col items-start rounded px-2 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              index === activeIndex ? "bg-accent" : "hover:bg-muted/70"
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
