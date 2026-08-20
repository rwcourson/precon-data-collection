import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AppMain } from "@/components/app-main";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/sidebar-context";
import { authMode } from "@/lib/auth";
import { auth } from "@/lib/auth-server";
import {
  countPreBidStatusesForPrincipal,
  type PipelineBucketCounts,
} from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { roleMayAccessPath } from "@/lib/route-access";
import { listPinnedSheets } from "@/lib/sheets-server";
import { roundtableFeaturesFor } from "@/services/rollout-service";

export const dynamic = "force-dynamic";

const EMPTY_COUNTS: PipelineBucketCounts = {
  active: 0,
  upcoming: 0,
  outstanding: 0,
};

async function chromeData() {
  try {
    const principal = await getWebPrincipal();
    const [pinned, counts, features] = await Promise.all([
      listPinnedSheets(principal),
      countPreBidStatusesForPrincipal(principal),
      roundtableFeaturesFor(principal),
    ]);
    return {
      pinned,
      counts,
      role: principal.user.role,
      authorized: true,
      roleChrome: features.roleChrome,
    };
  } catch {
    return {
      pinned: [],
      counts: EMPTY_COUNTS,
      role: "pcm" as const,
      authorized: false,
      roleChrome: true,
    };
  }
}

/**
 * Authenticated app chrome. In SSO mode, require a Better Auth session
 * before rendering sidebar/header (proxy also redirects; this is defense in depth).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (authMode() === "sso") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      redirect("/sign-in");
    }
  }

  const { pinned, counts, role, authorized, roleChrome } = await chromeData();
  const pathname = (await headers()).get("x-pathname") ?? "/";
  if (authorized && !roleMayAccessPath(role, pathname, { roleChrome })) {
    redirect("/");
  }

  return (
    <SidebarProvider>
      <AppSidebar
        pinnedSheets={pinned}
        counts={counts}
        role={role}
        roleChrome={roleChrome}
      />
      <AppMain>
        <AppHeader />
        <main className="flex-1 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 md:px-10 md:py-9 md:pb-9 xl:px-14 xl:py-10">
          {children}
        </main>
      </AppMain>
    </SidebarProvider>
  );
}
