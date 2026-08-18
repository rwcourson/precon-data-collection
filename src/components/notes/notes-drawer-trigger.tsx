"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { getRoundNotes, type NotesDirectoryUser } from "@/actions/notes";
import { NotesThread, type NotesThreadNote } from "@/components/notes/notes-thread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function NotesDrawerTrigger({
  roundId,
  jobName,
  estimatePhase,
  noteCount,
  latestPreview,
  currentUserId,
  canModerate,
}: {
  roundId: number;
  jobName: string;
  estimatePhase: string;
  noteCount: number;
  latestPreview?: string;
  currentUserId: number;
  canModerate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<NotesThreadNote[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [directory, setDirectory] = useState<NotesDirectoryUser[]>([]);
  const [jobId, setJobId] = useState(0);
  const [canAssignUsers, setCanAssignUsers] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getRoundNotes(roundId)
      .then((payload) => {
        if (cancelled) return;
        setNotes(payload.notes);
        setDirectory(payload.directory);
        setJobId(payload.jobId);
        setCanAssignUsers(payload.canAssignUsers);
      })
      .catch((error) => {
        if (cancelled) return;
        setNotes([]);
        setLoadError(error instanceof Error ? error.message : "You cannot load notes for this effort.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, roundId]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setLoadError(null);
          setNotes(null);
        }
      }}
    >
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="relative"
            aria-label={noteCount > 0 ? `${noteCount} notes` : "Add a note"}
            data-testid="notes-drawer-trigger"
          />
        }
      >
        <MessageSquare className="size-3.5" />
        {noteCount > 0 ? (
          <Badge variant="secondary" size="sm" className="absolute -top-1 -right-1 px-1">
            {noteCount}
          </Badge>
        ) : null}
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-lg" data-testid="notes-drawer">
        <SheetHeader>
          <SheetTitle>Effort notes</SheetTitle>
          <SheetDescription>
            {jobName} · {estimatePhase}
            {latestPreview ? ` — ${latestPreview}` : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          {loadError ? (
            <p className="px-1 py-6 text-sm text-destructive" role="alert">
              {loadError}
            </p>
          ) : notes ? (
            <NotesThread
              roundId={roundId}
              currentUserId={currentUserId}
              canModerate={canModerate}
              initialNotes={notes}
              directory={directory}
              jobId={jobId}
              canAssignUsers={canAssignUsers}
            />
          ) : (
            <p className="px-1 py-6 text-sm text-muted-foreground">Loading notes…</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
