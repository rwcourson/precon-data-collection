/**
 * Latest effort note for reports and exports.
 *
 * Print/Excel policy: one note per round (most recent, not the thread),
 * author + date + body, truncated at PRINT_NOTE_MAX_CHARS with an ellipsis.
 * Soft-deleted notes are never included.
 */

export const LATEST_NOTE_KEY = "latestNote";
export const LATEST_NOTE_LABEL = "Latest note";
export const LATEST_NOTE_EMPTY_LABEL = "Add the first note";
export const LATEST_NOTE_ERROR_LABEL = "Notes unavailable";
export const PRINT_NOTE_MAX_CHARS = 300;

/** Board Notes column copy. SSR waits on the join; this labels empty vs load failure. */
export function latestNoteBoardDisplay(
  text: string | null | undefined,
  loadFailed = false
): string {
  if (loadFailed) return LATEST_NOTE_ERROR_LABEL;
  const value = text?.trim() ?? "";
  return value || LATEST_NOTE_EMPTY_LABEL;
}

export type LatestNoteSource = {
  authorName: string | null;
  createdAt: Date | string;
  body: string;
};

export function truncatePrintNote(
  body: string,
  max = PRINT_NOTE_MAX_CHARS
): string {
  const collapsed = body.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, Math.max(0, max - 1))}…`;
}

export function formatLatestNoteDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Author · date — truncated body. Empty body still keeps author + date. */
export function formatLatestNoteCell(
  note: LatestNoteSource,
  maxChars = PRINT_NOTE_MAX_CHARS
): string {
  const author = note.authorName?.trim() || "Someone";
  const date = formatLatestNoteDate(note.createdAt);
  const text = truncatePrintNote(note.body, maxChars);
  return text ? `${author} · ${date} — ${text}` : `${author} · ${date}`;
}
