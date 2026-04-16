import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeatyWiki Portal",
  description: "Knowledge compilation and research portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
