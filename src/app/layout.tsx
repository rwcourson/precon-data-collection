import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { CSSProperties } from "react";
import "./globals.css";
import { ThemeBoot } from "@/components/theme-provider";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/product";

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
  title: PRODUCT_NAME,
  description: PRODUCT_DESCRIPTION,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F7FB" },
    { media: "(prefers-color-scheme: dark)", color: "#1c2433" },
  ],
};

export const dynamic = "force-dynamic";

/** Root shell only — auth pages stay chrome-free; app chrome lives in `(app)/layout`. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-chart-tokens="product"
      className={`${manrope.variable} ${spaceMono.variable} dark h-full antialiased`}
      style={
        {
          "--font-heading": "var(--font-sans)",
        } as CSSProperties
      }
    >
      <body className="min-h-full overflow-x-clip font-sans">
        <ThemeBoot />
        {children}
      </body>
    </html>
  );
}
