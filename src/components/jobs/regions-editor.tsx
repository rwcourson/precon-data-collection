"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import {
  addJobRegionVisibility,
  addJobUserVisibility,
  getJobVisibility,
  removeJobRegionVisibility,
  removeJobUserVisibility,
} from "@/actions/visibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type JobVisibilityState = Awaited<ReturnType<typeof getJobVisibility>>;

const SECTION_LABEL = "text-sm font-medium text-muted-foreground";

function personLine(person: { name: string; title?: string | null }) {
  return person.title ? `${person.name} · ${person.title}` : person.name;
}

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
  const [addUserId, setAddUserId] = useState<string>("");

  const visibleRegions = state.allRegions.filter((region) => state.regions.includes(region));
  const visibleSet = useMemo(() => new Set(state.regions), [state.regions]);
  const pinnedIds = useMemo(() => new Set(state.pins.map((pin) => pin.userId)), [state.pins]);

  const peopleByRegion = useMemo(() => {
    const groups = new Map<string, JobVisibilityState["directory"]>();
    for (const region of visibleRegions) groups.set(region, []);
    for (const user of state.directory) {
      if (!user.region || !groups.has(user.region)) continue;
      groups.get(user.region)!.push(user);
    }
    return groups;
  }, [state.directory, visibleRegions]);

  const oneOffs = state.pins.filter((pin) => !pin.region || !visibleSet.has(pin.region));

  const addCandidates = useMemo(() => {
    const byRegion = new Map<string, JobVisibilityState["directory"]>();
    for (const user of state.directory) {
      if (pinnedIds.has(user.id)) continue;
      if (user.region && visibleSet.has(user.region)) continue;
      const key = user.region ?? "Other";
      const list = byRegion.get(key) ?? [];
      list.push(user);
      byRegion.set(key, list);
    }
    return [...byRegion.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [pinnedIds, state.directory, visibleSet]);

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

  function addPerson() {
    const userId = Number(addUserId);
    if (!Number.isInteger(userId) || userId <= 0) return;
    startTransition(async () => {
      try {
        await addJobUserVisibility({ jobId, userId });
        setAddUserId("");
        setState(await getJobVisibility(jobId));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not add that person");
      }
    });
  }

  function removePerson(userId: number) {
    startTransition(async () => {
      try {
        await removeJobUserVisibility({ jobId, userId });
        setState(await getJobVisibility(jobId));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not remove that person");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className={SECTION_LABEL}>Visible in</p>
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
                  "rounded-full border px-2.5 py-0.5 text-sm",
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

      <div>
        <p className={SECTION_LABEL}>Team</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone in a visible region can already see this job. Add someone from
          another region if they need access on their own.
        </p>

        <div className="mt-3 space-y-3">
          {visibleRegions.map((region) => {
            const people = peopleByRegion.get(region) ?? [];
            return (
              <div key={region}>
                <p className="text-sm font-medium">
                  {region}
                  {region === state.homeRegion ? " · home" : ""}
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    {people.length === 1 ? "1 person" : `${people.length} people`}
                  </span>
                </p>
                {people.length > 0 ? (
                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                    {people.map((user) => (
                      <li key={user.id} className="text-sm leading-6">
                        {user.name}
                        {user.title ? (
                          <span className="ml-1.5 text-muted-foreground">{user.title}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Everyone in {region} can see this job.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium">Added individually</p>
          {oneOffs.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {oneOffs.map((pin) => (
                <Badge key={pin.userId} variant="secondary" className="gap-1 text-sm">
                  {personLine(pin)}
                  {pin.region ? ` · ${pin.region}` : ""}
                  {state.canAssignUsers && (
                    <button
                      type="button"
                      onClick={() => removePerson(pin.userId)}
                      aria-label={`Remove ${pin.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No one-off people yet.</p>
          )}

          {state.canAssignUsers ? (
            <div className="mt-2 flex gap-2">
              <Select
                items={addCandidates.flatMap(([, people]) =>
                  people.map((user) => ({ value: String(user.id), label: personLine(user) })),
                )}
                value={addUserId}
                onValueChange={(value) => setAddUserId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Add someone from another region…" />
                </SelectTrigger>
                <SelectContent>
                  {addCandidates.length === 0 ? (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                      Everyone in the directory is already covered.
                    </p>
                  ) : (
                    addCandidates.map(([region, people]) => (
                      <SelectGroup key={region}>
                        <SelectLabel>{region}</SelectLabel>
                        {people.map((user) => (
                          <SelectItem key={user.id} value={String(user.id)}>
                            {personLine(user)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" onClick={addPerson} disabled={pending || !addUserId}>
                <UserPlus className="size-3.5" /> Add
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
