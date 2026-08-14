"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteBidScheduleView,
  saveBidScheduleView,
  type BidScheduleViewRow,
} from "@/actions/bid-schedule-views";
import { bidScheduleViewHref, type BidScheduleViewQuery } from "@/lib/bid-schedule";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SavedViewsMenu({
  views,
  currentUserId,
  activeViewId,
  config,
  shareLabel,
}: {
  views: BidScheduleViewRow[];
  currentUserId: number;
  activeViewId?: number;
  config: BidScheduleViewQuery;
  shareLabel: string;
}) {
  const router = useRouter();
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [pending, startTransition] = useTransition();

  const active = views.find((v) => v.id === activeViewId);

  const onSave = () => {
    startTransition(async () => {
      try {
        await saveBidScheduleView(name, config, shared);
        toast.success("Saved view");
        setSaveOpen(false);
        setName("");
        setShared(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save the view");
      }
    });
  };

  const onDelete = (id: number) => {
    startTransition(async () => {
      try {
        await deleteBidScheduleView(id);
        toast.success("Deleted view");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete the view");
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="sm" className="gap-1.5" />}
        >
          <Bookmark className="size-3.5" />
          {active ? active.name : "Views"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {views.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No saved views yet.</p>
          )}
          {views.map((view) => (
            <DropdownMenuItem
              key={view.id}
              className="gap-2"
              render={<Link href={bidScheduleViewHref(view.config, view.id)} />}
            >
              <span className="min-w-0 flex-1 truncate">{view.name}</span>
              {view.shared && (
                <span className="text-2xs text-muted-foreground">shared</span>
              )}
              {view.ownerId === currentUserId && (
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Delete ${view.name}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(view.id);
                  }}
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSaveOpen(true)}>Save current view…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Bid Schedule view</DialogTitle>
            <DialogDescription>
              Stores columns, grouping, sort, and the current section. Personal by default;
              sharing follows the region workspace (BRD §6 templates).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="view-name">Name</Label>
              <Input
                id="view-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My working set"
                autoFocus
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={shared} onCheckedChange={(v) => setShared(Boolean(v))} />
              {shareLabel}
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={!name.trim() || pending}>
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
