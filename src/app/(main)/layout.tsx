/**
 * Authenticated shell layout — (main) route group.
 *
 * Responsibilities:
 * - Server-side auth check: reads HttpOnly cookie, redirects to /login if missing
 * - Renders the Unified Shell: sidebar nav + top bar + main content slot
 * - Mobile-first responsive: sidebar hidden on mobile (toggled via button)
 *
 * Stitch reference: "Unified Shell — Standard Archival"
 * Auth: P3-01 | Navigation wiring: P3-02
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ShellNav } from "./shell-nav";
import { ShellHeader } from "./shell-header";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Double-check auth here in addition to middleware (defence in depth)
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — hidden on mobile, shown md+ */}
      <aside
        className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex"
        aria-label="Sidebar navigation"
      >
        <ShellNav />
      </aside>

      {/* Main column: top bar + content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <ShellHeader />

        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-4 md:p-6"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
