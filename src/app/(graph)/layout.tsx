/**
 * Graph route group layout — (graph)
 *
 * Chrome-free layout for the /graph route. Unlike (main)/layout.tsx, this
 * layout renders NO header, sidebar, or breadcrumbs — the graph page is an
 * immersive full-viewport canvas experience.
 *
 * Responsibilities:
 *   1. Auth check — redirect unauthenticated users to /login (same defence-
 *      in-depth as (main)/layout.tsx; middleware is the primary gate but this
 *      is a belt-and-suspenders server-side check).
 *   2. Set data-page="graph" on the outermost wrapper div so the CSS custom
 *      properties in graph.css are scoped correctly to this route only.
 *   3. Import graph.css so the --mw-graph-* variables and .graph-immersive-canvas
 *      class are available to the graph page and its child components.
 *
 * Providers NOT duplicated here (already established by root layout.tsx):
 *   - QueryProvider (TanStack Query)
 *   - ToastProvider + ToastRenderer
 *   - PwaProviders (service worker registration)
 *
 * Providers established HERE (because this route bypasses (main)/shell-client.tsx,
 * which is where the portal shell normally mounts them):
 *   - TooltipProvider — required by any Radix Tooltip / InfoTooltip rendered in
 *     the graph page and its child overlays (GraphFilters, GraphGroupingSelector,
 *     etc.). Without a route-level provider these throw
 *     "`Tooltip` must be used within `TooltipProvider`" on load.
 *
 * CANVAS-001 — graph route layout teardown (v2.5 Phase 2).
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./graph.css";

export default async function GraphLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div data-page="graph" className="graph-layout-root">
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
    </div>
  );
}
