/** Note body is always stored and rendered as text. Never interpret HTML. */
export function escapeNoteHtml(body: string): string {
  return body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Phase 6: `@[userId]` tokens. Display name is resolved at render time. */
export type NoteBodyToken = { type: "text"; value: string } | { type: "mention"; userId: number };

export function splitNoteBodyTokens(body: string): NoteBodyToken[] {
  const tokens: NoteBodyToken[] = [];
  const re = /@\[(\d+)\]/g;
  let last = 0;
  for (const match of body.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ type: "text", value: body.slice(last, index) });
    tokens.push({ type: "mention", userId: Number(match[1]) });
    last = index + match[0].length;
  }
  if (last < body.length) tokens.push({ type: "text", value: body.slice(last) });
  return tokens.length > 0 ? tokens : [{ type: "text", value: body }];
}

export function extractMentionUserIds(body: string): number[] {
  return [
    ...new Set(
      splitNoteBodyTokens(body)
        .filter((token): token is Extract<NoteBodyToken, { type: "mention" }> => token.type === "mention")
        .map((token) => token.userId)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
}

export function formatMentionToken(userId: number): string {
  return `@[${userId}]`;
}

export function mentionLabel(userId: number, names: Record<number, string>): string {
  return `@${names[userId] ?? `user ${userId}`}`;
}

export const mentionChipClassName =
  "inline-flex align-baseline whitespace-nowrap rounded-sm bg-primary/15 px-1.5 py-0.5 font-medium text-primary";

export function formatAttachmentBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function firstLine(body: string, max = 120): string {
  const line = body.split(/\r?\n/)[0]?.trim() ?? "";
  if (line.length <= max) return line;
  return `${line.slice(0, max - 1)}…`;
}

export function previewLatestNote(note: {
  authorName: string | null;
  createdAt: Date | string;
  body: string;
} | null): string {
  if (!note) return "";
  const age = relativeAge(note.createdAt);
  const author = note.authorName?.trim() || "Someone";
  const line = firstLine(note.body);
  return line ? `${author} · ${age} — ${line}` : `${author} · ${age}`;
}

export function relativeAge(value: Date | string, now = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  const ms = now.getTime() - date.getTime();
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
