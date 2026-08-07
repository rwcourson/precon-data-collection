"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { markAllNotificationsRead } from "@/actions/user";
import { fmtDateTime } from "@/lib/format";

type Item = {
  id: number;
  title: string;
  body: string | null;
  roundId: number | null;
  readAt: Date | null;
  createdAt: Date;
};

export function NotificationsBell({ items }: { items: Item[] }) {
  const unread = items.filter((n) => !n.readAt).length;
  const [, startTransition] = useTransition();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
            }
          />
        }
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-2xs font-semibold text-white tabular-nums"
          >
            {unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => startTransition(() => markAllNotificationsRead())}
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications
            </p>
          )}
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.roundId ? `/rounds/${n.roundId}` : "#"}
              className={`block border-b px-4 py-3 last:border-0 hover:bg-accent ${
                n.readAt ? "opacity-60" : ""
              }`}
            >
              <p className="text-sm font-medium">{n.title}</p>
              {n.body && (
                <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
              )}
              <p className="mt-1 text-2xs text-muted-foreground">
                {fmtDateTime(n.createdAt)}
              </p>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
