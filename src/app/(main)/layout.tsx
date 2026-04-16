/**
 * App shell layout for authenticated routes.
 *
 * P3-01 implements:
 * - Server-side auth check (reads HttpOnly cookie, validates token against backend)
 * - Redirects to /login if unauthenticated
 * - Renders Unified Shell — Standard Archival variant (stitch-screen-audit.md §2.1)
 *   with sidebar nav, top bar, and <main> content slot
 *
 * Stitch reference: "Unified Shell — Standard Archival"
 * Stitch screen ID: to be mapped in P3-02
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar nav — implemented in P3-01 */}
      <nav className="w-64 border-r bg-card" aria-label="Primary navigation">
        <div className="p-4 text-sm text-muted-foreground">
          Nav — P3-01
        </div>
      </nav>

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {/* Top bar — implemented in P3-01 */}
        <header className="border-b bg-card p-4">
          <span className="text-sm text-muted-foreground">Top bar — P3-01</span>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
