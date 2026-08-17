"use client";

import { useTransition } from "react";
import { switchUser } from "@/actions/user";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, UserRound } from "lucide-react";
import type { User } from "@/db/schema";
import { ROLE_LABELS } from "@/lib/labels";
import { useRouter } from "next/navigation";

export function RoleSwitcher({ users, current }: { users: User[]; current: User }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="h-10 max-w-[46vw] gap-2 border-border bg-card py-1.5 pl-2 pr-2 sm:max-w-none sm:gap-2.5 sm:pr-2.5"
            disabled={pending}
          />
        }
      >
        <span className="flex size-7 items-center justify-center rounded bg-muted text-muted-foreground">
          <UserRound className="size-4" />
        </span>
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className="max-w-[28vw] truncate text-sm font-medium sm:max-w-none">{current.name}</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {ROLE_LABELS[current.role]}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(18rem,calc(100vw-1.5rem))]">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          View as another role (Central RPD is the default)
        </div>
        <DropdownMenuSeparator />
        {users.map((u) => (
          <DropdownMenuItem
            key={u.id}
            className={u.id === current.id ? "bg-accent" : ""}
            onClick={() =>
              startTransition(async () => {
                await switchUser(u.id);
                router.refresh();
              })
            }
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{u.name}</span>
              <span className="text-xs text-muted-foreground">
                {ROLE_LABELS[u.role]}
                {u.region ? ` — ${u.region}` : " — Company-wide"}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
