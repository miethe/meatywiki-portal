import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: "MeatyWiki Portal",
  description: "Knowledge compilation and research portal",
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
      </body>
    </html>
  );
}
