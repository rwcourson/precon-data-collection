"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pin, X } from "lucide-react";
import {
  addJobRegionVisibility,
  addJobUserVisibility,
  getJobVisibility,
  removeJobRegionVisibility,
  removeJobUserVisibility,
} from "@/actions/visibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type JobVisibilityState = Awaited<ReturnType<typeof getJobVisibility>>;

export function RegionsEditor({
  jobId,
  initial,
}: {
  jobId: number;
  initial: JobVisibilityState;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [pinUserId, setPinUserId] = useState<string>("");

  function toggleRegion(region: string, enabled: boolean) {
    startTransition(async () => {
      try {
        if (enabled) await addJobRegionVisibility({ jobId, region });
        else await removeJobRegionVisibility({ jobId, region });
        setState(await getJobVisibility(jobId));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update region");
      }
    });
  }

  function pinUser() {
    const userId = Number(pinUserId);
    if (!Number.isInteger(userId) || userId <= 0) return;
    startTransition(async () => {
      try {
        await addJobUserVisibility({ jobId, userId });
        setPinUserId("");
        setState(await getJobVisibility(jobId));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not pin user");
      }
    });
  }

  function unpinUser(userId: number) {
    startTransition(async () => {
      try {
        await removeJobUserVisibility({ jobId, userId });
        setState(await getJobVisibility(jobId));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not remove pin");
      }
    });
  }

  const pinNames = new Map(state.directory.map((user) => [user.id, user.name]));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Visible in</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {state.allRegions.map((region) => {
            const on = state.regions.includes(region);
            const isHome = region === state.homeRegion;
            const canToggle = state.manageableRegions.includes(region) && !isHome;
            return (
              <button
                key={region}
                type="button"
                disabled={!canToggle || pending}
                onClick={() => toggleRegion(region, !on)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs",
                  on ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground",
                  !canToggle && "cursor-default opacity-80",
                )}
                title={
                  isHome
                    ? "Home region cannot be removed"
                    : canToggle
                      ? on
                        ? `Hide from ${region}`
                        : `Show in ${region}`
                      : "You can only change your own region"
                }
              >
                {region}
                {isHome ? " · home" : ""}
              </button>
            );
          })}
        </div>
      </div>

      {state.canAssignUsers && (
        <div className="space-y-1.5">
          <Label className="text-xs">Pin a person</Label>
          <div className="flex gap-2">
            <Select value={pinUserId} onValueChange={(value) => setPinUserId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose someone…" />
              </SelectTrigger>
              <SelectContent>
                {state.directory
                  .filter((user) => !state.pins.some((pin) => pin.userId === user.id))
                  .map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.name}
                      {user.region ? ` · ${user.region}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button type="button" size="sm" onClick={pinUser} disabled={pending || !pinUserId}>
              <Pin className="size-3.5" /> Pin
            </Button>
          </div>
        </div>
      )}

      {state.pins.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {state.pins.map((pin) => (
            <Badge key={pin.userId} variant="secondary" className="gap-1">
              {pinNames.get(pin.userId) ?? `User ${pin.userId}`}
              {state.canAssignUsers && (
                <button type="button" onClick={() => unpinUser(pin.userId)} aria-label="Remove pin">
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
