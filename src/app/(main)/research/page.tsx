"use client";

/**
 * Research Home — editorial layout with live panels.
 * Includes "Active Research Runs" widget (portal-v2.1 P4-04).
 *
 * Layout structure:
 *   - Empty state banner (top, always-on until aggregate APIs ship)
 *   - Page heading + workspace selector dropdown (skeleton)
 *   - Two-column area:
 *       Left/main:
 *         - Priority Topics 2×2 grid (skeletons + Add New Entity slot)
 *         - New Evidence column (skeleton rows with timestamps)
 *         - ContradictionsPanel (P7-02 — LIVE, wired to backend)
 *         - Synthesis Narrative (skeleton pull-quote + 3-col breakdown)
 *         - Stale Artifacts panel (P7-01 — LIVE, wired to backend)
 *         - Active Research Runs (P5-01/P5-02/P5-03 — LIVE, polling + draft support)
 *         - ── P5-05 new sections ──
 *         - Completed Research Runs (P5-05 — LIVE, wired to GET /api/research/runs)
 *         - Research Workspaces (P5-05 — LIVE, workspace picker + artifacts)
 *         - Saved Packages (P5-05 — LIVE, wired to GET /api/research/packages)
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
 * P5-03: Draft re-entry — clicking a draft run in ActiveResearchRuns opens the
 *        research wizard at Step 3 pre-populated with saved draft data.
 *        Fetch: GET /api/workflows/{run_id} → WorkflowRunDetail.metadata
 * P5-05: Research Home consolidation — CompletedResearchRuns, ResearchWorkspaces,
 *        SavedPackages sections added below ActiveResearchRuns.
 *
 * OQ-2 resolution: APIs deferred (Topics, Synthesis, Workspace Health).
 *   Freshness (P7-01) and Contradictions (P7-02) endpoints are live.
 *
 * Stitch reference: "Research Home" (ID: 0cf6fb7b27d9459e8b5bebfea66915c5)
 * Design spec §4.3.
 */

import { useCallback, useState } from "react";
import { ChevronDown, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContextRail } from "@/components/layout/ContextRail";
import { ResearchWorkspaceEmpty } from "@/components/research/ResearchWorkspaceEmpty";
import { PriorityTopicsGrid } from "@/components/research/PriorityTopicsGrid";
import { NewEvidenceColumn } from "@/components/research/NewEvidenceColumn";
import { ContradictionsPanel } from "@/components/research/ContradictionsPanel";
import { SynthesisNarrative } from "@/components/research/SynthesisNarrative";
import { WorkspaceHealthGauge } from "@/components/research/WorkspaceHealthGauge";
import { StaleArtifactsPanel } from "@/components/research/StaleArtifactsPanel";
import { ActiveResearchRuns } from "@/components/research/ActiveResearchRuns";
import { CompletedResearchRuns } from "@/components/research/CompletedResearchRuns";
import { ResearchWorkspaces } from "@/components/research/ResearchWorkspaces";
import { SavedPackages } from "@/components/research/SavedPackages";
import InfoTooltip from "@/components/ui/info-tooltip";
import { TOOLTIP_COPY } from "@/lib/copy/tooltips";
import { FirstRunOffer } from "@/components/tour/FirstRunOffer";
import { InitiationWizardDialog } from "@/components/workflow/initiation-wizard";
import { getWorkflowRunDetail } from "@/lib/api/research";
import type { ResearchRun } from "@/types/research-runs";
import type { ExternalResearchPackageFields } from "@/hooks/useWorkflowWizardState";
import type { RouteCard, RoutePreference } from "@/types/workflows/research";

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
// WorkspaceSelector — skeleton dropdown (not yet wired)
// ---------------------------------------------------------------------------

/**
 * Skeleton workspace selector dropdown.
 * Displays "All Entities" label. Not interactive until topic scope API ships.
 *
 * TODO: wire GET /api/topics to populate dropdown options.
 *       Replace with a real <Select> component bound to topic scope state.
 */
function WorkspaceSelector() {
  return (
    <button
      type="button"
      disabled
      aria-label="Workspace selector — All Entities (planned)"
      aria-disabled="true"
      aria-haspopup="listbox"
      title="Topic scope selector — coming soon"
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
 * TODO: wire GET /api/research/recent-syntheses to populate real rows.
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
// ContextRail custom tabs for Research Home
// ---------------------------------------------------------------------------

const RESEARCH_HOME_RAIL_TABS = [
  {
    id: "health",
    label: "Health",
    renderContent: () => (
      <div className="flex flex-col gap-4 pt-2">
        {/* TODO: wire GET /api/research/workspace-health */}
        <WorkspaceHealthGauge />
      </div>
    ),
  },
  {
    id: "syntheses",
    label: "Syntheses",
    renderContent: () => (
      <div className="flex flex-col gap-3 pt-2">
        {/* TODO: wire GET /api/research/recent-syntheses */}
        <RecentSynthesesSkeleton />
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
];

// ---------------------------------------------------------------------------
// Draft re-entry state helpers
// ---------------------------------------------------------------------------

/**
 * Converts raw WorkflowRunDetail metadata into ExternalResearchPackageFields.
 *
 * The backend stores ExternalResearchParams fields in workflow_runs.metadata
 * at create-run time. We map the known fields and fall back to defaults for
 * any missing optional fields.
 */
function metadataToPackageFields(
  meta: Record<string, unknown>,
): ExternalResearchPackageFields {
  return {
    topic: typeof meta["topic"] === "string" ? meta["topic"] : "",
    research_question:
      typeof meta["research_question"] === "string"
        ? meta["research_question"]
        : "",
    project: Array.isArray(meta["project"])
      ? (meta["project"] as string[])
      : [],
    domain: Array.isArray(meta["domain"]) ? (meta["domain"] as string[]) : [],
    selected_artifact_ids: Array.isArray(meta["selected_artifact_ids"])
      ? (meta["selected_artifact_ids"] as string[])
      : [],
    route_preference:
      typeof meta["route_preference"] === "string"
        ? (meta["route_preference"] as RoutePreference)
        : "auto",
    desired_output:
      typeof meta["desired_output"] === "string"
        ? (meta["desired_output"] as ExternalResearchPackageFields["desired_output"])
        : "briefing",
    freshness_window:
      typeof meta["freshness_window"] === "string"
        ? meta["freshness_window"]
        : "current",
    citation_strictness:
      typeof meta["citation_strictness"] === "string"
        ? (meta["citation_strictness"] as ExternalResearchPackageFields["citation_strictness"])
        : "advisory",
    save_prompt_package:
      typeof meta["save_prompt_package"] === "boolean"
        ? meta["save_prompt_package"]
        : true,
    sensitivity_profile:
      typeof meta["sensitivity_profile"] === "string"
        ? (meta["sensitivity_profile"] as ExternalResearchPackageFields["sensitivity_profile"])
        : "internal",
    task_type: typeof meta["task_type"] === "string" ? meta["task_type"] : "",
    audience: typeof meta["audience"] === "string" ? meta["audience"] : "",
    time_profile:
      typeof meta["time_profile"] === "string"
        ? (meta["time_profile"] as ExternalResearchPackageFields["time_profile"])
        : "standard",
    cost_sensitivity:
      typeof meta["cost_sensitivity"] === "string"
        ? (meta["cost_sensitivity"] as ExternalResearchPackageFields["cost_sensitivity"])
        : "medium",
    reuse_likelihood:
      typeof meta["reuse_likelihood"] === "string"
        ? (meta["reuse_likelihood"] as ExternalResearchPackageFields["reuse_likelihood"])
        : "medium",
    background:
      typeof meta["background"] === "string" ? meta["background"] : "",
  };
}

/**
 * Builds a minimal single-card RouteCard array from saved metadata.
 *
 * When re-entering a draft, the original route_cards from the analysis are
 * not persisted in metadata. We synthesise a minimal card from the saved
 * route_preference so PromptPackagePreview can render the venue section.
 * The card has a score of 1.0 and a "fast_path" routing_category by default
 * since the full analysis is not available.
 */
function buildMinimalRouteCards(
  meta: Record<string, unknown>,
): RouteCard[] {
  const route =
    typeof meta["route_preference"] === "string"
      ? (meta["route_preference"] as RoutePreference)
      : "auto";

  return [
    {
      route,
      score: 1.0,
      rationale: "Saved route preference from draft run.",
      prompt_preview: "",
      expected_output: "",
      routing_category: "fast_path",
      display_name: route,
    },
  ];
}

// ---------------------------------------------------------------------------
// Section divider + heading (P5-05 consolidation sections)
// ---------------------------------------------------------------------------

/**
 * Section heading with a top divider.
 * Used to visually separate the three new Research Home sections from the
 * existing research widgets above them.
 */
function SectionHeading({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden="true" className="h-px bg-border" />
      <h2
        id={id}
        className="text-base font-semibold text-foreground"
      >
        {children}
      </h2>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ResearchHomePage() {
  // --------------------------------------------------------------------------
  // Draft re-entry state (P5-03)
  // --------------------------------------------------------------------------

  /**
   * When non-null, the wizard dialog opens in draft re-entry mode.
   * Cleared when the dialog is closed.
   */
  const [draftWizardOpen, setDraftWizardOpen] = useState(false);
  const [draftInitialState, setDraftInitialState] = useState<{
    fields: ExternalResearchPackageFields;
    draft_run_id: string;
    route_cards: RouteCard[];
    selected_venue: RoutePreference;
  } | null>(null);

  const handleDraftReEntry = useCallback(async (run: ResearchRun) => {
    // Fetch full run detail to get metadata
    try {
      const envelope = await getWorkflowRunDetail(run.run_id);
      const detail = envelope.data;
      const meta = detail.metadata ?? {};
      const fields = metadataToPackageFields(meta as Record<string, unknown>);
      const routeCards = buildMinimalRouteCards(meta as Record<string, unknown>);
      const selectedVenue = fields.route_preference;

      setDraftInitialState({
        fields,
        draft_run_id: run.run_id,
        route_cards: routeCards,
        selected_venue: selectedVenue,
      });
      setDraftWizardOpen(true);
    } catch {
      // If fetch fails, fall back to pre-populating from the run summary data
      const fields = metadataToPackageFields({
        topic: run.topic ?? "",
        research_question: run.research_question ?? "",
      });
      const routeCards = buildMinimalRouteCards({});
      setDraftInitialState({
        fields,
        draft_run_id: run.run_id,
        route_cards: routeCards,
        selected_venue: "auto",
      });
      setDraftWizardOpen(true);
    }
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------------------ */}
      {/* Empty state banner                                                  */}
      {/* Always-on until aggregate APIs ship and workspace has real content. */}
      {/* ------------------------------------------------------------------ */}
      <ResearchWorkspaceEmpty />

      {/* P3-06: First-run tour offer banner */}
      <FirstRunOffer tourId="researchWizard" tourLabel="Research" />

      {/* ------------------------------------------------------------------ */}
      {/* Page heading + workspace selector + Start Research CTA             */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Research</h1>
            <InfoTooltip
              content={TOOLTIP_COPY.research.researchWizard}
              side="right"
              label="About the Research workspace"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Workspace for compiled knowledge exploration
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/*
           * TODO: wire GET /api/topics to populate dropdown options.
           * Replace WorkspaceSelector with a real Select bound to topic scope.
           */}
          <WorkspaceSelector />

          {/*
           * P1-01: "Start Research" CTA — opens research wizard pre-configured
           * with external_research_v1 template. data-tour attribute is the
           * anchor for the researchWizard tour step 1.
           */}
          <InitiationWizardDialog
            template_id="external_research_v1"
            trigger={
              <button
                type="button"
                data-tour="research-start"
                aria-label="Start a new research run"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5",
                  "bg-foreground text-background text-sm font-semibold",
                  "transition-colors hover:bg-foreground/90",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                )}
              >
                <FlaskConical aria-hidden="true" className="size-3.5" />
                Start Research
              </button>
            }
          />
        </div>
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
          {/* data-tour: research-scope-selection on the grid area */}
          {/*
           * TODO: wire GET /api/research/priority-topics.
           * PriorityTopicsGrid renders skeletons + disabled Add New Entity slot.
           */}
          <div data-tour="research-scope-selection">
          <PriorityTopicsGrid />
          </div>

          {/* Evidence + Contradictions row */}
          {/*
           * Two-column at md+: New Evidence (left) and Contradictions (right).
           * Collapses to single column below 768px.
           */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* New Evidence — skeleton rows */}
            {/*
             * TODO: wire GET /api/research/evidence-pulse/new.
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
           * TODO: wire GET /api/research/synthesis-narrative.
           * SynthesisNarrative renders italic skeleton pull-quote and 3-col grid.
           */}
          <SynthesisNarrative />

          {/* ------------------------------------------------------------ */}
          {/* Stale Artifacts panel — P7-01 (live, wired to backend)        */}
          {/* GET /api/artifacts/research/freshness-status                  */}
          {/* Freshness score bar (0–100), last synthesis date, source      */}
          {/* artifact count, configurable threshold, cursor pagination.    */}
          {/* ------------------------------------------------------------ */}
          <div data-tour="research-results">
          <StaleArtifactsPanel />
          </div>

          {/* ------------------------------------------------------------ */}
          {/* Active Research Runs widget — P5-01/P5-02/P5-03/P5-04      */}
          {/* Polls GET /api/workflows/runs?template_id=external_research_v1 */}
          {/* every 5 s with exponential backoff on error (cap 30 s).      */}
          {/* Draft runs shown with amber badge; click to re-enter wizard. */}
          {/* SSE migration deferred (OQ-5).                               */}
          {/* ------------------------------------------------------------ */}
          <div data-tour="research-active-runs">
            <ActiveResearchRuns
              onDraftReEntry={(run) => { void handleDraftReEntry(run); }}
            />
          </div>

          {/* ============================================================ */}
          {/* P5-05 Research Home consolidation sections                    */}
          {/* Three new sections stacked below ActiveResearchRuns.          */}
          {/* Each section is independently loaded and paginated.          */}
          {/* ============================================================ */}

          {/* ------------------------------------------------------------ */}
          {/* Completed Research Runs — P5-05                              */}
          {/* GET /api/research/runs?status=completed                      */}
          {/* Cards: date range, template, summary, artifacts count.       */}
          {/* Click → /workflows/[runId]                                   */}
          {/* ------------------------------------------------------------ */}
          <div>
            <SectionHeading id="completed-runs-heading">
              Completed Research Runs
            </SectionHeading>
            <div className="mt-3">
              <CompletedResearchRuns />
            </div>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* Research Workspaces — P5-05                                  */}
          {/* Workspace chip picker → GET /api/research/artifacts          */}
          {/* Lists research-origin artifacts for the selected workspace.  */}
          {/* Click artifact → /artifacts/[id]                             */}
          {/* ------------------------------------------------------------ */}
          <div>
            <SectionHeading id="research-workspaces-heading">
              Research Workspaces
            </SectionHeading>
            <div className="mt-3">
              <ResearchWorkspaces />
            </div>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* Saved Packages — P5-05                                       */}
          {/* GET /api/research/packages                                   */}
          {/* Cards: package name, artifact count, created date.           */}
          {/* Click → /artifacts/[id]                                      */}
          {/* ------------------------------------------------------------ */}
          <div>
            <SectionHeading id="saved-packages-heading">
              Saved Packages
            </SectionHeading>
            <div className="mt-3">
              <SavedPackages />
            </div>
          </div>

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

      {/* ------------------------------------------------------------------ */}
      {/* Draft re-entry wizard dialog (P5-03)                               */}
      {/* Controlled — opened when user clicks a draft run card.             */}
      {/* ------------------------------------------------------------------ */}
      {draftInitialState !== null && (
        <InitiationWizardDialog
          controlled
          open={draftWizardOpen}
          onOpenChange={(open) => {
            setDraftWizardOpen(open);
            if (!open) setDraftInitialState(null);
          }}
          template_id="external_research_v1"
          initialDraft={draftInitialState}
        />
      )}
    </div>
  );
}
