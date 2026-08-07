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
import { ROLE_LABELS } from "@/lib/permissions";
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
            className="gap-2 border-border bg-card pl-1.5"
            disabled={pending}
          />
        }
      >
        <span className="flex size-6 items-center justify-center rounded bg-muted text-muted-foreground">
          <UserRound className="size-3.5" />
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-xs font-medium">{current.name}</span>
          <span className="text-2xs text-muted-foreground">
            {ROLE_LABELS[current.role]}
          </span>
        </span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          Demo persona — switch to view the app as any role
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
