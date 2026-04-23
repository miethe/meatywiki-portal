"use client";

/**
 * App Home — `/home` route.
 *
 * Surfaces:
 *   (a) Status strip above heading ("Systems online — {date}")
 *   (b) WelcomeHeader ("Welcome back, Archivist." — display-xl serif)
 *   (c) Recent Captures: 3–4 most recent inbox artifacts as ArtifactCard compact
 *   (d) ContextRail (right column): Latest Syntheses + Recent Workflows
 *
 * Responsive:
 *   - <768px (mobile): ContextRail hidden (standard xl visibility via ContextRail)
 *   - ≥768px tablet: toggle button shows ContextRail as overlay (tablet pattern)
 *   - ≥1280px desktop: ContextRail inline, always visible
 *
 * Key decisions:
 *   - `/inbox` remains the default landing per progress file Key Decisions.
 *     This route is bookmarkable at `/home`.
 *   - No new backend endpoints needed: reuses listArtifacts (inbox workspace)
 *     and useWorkflowRuns (same as workflows/page.tsx).
 *   - Graceful empty state on all API errors — no error throwing.
 *
 * Design spec §4.5 — App Home Stitch PNG reference.
 * Created for Portal v1.5 Stitch Reskin Phase 6 (P6-01).
 */

import { PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusStrip } from "@/components/home/status-strip";
import { WelcomeHeader } from "@/components/shell/welcome-header";
import { RecentCapturesSection } from "@/components/home/recent-captures-section";
import { HomeLatestSyntheses, HomeRecentWorkflows } from "@/components/home/home-context-rail-content";
import { ContextRail } from "@/components/ui/context-rail";
import type { RailSection } from "@/components/ui/context-rail";
import {
  ContextRailProvider,
  useContextRailToggle,
} from "@/components/ui/context-rail-context";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Rail sections — static structure, dynamic content from sub-components
// ---------------------------------------------------------------------------

const HOME_RAIL_SECTIONS: RailSection[] = [
  {
    id: "syntheses",
    title: "Latest Syntheses",
    variant: "properties",
    content: <HomeLatestSyntheses />,
  },
  {
    id: "workflows",
    title: "Recent Workflows",
    variant: "activity",
    content: <HomeRecentWorkflows />,
  },
];

// ---------------------------------------------------------------------------
// Tablet rail toggle button (same pattern as library/page.tsx)
// ---------------------------------------------------------------------------

function RailToggleButton() {
  const { toggle, isOpen } = useContextRailToggle();
  return (
    <button
      type="button"
      aria-label={isOpen ? "Hide context rail" : "Show context rail"}
      aria-pressed={isOpen}
      onClick={toggle}
      className={cn(
        // Visible on tablet (md to xl); hidden below md and at xl+ (always shown)
        "hidden md:inline-flex xl:hidden",
        "min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors sm:h-8 sm:min-h-0",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        isOpen
          ? "bg-accent text-accent-foreground border-accent"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <PanelRight aria-hidden="true" className="size-3.5" />
      <span className="hidden sm:inline">Context</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Tablet ContextRail overlay — fixed right-side panel, same as library/page.tsx
// ---------------------------------------------------------------------------

interface TabletRailOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function TabletRailOverlay({ isOpen, onClose, children }: TabletRailOverlayProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-20 bg-foreground/10 backdrop-blur-sm xl:hidden"
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-30 xl:hidden",
          "w-rail",
          "flex flex-col",
        )}
      >
        {children}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Inner page — requires ContextRailProvider in scope
// ---------------------------------------------------------------------------

function HomePageInner() {
  const { isOpen, close } = useContextRailToggle();

  const railElement = (
    <ContextRail
      title="Home"
      sections={HOME_RAIL_SECTIONS}
      collapsible
      width={320}
      className="sticky top-0 self-start max-h-[calc(100vh-7rem)] overflow-hidden"
    />
  );

  return (
    <div className="flex flex-col gap-6 min-h-0">
      {/* Tablet ContextRail overlay */}
      <TabletRailOverlay isOpen={isOpen} onClose={close}>
        {railElement}
      </TabletRailOverlay>

      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-3 shrink-0">
        <div className="flex flex-col gap-2">
          {/* Status strip above the heading */}
          <StatusStrip />
          {/* Display-xl serif greeting */}
          <WelcomeHeader />
        </div>

        {/* Rail toggle — tablet only */}
        <div className="flex items-center gap-2 self-end">
          <RailToggleButton />
        </div>
      </div>

      <Separator />

      {/* ------------------------------------------------------------------ */}
      {/* Two-column body: main content | ContextRail                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 min-h-0 gap-6 items-start">

        {/* Main content — full width on mobile, flex-1 alongside rail on desktop */}
        <main
          aria-label="App Home content"
          className="flex-1 min-w-0 flex flex-col gap-8"
        >
          {/* Recent Captures */}
          <RecentCapturesSection />
        </main>

        {/* Right ContextRail — inline at xl+, overlay on tablet via above */}
        {railElement}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export — wraps inner page with ContextRailProvider
// ---------------------------------------------------------------------------

export default function HomePage() {
  return (
    <ContextRailProvider defaultOpen={false}>
      <HomePageInner />
    </ContextRailProvider>
  );
}
