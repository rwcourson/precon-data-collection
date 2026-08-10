import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { AppMain } from "@/components/app-main";
import { SidebarProvider } from "@/components/sidebar-context";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { listPinnedSheets } from "@/lib/sheets-server";
import { authMode } from "@/lib/auth";
import { auth } from "@/lib/auth-server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function pinnedSheets() {
  try {
    const principal = await getWebPrincipal();
    return await listPinnedSheets(principal);
  } catch {
    return [];
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

  const pinned = await pinnedSheets();

  return (
    <SidebarProvider>
      <AppSidebar pinnedSheets={pinned} />
      <AppMain>
        <AppHeader />
        <main className="flex-1 px-6 py-6 md:px-10 md:py-9 xl:px-14 xl:py-10">
          {children}
        </main>
      </AppMain>
    </SidebarProvider>
  );
}
