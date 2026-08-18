"use client";

import { mentionChipClassName, mentionLabel, splitNoteBodyTokens } from "@/lib/note-body";

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
            className={mentionChipClassName}
          >
            {mentionLabel(token.userId, names)}
          </span>
        ) : (
          <span key={index}>{token.value}</span>
        ),
      )}
    </span>
  );
}
