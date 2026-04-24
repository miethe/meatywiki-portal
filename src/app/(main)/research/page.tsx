"use client";

/**
 * Research Home — editorial layout with live panels.
 *
 * Layout structure:
 *   - Empty state banner (top, always-on until v1.6 APIs ship broadly)
 *   - Page heading + workspace selector dropdown (skeleton)
 *   - Two-column area:
 *       Left/main:
 *         - Priority Topics 2×2 grid (skeletons + Add New Entity slot)
 *         - New Evidence column (skeleton rows with timestamps)
 *         - ContradictionsPanel (P7-02 — LIVE, wired to backend)
 *         - Synthesis Narrative (skeleton pull-quote + 3-col breakdown)
 *         - Stale Artifacts panel (P7-01 — LIVE, wired to backend)
 *       Right ContextRail (xl+):
 *         - Workspace Health gauge (skeleton circle)
 *         - Recent Syntheses section (skeleton rows)
 *         - Archive Intelligence section (skeleton)
 *
 * P6-03: Research Home editorial scaffold.
 * P6-04: Fixed rail breakpoint to xl (1280px) to match home/library pattern.
 * P7-01: Stale Artifacts panel wired to GET /api/artifacts/research/freshness-status.
 * P7-02: ContradictionsPanel wired to GET /api/artifacts/research/contradictions.
 *        Replaces ContradictionsCallout skeleton placeholder.
 *
 * OQ-2 resolution: APIs deferred to v1.6 (Topics, Synthesis, Workspace Health)
 *   — Freshness (P7-01) and Contradictions (P7-02) endpoints ship in v1.6.
 *
 * Stitch reference: "Research Home" (ID: 0cf6fb7b27d9459e8b5bebfea66915c5)
 * Design spec §4.3.
 */

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContextRail } from "@/components/layout/ContextRail";
import { ResearchWorkspaceEmpty } from "@/components/research/ResearchWorkspaceEmpty";
import { PriorityTopicsGrid } from "@/components/research/PriorityTopicsGrid";
import { NewEvidenceColumn } from "@/components/research/NewEvidenceColumn";
import { ContradictionsPanel } from "@/components/research/ContradictionsPanel";
import { SynthesisNarrative } from "@/components/research/SynthesisNarrative";
import { WorkspaceHealthGauge } from "@/components/research/WorkspaceHealthGauge";
import { StaleArtifactsPanel } from "@/components/research/StaleArtifactsPanel";

// ---------------------------------------------------------------------------
// Shimmer primitive (inlined for ContextRail skeleton sections)
// ---------------------------------------------------------------------------

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-muted", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// WorkspaceSelector — skeleton dropdown (no functionality in v1.5)
// ---------------------------------------------------------------------------

/**
 * Skeleton workspace selector dropdown.
 * Displays "All Entities" label. Not interactive until v1.6.
 *
 * TODO v1.6: wire GET /api/topics to populate dropdown options.
 *            Replace with a real <Select> component bound to topic scope state.
 */
function WorkspaceSelector() {
  return (
    <button
      type="button"
      disabled
      aria-label="Workspace selector — All Entities (available in v1.6)"
      aria-disabled="true"
      aria-haspopup="listbox"
      title="Topic scope selector — coming in v1.6"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3",
        "text-xs font-medium text-muted-foreground",
        "cursor-default opacity-70",
        "focus:outline-none",
      )}
    >
      All Entities
      <ChevronDown aria-hidden="true" className="size-3.5" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// ContextRail skeleton sections
// ---------------------------------------------------------------------------

/**
 * Skeleton rows for "Recent Syntheses" rail section.
 *
 * TODO v1.6: wire GET /api/research/recent-syntheses to populate real rows.
 */
function RecentSynthesesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Recent syntheses loading" className="flex flex-col gap-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} aria-hidden="true" className="flex flex-col gap-1">
          <Shimmer className="h-3.5 w-4/5" />
          <Shimmer className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton card for "Archive Intelligence" rail section.
 *
 * TODO v1.6: wire Archive Intelligence signals endpoint to populate this card.
 *            Design reference: dark promo card from Stitch §4.3 ContextRail.
 */
function ArchiveIntelligenceSkeleton() {
  return (
    <div
      aria-hidden="true"
      aria-busy="true"
      aria-label="Archive intelligence loading"
      className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3"
    >
      <Shimmer className="h-4 w-2/3" />
      <Shimmer className="h-3 w-full" />
      <Shimmer className="h-3 w-4/5" />
      <Shimmer className="mt-1 h-6 w-24 rounded-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContextRail custom tabs for Research Home
// ---------------------------------------------------------------------------

const RESEARCH_HOME_RAIL_TABS = [
  {
    id: "health",
    label: "Health",
    renderContent: () => (
      <div className="flex flex-col gap-4 pt-2">
        {/* TODO v1.6: wire GET /api/research/workspace-health */}
        <WorkspaceHealthGauge />
      </div>
    ),
  },
  {
    id: "syntheses",
    label: "Syntheses",
    renderContent: () => (
      <div className="flex flex-col gap-3 pt-2">
        {/* TODO v1.6: wire GET /api/research/recent-syntheses */}
        <RecentSynthesesSkeleton />
      </div>
    ),
  },
  {
    id: "intelligence",
    label: "Intelligence",
    renderContent: () => (
      <div className="flex flex-col gap-3 pt-2">
        {/* TODO v1.6: wire Archive Intelligence signals endpoint */}
        <ArchiveIntelligenceSkeleton />
      </div>
    ),
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ResearchHomePage() {
  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------------------ */}
      {/* Empty state banner                                                  */}
      {/* Always-on until v1.6 APIs ship and workspace has real content.      */}
      {/* ------------------------------------------------------------------ */}
      <ResearchWorkspaceEmpty />

      {/* ------------------------------------------------------------------ */}
      {/* Page heading + workspace selector                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Research</h1>
          <p className="text-sm text-muted-foreground">
            Workspace for compiled knowledge exploration
          </p>
        </div>

        {/*
         * TODO v1.6: wire GET /api/topics to populate dropdown options.
         * Replace WorkspaceSelector with a real Select bound to topic scope.
         */}
        <WorkspaceSelector />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Two-column layout: main content + ContextRail                       */}
      {/* Rail hidden below xl (1280px). Matches home/library page pattern.   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex gap-6">
        {/* ---------------------------------------------------------------- */}
        {/* Main column                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">

          {/* Priority Topics 2×2 grid */}
          {/*
           * TODO v1.6: wire GET /api/research/priority-topics.
           * PriorityTopicsGrid renders skeletons + disabled Add New Entity slot.
           */}
          <PriorityTopicsGrid />

          {/* Evidence + Contradictions row */}
          {/*
           * Two-column at md+: New Evidence (left) and Contradictions (right).
           * Collapses to single column below 768px.
           */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* New Evidence — skeleton rows */}
            {/*
             * TODO v1.6: wire GET /api/research/evidence-pulse/new.
             * NewEvidenceColumn renders skeleton items with timestamp shimmers.
             */}
            <NewEvidenceColumn />

            {/* Contradictions panel — P7-02: LIVE (wired to backend)          */}
            {/* GET /api/artifacts/research/contradictions                      */}
            {/* Replaces ContradictionsCallout skeleton placeholder (P6-03).   */}
            <ContradictionsPanel />
          </div>

          {/* Synthesis Narrative — skeleton pull-quote + 3-col breakdown */}
          {/*
           * TODO v1.6: wire GET /api/research/synthesis-narrative.
           * SynthesisNarrative renders italic skeleton pull-quote and 3-col grid.
           */}
          <SynthesisNarrative />

          {/* ------------------------------------------------------------ */}
          {/* Stale Artifacts panel — P7-01 (live, wired to backend)        */}
          {/* GET /api/artifacts/research/freshness-status                  */}
          {/* Freshness score bar (0–100), last synthesis date, source      */}
          {/* artifact count, configurable threshold, cursor pagination.    */}
          {/* ------------------------------------------------------------ */}
          <StaleArtifactsPanel />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* ContextRail — research home variant                              */}
        {/* Workspace Health gauge + Recent Syntheses + Archive Intelligence. */}
        {/* Tabs use custom tab set (no artifact context needed here).        */}
        {/* hidden xl:block matches home/library xl breakpoint pattern.       */}
        {/* ---------------------------------------------------------------- */}
        <aside
          aria-label="Research context rail"
          className="hidden w-72 shrink-0 xl:block"
        >
          <ContextRail
            customTabs={RESEARCH_HOME_RAIL_TABS}
            ariaLabel="Research context"
          />
        </aside>
      </div>
    </div>
  );
}
