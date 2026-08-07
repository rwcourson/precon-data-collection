import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { AppMain } from "@/components/app-main";
import { SidebarProvider } from "@/components/sidebar-context";
import { themeScript } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser } from "@/lib/current-user";
import { listPinnedSheets } from "@/lib/sheets-server";
import { getWorkspace } from "@/lib/workspace-server";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "B&G Precon — Pursuits & Data",
  description: "Preconstruction bid & post-bid data collection",
};

export const dynamic = "force-dynamic";

/** Pinned sheets ride in the sidebar, so the shell needs them before render. */
async function pinnedSheets() {
  try {
    const [user, workspace] = await Promise.all([getCurrentUser(), getWorkspace()]);
    return await listPinnedSheets(workspace, user.id);
  } catch {
    return [];
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const pinned = await pinnedSheets();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${plexMono.variable} h-full antialiased`}
      style={
        {
          "--font-heading": "var(--font-sans)",
        } as CSSProperties
      }
    >
      <head>
        {/* Applies the stored theme before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">
        <SidebarProvider>
          <AppSidebar pinnedSheets={pinned} />
          <AppMain>
            <AppHeader />
            <main className="flex-1 px-6 py-6 md:px-10 md:py-9 xl:px-14 xl:py-10">
              {children}
            </main>
          </AppMain>
        </SidebarProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
