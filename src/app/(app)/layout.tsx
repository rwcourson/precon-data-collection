import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { AppMain } from "@/components/app-main";
import { SidebarProvider } from "@/components/sidebar-context";
import {
  countPreBidStatusesForPrincipal,
  type PipelineBucketCounts,
} from "@/lib/authorization/loaders";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { listPinnedSheets } from "@/lib/sheets-server";
import { authMode } from "@/lib/auth";
import { auth } from "@/lib/auth-server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const EMPTY_COUNTS: PipelineBucketCounts = { active: 0, upcoming: 0, outstanding: 0 };

async function chromeData() {
  try {
    const principal = await getWebPrincipal();
    const [pinned, counts] = await Promise.all([
      listPinnedSheets(principal),
      countPreBidStatusesForPrincipal(principal),
    ]);
    return { pinned, counts };
  } catch {
    return { pinned: [], counts: EMPTY_COUNTS };
  }
}

/**
 * Authenticated app chrome. In SSO mode, require a Better Auth session
 * before rendering sidebar/header (proxy also redirects; this is defense in depth).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (authMode() === "sso") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      redirect("/sign-in");
    }
  }

  const { pinned, counts } = await chromeData();

  return (
    <SidebarProvider>
      <AppSidebar pinnedSheets={pinned} counts={counts} />
      <AppMain>
        <AppHeader />
        <main className="flex-1 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 md:px-10 md:py-9 md:pb-9 xl:px-14 xl:py-10">
          {children}
        </main>
      </AppMain>
    </SidebarProvider>
  );
}
