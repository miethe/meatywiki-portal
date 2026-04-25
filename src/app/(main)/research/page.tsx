"use client";

/**
 * Research Home — editorial layout with live panels.
 *
 * Layout structure:
 *   - Empty state banner (top, always-on until aggregate APIs ship)
 *   - Page heading + TopicScopeDropdown (wired — P4-11)
 *   - Two-column area:
 *       Left/main:
 *         - Priority Topics 2×2 grid (topic-scoped — P4-11)
 *         - New Evidence column (topic-scoped — P4-11)
 *         - ContradictionsPanel (P7-02 — LIVE, wired to backend)
 *         - Synthesis Narrative (skeleton pull-quote + 3-col breakdown)
 *         - Stale Artifacts panel (P7-01 — LIVE, wired to backend)
 *       Right ContextRail (xl+):
 *         - Workspace Health gauge (skeleton circle)
 *         - Recent Syntheses section (topic-scoped — P4-11)
 *         - Archive Intelligence section (skeleton)
 *
 * P6-03: Research Home editorial scaffold.
 * P6-04: Fixed rail breakpoint to xl (1280px) to match home/library pattern.
 * P7-01: Stale Artifacts panel wired to GET /api/artifacts/research/freshness-status.
 * P7-02: ContradictionsPanel wired to GET /api/artifacts/research/contradictions.
 *        Replaces ContradictionsCallout skeleton placeholder.
 * P4-11: WorkspaceSelector topic scoping wired. TopicScopeDropdown drives
 *        PriorityTopicsGrid, NewEvidenceColumn, and Recent Syntheses rail panel.
 *        Not scoped: WorkspaceHealth, SynthesisNarrative, CrossEntitySynthesis,
 *        FeaturedTopics (per spec — global signals, not topic-specific).
 *
 * OQ-2 resolution: APIs deferred (Topics, Synthesis, Workspace Health).
 *   Freshness (P7-01) and Contradictions (P7-02) endpoints are live.
 *
 * Stitch reference: "Research Home" (ID: 0cf6fb7b27d9459e8b5bebfea66915c5)
 * Design spec §4.3.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ContextRail } from "@/components/layout/ContextRail";
import { ResearchSynthesesPanel } from "@/components/layout/ContextRail";
import { ResearchWorkspaceEmpty } from "@/components/research/ResearchWorkspaceEmpty";
import { PriorityTopicsGrid } from "@/components/research/PriorityTopicsGrid";
import { NewEvidenceColumn } from "@/components/research/NewEvidenceColumn";
import { ContradictionsPanel } from "@/components/research/ContradictionsPanel";
import { SynthesisNarrative } from "@/components/research/SynthesisNarrative";
import { WorkspaceHealthGauge } from "@/components/research/WorkspaceHealthGauge";
import { StaleArtifactsPanel } from "@/components/research/StaleArtifactsPanel";
import { TopicScopeDropdown } from "@/components/research/TopicScopeDropdown";

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
// ContextRail skeleton section
// ---------------------------------------------------------------------------

/**
 * Skeleton card for "Archive Intelligence" rail section.
 *
 * TODO: wire Archive Intelligence signals endpoint to populate this card.
 *       Design reference: dark promo card from Stitch §4.3 ContextRail.
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
// Page component
// ---------------------------------------------------------------------------

export default function ResearchHomePage() {
  // -------------------------------------------------------------------------
  // Topic scope state — drives the 3 scoped endpoints:
  //   - GET /api/research/priority-topics
  //   - GET /api/research/evidence-pulse/new
  //   - GET /api/research/recent-syntheses (via ResearchSynthesesPanel)
  //
  // NOT scoped (global signals): WorkspaceHealth, SynthesisNarrative,
  //   CrossEntitySynthesis, FeaturedTopics.
  // -------------------------------------------------------------------------
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  // Build customTabs inside the component so the syntheses tab can close over
  // selectedTopicId and trigger a TanStack Query refetch when it changes.
  // The query key ["recent-syntheses", { limit: 10, topic_id: selectedTopicId }]
  // changes whenever selectedTopicId changes, so TanStack Query automatically
  // refetches without any manual invalidation.
  const researchRailTabs = useMemo(
    () => [
      {
        id: "health",
        label: "Health",
        renderContent: () => (
          <div className="flex flex-col gap-4 pt-2">
            {/* Not topic-scoped — workspace-wide health signal */}
            <WorkspaceHealthGauge />
          </div>
        ),
      },
      {
        id: "syntheses",
        label: "Syntheses",
        renderContent: () => (
          <div className="flex flex-col gap-3 pt-2">
            {/*
             * P4-11: topic-scoped via ResearchSynthesesPanel.
             * Passes topicId so the inner useRecentSyntheses call includes
             * topic_id in the query key, triggering automatic refetch.
             */}
            <ResearchSynthesesPanel topicId={selectedTopicId ?? undefined} />
          </div>
        ),
      },
      {
        id: "intelligence",
        label: "Intelligence",
        renderContent: () => (
          <div className="flex flex-col gap-3 pt-2">
            {/* TODO: wire Archive Intelligence signals endpoint */}
            <ArchiveIntelligenceSkeleton />
          </div>
        ),
      },
    ],
    [selectedTopicId],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------------------ */}
      {/* Empty state banner                                                  */}
      {/* Always-on until aggregate APIs ship and workspace has real content. */}
      {/* ------------------------------------------------------------------ */}
      <ResearchWorkspaceEmpty />

      {/* ------------------------------------------------------------------ */}
      {/* Page heading + topic scope dropdown                                 */}
      {/* P4-11: Replaces the disabled WorkspaceSelector skeleton.            */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Research</h1>
          <p className="text-sm text-muted-foreground">
            Workspace for compiled knowledge exploration
          </p>
        </div>

        {/*
         * P4-11: TopicScopeDropdown replaces the disabled WorkspaceSelector.
         * Changing the selection updates selectedTopicId, which flows into
         * PriorityTopicsGrid, NewEvidenceColumn, and ResearchSynthesesPanel.
         */}
        <TopicScopeDropdown
          selectedTopicId={selectedTopicId}
          onChange={setSelectedTopicId}
        />
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

          {/* Priority Topics 2×2 grid — P4-11: topic-scoped */}
          {/*
           * topicId is passed so usePriorityTopics includes topic_id in the
           * query key. Changing topic triggers an automatic cache-keyed refetch.
           */}
          <PriorityTopicsGrid topicId={selectedTopicId ?? undefined} />

          {/* Evidence + Contradictions row */}
          {/*
           * Two-column at md+: New Evidence (left) and Contradictions (right).
           * Collapses to single column below 768px.
           */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* New Evidence — P4-11: topic-scoped */}
            {/*
             * topicId flows into useEvidencePulseNew({ topic_id }).
             * Query key ["evidence-pulse-new", { topic_id }] changes with topic.
             */}
            <NewEvidenceColumn topicId={selectedTopicId ?? undefined} />

            {/* Contradictions panel — P7-02: LIVE (wired to backend)          */}
            {/* GET /api/artifacts/research/contradictions                      */}
            {/* Not topic-scoped per spec — global contradiction signal.        */}
            <ContradictionsPanel />
          </div>

          {/* Synthesis Narrative — not topic-scoped (global signal) */}
          {/*
           * TODO: wire GET /api/research/synthesis-narrative.
           * SynthesisNarrative renders italic skeleton pull-quote and 3-col grid.
           */}
          <SynthesisNarrative />

          {/* ------------------------------------------------------------ */}
          {/* Stale Artifacts panel — P7-01 (live, wired to backend)        */}
          {/* GET /api/artifacts/research/freshness-status                  */}
          {/* Freshness score bar (0–100), last synthesis date, source      */}
          {/* artifact count, configurable threshold, cursor pagination.    */}
          {/* Not topic-scoped per spec.                                    */}
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
            customTabs={researchRailTabs}
            ariaLabel="Research context"
          />
        </aside>
      </div>
    </div>
  );
}
