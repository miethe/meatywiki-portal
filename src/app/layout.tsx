import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { PwaProviders } from "@/components/pwa/pwa-providers";

export const metadata: Metadata = {
  title: "MeatyWiki Portal",
  description: "Knowledge compilation and research portal",
  /**
   * PWA manifest link — Next.js appends <link rel="manifest"> to <head>.
   * Traces FR-1.5-15 (P4-01).
   */
  manifest: "/manifest.json",
  /**
   * theme-color: matches manifest.json + portal dark background token
   * (--background dark: hsl(222.2 84% 4.9%) ≈ #0f172a).
   * Colours the browser chrome on Android Chrome and iOS Safari 15.4+.
   */
  themeColor: "#0f172a",
  /**
   * Apple-specific PWA meta — enables "Add to Home Screen" on iOS Safari.
   * iOS <16.4 does not support the Web App Manifest for installation;
   * apple-mobile-web-app-capable is the pre-16.4 fallback.
   */
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MeatyWiki",
  },
};

/**
 * Viewport meta — ensures correct scaling on mobile devices.
 * Required by Lighthouse mobile audit (P3-10).
 * width=device-width + initial-scale=1 prevents text inflation on iOS.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryProvider>{children}</QueryProvider>
        {/*
         * PwaProviders — client-side wrapper that lazy-loads ServiceWorkerRegister
         * and OfflineQueueSync via dynamic() with ssr:false (P4-04 perf tuning).
         * Both inner components render null — they are pure side-effect shells.
         * The dynamic() + ssr:false wrapper must live in a Client Component;
         * it is not permitted directly in this Server Component layout.
         * Traces FR-1.5-15, FR-1.5-17, FR-1.5-18.
         */}
        <PwaProviders />
      </body>
    </html>
  );
}
