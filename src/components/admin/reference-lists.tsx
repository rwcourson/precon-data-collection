"use client";

import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addReferenceValue, setReferenceValueRetired } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ListValue = { id: number; value: string; retired: boolean };
type RefList = { key: string; label: string; values: ListValue[] };

export function ReferenceListsManager({
  lists,
  canEdit,
}: {
  lists: RefList[];
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState(lists[0]?.key ?? "");
  const [newValue, setNewValue] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const list = lists.find((l) => l.key === selected);

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <Card className="h-fit lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Lists</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0.5 px-3">
          {lists.map((l) => (
            <button
              type="button"
              key={l.key}
              onClick={() => setSelected(l.key)}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent ${
                selected === l.key
                  ? "bg-accent font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {l.label}
              <Badge variant="secondary" size="sm">
                {l.values.filter((v) => !v.retired).length}
              </Badge>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{list?.label}</CardTitle>
          <CardDescription>
            Dropdown fields must match these managed values — no free-text
            override. Retired values stay on historical records but disappear
            from new entry.
            {!canEdit && " Only the Corporate Precon Admin can edit."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {canEdit && (
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newValue.trim() || !list) return;
                startTransition(async () => {
                  try {
                    await addReferenceValue(list.key, newValue);
                    toast.success(`Added "${newValue}" to ${list.label}`);
                    setNewValue("");
                    router.refresh();
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Add failed"
                    );
                  }
                });
              }}
            >
              <Input
                placeholder={`Add a new ${list?.label} value…`}
                className="h-8 w-72 text-sm"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                disabled={pending || !newValue.trim()}
              >
                <Plus className="size-3.5" /> Add
              </Button>
            </form>
          )}
          <div className="flex flex-wrap gap-1.5">
            {list?.values.map((v) => (
              <span
                key={v.id}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                  v.retired
                    ? "border-dashed bg-muted/50 text-muted-foreground line-through"
                    : "bg-background"
                }`}
              >
                {v.value}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="-mr-1 size-5 text-muted-foreground"
                    title={
                      v.retired
                        ? "Restore"
                        : "Retire (historical records keep it)"
                    }
                    aria-label={`${v.retired ? "Restore" : "Retire"} ${v.value}`}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await setReferenceValueRetired(v.id, !v.retired);
                          router.refresh();
                        } catch (err) {
                          toast.error(
                            err instanceof Error ? err.message : "Update failed"
                          );
                        }
                      })
                    }
                  >
                    {v.retired ? <ArchiveRestore /> : <Archive />}
                  </Button>
                )}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
