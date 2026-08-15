import type { CSSProperties } from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { themeScript } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

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

/** Root shell only — auth pages stay chrome-free; app chrome lives in `(app)/layout`. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-chart-tokens="product"
      className={`${manrope.variable} ${spaceMono.variable} h-full antialiased`}
      style={
        {
          "--font-heading": "var(--font-sans)",
        } as CSSProperties
      }
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
