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
import { WorkspaceSwitcher } from "./workspace-switcher";
import { CORPORATE_ACCENT, REGION_ACCENTS } from "@/lib/workspace";
import { getWorkspace } from "@/lib/workspace-server";
import { authMode } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import type { User } from "@/db/schema";

export async function AppHeader() {
  const [user, users, workspace] = await Promise.all([
    getCurrentUser(),
    getAllUsers(),
    getWorkspace(),
  ]);
  const items = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(20);

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center justify-between gap-3 border-b bg-card/90 px-6 backdrop-blur-sm md:px-10 xl:px-14">
      <div className="flex items-center gap-2">
        <Suspense fallback={null}>
          <MobileNav />
        </Suspense>
        <p className="hidden text-[13px] text-muted-foreground sm:block">
          Preconstruction Data Collection
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <WorkspaceSwitcher
          workspace={workspace}
          accents={REGION_ACCENTS}
          corporateAccent={CORPORATE_ACCENT}
        />
        <GlobalSearch />
        <ThemeToggle />
        <NotificationsBell items={items} />
        {authMode() === "demo" ? (
          <RoleSwitcher users={users} current={user} />
        ) : (
          <SignedInUser user={user} />
        )}
      </div>
    </header>
  );
}

/** Under SSO the identity is fixed, so it is shown rather than offered. */
function SignedInUser({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-2.5 py-1">
      <span className="text-[13px] font-medium">{user.name}</span>
      <span className="hidden text-2xs text-muted-foreground sm:inline">
        {ROLE_LABELS[user.role]}
        {user.region ? ` · ${user.region}` : ""}
      </span>
    </div>
  );
}
