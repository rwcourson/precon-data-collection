import Link from "next/link";
import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getAllUsers, getCurrentUser } from "@/lib/current-user";
import { NotificationsBell } from "./notifications-bell";
import { RoleSwitcher } from "./role-switcher";
import { MobileNav } from "./mobile-nav";
import { GlobalSearch } from "./global-search";
import { ThemeToggle } from "./theme-toggle";
import { authMode } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/labels";
import type { User } from "@/db/schema";
export async function AppHeader() {
  let user: User | null = null;
  let users: User[] = [];
  try {
    [user, users] = await Promise.all([getCurrentUser(), getAllUsers()]);
  } catch {
    user = null;
    users = [];
  }

  const items =
    user != null
      ? await db
          .select()
          .from(notifications)
          .where(eq(notifications.userId, user.id))
          .orderBy(desc(notifications.createdAt))
          .limit(20)
      : [];

  return (
    <header className="sticky top-0 z-20 border-b bg-card/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4 md:px-10 xl:px-14">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>
          <p className="hidden text-sm text-muted-foreground md:block">
            Preconstruction Data Collection
          </p>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-0.5 sm:gap-2">
          {user ? (
            <>
              <GlobalSearch />
              {authMode() === "demo" ? (
                <RoleSwitcher users={users} current={user} />
              ) : (
                <SignedInUser user={user} />
              )}
              <NotificationsBell
                items={items.map((item) => ({
                  ...item,
                  createdAtLabel: fmtDateTime(item.createdAt),
                }))}
              />
            </>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex h-7 items-center rounded-md border border-border bg-card px-2.5 text-xs font-medium hover:bg-accent"
            >
              Sign in
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/** Under SSO the identity is fixed, so it is shown rather than offered. */
function SignedInUser({ user }: { user: User }) {
  return (
    <div className="flex h-10 max-w-[42vw] items-center gap-2 rounded-md border border-border/80 bg-card px-2.5 sm:max-w-none sm:gap-2.5 sm:px-3">
      <span className="truncate text-sm font-medium">{user.name}</span>
      <span className="hidden text-xs text-muted-foreground md:inline">
        {ROLE_LABELS[user.role]}
        {user.region ? ` · ${user.region}` : ""}
      </span>
    </div>
  );
}
