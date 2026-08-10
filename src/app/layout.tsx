import type { CSSProperties } from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { AppMain } from "@/components/app-main";
import { SidebarProvider } from "@/components/sidebar-context";
import { themeScript } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getWebPrincipal } from "@/lib/authorization/web-principal";
import { listPinnedSheets } from "@/lib/sheets-server";

const manrope = localFont({
  src: [
    { path: "./fonts/Manrope-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Manrope-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Manrope-SemiBold.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

const spaceMono = localFont({
  src: "./fonts/SpaceMono-Regular.ttf",
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "B&G Precon — Pursuits & Data",
  description: "Preconstruction bid & post-bid data collection",
};

export const dynamic = "force-dynamic";

/** Pinned sheets ride in the sidebar, so the shell needs them before render. */
async function pinnedSheets() {
  try {
    const principal = await getWebPrincipal();
    return await listPinnedSheets(principal);
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
      className={`${manrope.variable} ${spaceMono.variable} h-full antialiased`}
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
