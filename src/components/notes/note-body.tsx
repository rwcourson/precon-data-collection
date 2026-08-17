"use client";

import { splitNoteBodyTokens } from "@/lib/note-body";

export function NoteBody({
  body,
  names = {},
}: {
  body: string;
  names?: Record<number, string>;
}) {
  const tokens = splitNoteBodyTokens(body);
  return (
    <span className="whitespace-pre-wrap break-words">
      {tokens.map((token, index) =>
        token.type === "mention" ? (
          <span
            key={index}
            data-mention={token.userId}
            className="rounded-sm bg-primary/15 px-1 py-0.5 font-medium text-primary"
          >
            @{names[token.userId] ?? `user ${token.userId}`}
          </span>
        ) : (
          <span key={index}>{token.value}</span>
        ),
      )}
    </span>
  );
}
