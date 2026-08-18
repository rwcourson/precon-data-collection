"use client";

import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchWorkspace } from "@/actions/user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CORPORATE, type Workspace } from "@/lib/workspace";

export function WorkspaceSwitcher({
  workspace,
  accents,
  corporateAccent,
}: {
  workspace: Workspace;
  accents: Record<string, string>;
  corporateAccent: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const select = (value: string) =>
    startTransition(async () => {
      await switchWorkspace(value);
      router.refresh();
    });

  const onlyOne =
    workspace.available.length <= 1 && !workspace.canViewCorporate;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="gap-2 border-border bg-card pl-2"
            disabled={pending || onlyOne}
          />
        }
      >
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: workspace.accent }}
          aria-hidden
        />
        <span className="text-xs font-medium">{workspace.label}</span>
        {pending ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : (
          !onlyOne && (
            <ChevronsUpDown className="size-3.5 text-muted-foreground" />
          )
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          Region workspace — scopes Bid Schedule, Post-Bid, Dashboards, and
          Reports
        </div>
        <DropdownMenuSeparator />
        {workspace.canViewCorporate && (
          <>
            <DropdownMenuItem onClick={() => select(CORPORATE)}>
              <Building2
                className="size-3.5"
                style={{ color: corporateAccent }}
              />
              <span className="text-sm">Corporate — all Regions</span>
              {workspace.region == null && (
                <Check className="ml-auto size-3.5" />
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {workspace.available.map((r) => (
          <DropdownMenuItem key={r} onClick={() => select(r)}>
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: accents[r] }}
              aria-hidden
            />
            <span className="text-sm">{r}</span>
            {workspace.region === r && <Check className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
