"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createRoundNoteFromForm,
  deleteRoundNote,
  editRoundNote,
  previewRoundNoteMentions,
  type NotesDirectoryUser,
} from "@/actions/notes";
import { addJobUserVisibility } from "@/actions/visibility";
import { Button } from "@/components/ui/button";
import { NoteBody } from "@/components/notes/note-body";
import { NoteComposer } from "@/components/notes/note-composer";
import {
  AnchoredMentionPicker,
  filterMentionUsers,
  insertMention,
  mentionTrigger,
} from "@/components/notes/mention-picker";
import { formatAttachmentBytes, relativeAge } from "@/lib/note-body";
import { fmtDateTime } from "@/lib/format";

export type NotesThreadNote = {
  id: number;
  roundId: number;
  body: string;
  createdAt: Date | string;
  editedAt: Date | string | null;
  authorUserId: number;
  authorName: string;
  authorTitle: string | null;
  attachments: {
    id: number;
    filename: string;
    contentType: string;
    sizeBytes: number;
  }[];
};

export function NotesThread({
  roundId,
  currentUserId,
  canModerate,
  initialNotes,
  directory = [],
  jobId,
  canAssignUsers = false,
  highlightNoteId = null,
}: {
  roundId: number;
  currentUserId: number;
  canModerate: boolean;
  initialNotes: NotesThreadNote[];
  directory?: NotesDirectoryUser[];
  jobId?: number;
  canAssignUsers?: boolean;
  highlightNoteId?: number | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState(0);
  const [notes, setNotes] = useState(initialNotes);
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [picker, setPicker] = useState<{ start: number; query: string } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [blockedMentions, setBlockedMentions] = useState<{ userId: number; name: string }[]>([]);
  const names = useMemo(
    () => Object.fromEntries(directory.map((user) => [user.id, user.name])),
    [directory],
  );

  useEffect(() => {
    if (!highlightNoteId) return;
    const el = document.getElementById(`note-${highlightNoteId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightNoteId, notes]);

  function refreshFrom(next: NotesThreadNote[]) {
    setNotes(next);
    router.refresh();
  }

  function applyMention(user: NotesDirectoryUser) {
    if (!picker) return;
    const next = insertMention(body, caret, picker.start, user);
    setBody(next.body);
    setCaret(next.caret);
    setPicker(null);
    composerRef.current?.focus();
  }

  function onSubmit(formData: FormData) {
    const trimmed = String(formData.get("body") ?? "").trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const preview = await previewRoundNoteMentions(roundId, trimmed);
        const blocked = preview.mentions.filter((row) => !row.canRead);
        setBlockedMentions(blocked.map((row) => ({ userId: row.userId, name: row.name })));
        const optimistic: NotesThreadNote = {
          id: -Date.now(),
          roundId,
          body: trimmed,
          createdAt: new Date(),
          editedAt: null,
          authorUserId: currentUserId,
          authorName: "You",
          authorTitle: null,
          attachments: [],
        };
        setNotes((prev) => [...prev, optimistic]);
        setBody("");
        const created = await createRoundNoteFromForm(formData);
        setNotes((prev) => [...prev.filter((note) => note.id !== optimistic.id), created]);
        formRef.current?.reset();
        router.refresh();
      } catch (err) {
        setBody(trimmed);
        toast.error(err instanceof Error ? err.message : "Could not post the note");
      }
    });
  }

  function saveEdit(noteId: number) {
    startTransition(async () => {
      try {
        const updated = await editRoundNote({ noteId, body: editBody });
        setNotes((prev) => prev.map((note) => (note.id === noteId ? updated : note)));
        setEditingId(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not edit the note");
      }
    });
  }

  function remove(noteId: number) {
    const previous = notes;
    setNotes((prev) => prev.filter((note) => note.id !== noteId));
    startTransition(async () => {
      try {
        await deleteRoundNote({ noteId });
        router.refresh();
      } catch (err) {
        refreshFrom(previous);
        toast.error(err instanceof Error ? err.message : "Could not delete the note");
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="notes-thread">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-2">
        {notes.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            No notes yet — start the history for this effort
          </p>
        ) : (
          notes.map((note) => {
            const created = note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt);
            const own = note.authorUserId === currentUserId;
            return (
              <article
                key={note.id}
                id={note.id > 0 ? `note-${note.id}` : undefined}
                className={`rounded-md border bg-card px-3 py-2.5 ${
                  highlightNoteId === note.id ? "ring-2 ring-primary" : ""
                }`}
                data-testid="note-item"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {note.authorName}
                      {note.authorTitle ? (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          {note.authorTitle}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-2xs text-muted-foreground">
                      {fmtDateTime(created)} · {relativeAge(created)}
                      {note.editedAt ? " (edited)" : ""}
                    </p>
                  </div>
                  {note.id > 0 && (own || canModerate) ? (
                    <div className="flex gap-0.5">
                      {own ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Edit note"
                          onClick={() => {
                            setEditingId(note.id);
                            setEditBody(note.body);
                          }}
                        >
                          <Pencil />
                        </Button>
                      ) : null}
                      {(own || canModerate) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Delete note"
                          onClick={() => remove(note.id)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
                {editingId === note.id ? (
                  <div className="mt-2 space-y-2">
                    <NoteComposer
                      value={editBody}
                      names={names}
                      onValueChange={(next) => setEditBody(next)}
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" disabled={pending} onClick={() => saveEdit(note.id)}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 text-sm">
                    <NoteBody body={note.body} names={names} />
                  </p>
                )}
                {note.attachments.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {note.attachments.map((file) => (
                      <li key={file.id}>
                        <a
                          href={`/api/notes/attachments/${file.id}`}
                          className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-2xs hover:bg-muted"
                        >
                          <Paperclip className="size-3" />
                          {file.filename}
                          <span className="text-muted-foreground">
                            {formatAttachmentBytes(file.sizeBytes)}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })
        )}
      </div>
      <form
        ref={formRef}
        className="mt-3 space-y-2 border-t pt-3"
        action={onSubmit}
      >
        <input type="hidden" name="roundId" value={roundId} />
        <div>
          {picker ? (
            <AnchoredMentionPicker
              anchorRef={composerRef}
              users={directory}
              query={picker.query}
              activeIndex={activeIndex}
              onPick={(user) => applyMention(user)}
            />
          ) : null}
          <NoteComposer
            name="body"
            value={body}
            names={names}
            caret={caret}
            editorRef={composerRef}
            placeholder="Add a note — @ to mention someone"
            testId="note-composer"
            onValueChange={(next, nextCaret) => {
              setBody(next);
              setCaret(nextCaret);
              const nextPicker = mentionTrigger(next, nextCaret);
              setPicker(nextPicker);
              if (nextPicker?.start !== picker?.start || nextPicker?.query !== picker?.query) {
                setActiveIndex(0);
              }
            }}
            onKeyDown={(event) => {
              if (!picker) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => index + 1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(0, index - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const matches = filterMentionUsers(directory, picker.query);
                const user = matches[Math.min(activeIndex, Math.max(0, matches.length - 1))];
                if (user) applyMention(user);
              } else if (event.key === "Escape") {
                setPicker(null);
              }
            }}
          />
        </div>
        {blockedMentions.length > 0 ? (
          <p className="text-xs text-amber-700 dark:text-amber-300" data-testid="mention-access-warning">
            {blockedMentions.map((row) => row.name).join(", ")} cannot see this effort — mention
            will not notify them.
            {canAssignUsers && jobId
              ? blockedMentions.map((row) => (
                  <Button
                    key={row.userId}
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="ml-1"
                    onClick={() =>
                      startTransition(async () => {
                        await addJobUserVisibility({ jobId, userId: row.userId });
                        toast.success(`Pinned ${row.name} to this job`);
                      })
                    }
                  >
                    Pin {row.name}
                  </Button>
                ))
              : null}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input
            type="file"
            name="files"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx,.csv,.msg,.eml"
            className="max-w-[16rem] text-xs text-muted-foreground"
          />
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>
            {pending ? "Posting…" : "Post note"}
          </Button>
        </div>
      </form>
    </div>
  );
}
