import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { OfflineQueueSync } from "@/components/pwa/offline-queue-sync";

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
         * ServiceWorkerRegister — side-effect only; renders null.
         * Only registers /sw.js when NEXT_PUBLIC_PORTAL_ENABLE_PWA=1.
         * Placed outside QueryProvider intentionally: SW registration is
         * independent of data-fetching concerns.
         * Traces FR-1.5-15 (P4-01).
         */}
        <ServiceWorkerRegister />
        {/*
         * OfflineQueueSync — side-effect only; renders null.
         * Listens for window 'online' events and drains the offline intake
         * queue on reconnect. Uses Background Sync API when available;
         * falls back to direct OfflineQueueManager.drain().
         * Only active when NEXT_PUBLIC_PORTAL_ENABLE_PWA=1.
         * Traces FR-1.5-17, FR-1.5-18 (P4-02).
         */}
        <OfflineQueueSync />
      </body>
    </html>
  );
}
