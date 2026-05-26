"use client";

/**
 * ResearchRouteSelection — Step 2 of the 3-step external-research wizard.
 *
 * Layout (top to bottom):
 *   1. Intent Core panel — read-only display of research_question, target_fidelity,
 *      estimated_depth extracted by the routing analyser.
 *   2. Extracted Entities — tag chips row; "(none detected)" when empty.
 *   3. Archival Archetypes — labeled badge list; "(none detected)" when empty.
 *   4. Sensitivity Constraints — single derived string from sensitivity_profile.
 *   5. Routing Recommendation Matrix — 3-column grid grouped by routing_category:
 *        "Fast Path" | "Precise Vector" | "Swarm Synthesis"
 *      Each column shows its RouteCards; empty columns show a placeholder.
 *      Selecting a card highlights it and enables the "INITIATE ROUTING" CTA.
 *   6. Tentative Execution Plan — stage-level time estimates derived from the
 *      selected routing_category using heuristic defaults. Updates on card change.
 *   7. Navigation footer — Back + "INITIATE ROUTING" (disabled until card chosen).
 *
 * State: reads from useWizardStateContext(). Dispatches:
 *   SELECT_VENUE — when a route card is clicked.
 *   ADVANCE_TO_CONFIRM — when "INITIATE ROUTING" is clicked (moves to Step 3).
 *   GO_BACK — when "Back" is clicked.
 *
 * P4-01/02/03 — portal-v2.4 Phase 4.
 */

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWizardStateContext } from "@/hooks/useWorkflowWizardState";
import { RoutingMatrixCard } from "./VenueCard";
import { ArrowLeft, AlertCircle, Zap, Target, Layers3, Clock } from "lucide-react";
import type {
  RoutingCategory,
  RouteCard,
  IntentCore,
  SensitivityProfile,
} from "@/types/workflows/research";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<
  RoutingCategory,
  {
    label: string;
    icon: React.ReactNode;
    timeRange: string;
    stages: Array<{ name: string; minutes: [number, number] }>;
    columnClass: string;
    headerClass: string;
  }
> = {
  fast_path: {
    label: "Fast Path",
    icon: <Zap aria-hidden className="size-3.5" />,
    timeRange: "2–5 min total",
    stages: [
      { name: "Research", minutes: [1, 2] },
      { name: "Synthesis", minutes: [1, 2] },
      { name: "Review", minutes: [0, 1] },
    ],
    columnClass: "border-amber-200 dark:border-amber-800/60",
    headerClass:
      "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  precise_vector: {
    label: "Precise Vector",
    icon: <Target aria-hidden className="size-3.5" />,
    timeRange: "5–15 min total",
    stages: [
      { name: "Research", minutes: [3, 6] },
      { name: "Synthesis", minutes: [2, 5] },
      { name: "Review", minutes: [0, 4] },
    ],
    columnClass: "border-blue-200 dark:border-blue-800/60",
    headerClass:
      "bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  swarm_synthesis: {
    label: "Swarm Synthesis",
    icon: <Layers3 aria-hidden className="size-3.5" />,
    timeRange: "15–30 min total",
    stages: [
      { name: "Research", minutes: [8, 15] },
      { name: "Synthesis", minutes: [5, 10] },
      { name: "Review", minutes: [2, 5] },
    ],
    columnClass: "border-violet-200 dark:border-violet-800/60",
    headerClass:
      "bg-violet-50 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  },
};

const SENSITIVITY_LABELS: Record<SensitivityProfile, string> = {
  public: "Public: all sources permitted including public internet",
  internal: "Internal: exclude public internet sources; vault-only corpus",
  confidential:
    "Confidential: vault corpus only; no external network calls permitted",
};

const FIDELITY_LABELS: Record<IntentCore["target_fidelity"], string> = {
  exploratory: "Exploratory",
  factual: "Factual",
  exhaustive: "Exhaustive",
};

const DEPTH_LABELS: Record<IntentCore["estimated_depth"], string> = {
  shallow: "Shallow",
  standard: "Standard",
  deep: "Deep",
};

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function RouteSkeleton() {
  return (
    <div
      aria-label="Loading route analysis…"
      aria-busy="true"
      className="flex flex-col gap-6"
    >
      {/* Intent core skeleton */}
      <div className="h-24 animate-pulse rounded-xl border border-border bg-accent/20" />
      {/* Entity chips skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-6 w-20 animate-pulse rounded-full bg-accent/30"
            aria-hidden
          />
        ))}
      </div>
      {/* Matrix skeleton */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, minmax(200px, 1fr))" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-xl border-2 border-border bg-accent/20"
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intent Core panel
// ---------------------------------------------------------------------------

interface IntentCorePanelProps {
  intentCore: IntentCore;
}

function IntentCorePanel({ intentCore }: IntentCorePanelProps) {
  return (
    <section aria-labelledby="intent-core-heading">
      <h3
        id="intent-core-heading"
        className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Intent Core
      </h3>
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        {/* Research question */}
        <p className="mb-3 text-sm leading-relaxed text-foreground">
          &ldquo;{intentCore.research_question}&rdquo;
        </p>
        {/* Meta pills row */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">Fidelity:</span>
            {FIDELITY_LABELS[intentCore.target_fidelity]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">Depth:</span>
            {DEPTH_LABELS[intentCore.estimated_depth]}
          </span>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Entity chips
// ---------------------------------------------------------------------------

interface EntityChipsProps {
  entities: string[];
}

function EntityChips({ entities }: EntityChipsProps) {
  return (
    <section aria-labelledby="entities-heading">
      <h3
        id="entities-heading"
        className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Extracted Entities
      </h3>
      {entities.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">(none detected)</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {entities.map((entity) => (
            <span
              key={entity}
              className={cn(
                "inline-flex items-center rounded-full border border-border",
                "bg-background px-2.5 py-0.5 text-xs font-medium text-foreground",
              )}
            >
              {entity}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Archival archetypes
// ---------------------------------------------------------------------------

interface ArchetypeBadgesProps {
  archetypes: string[];
}

function ArchetypeBadges({ archetypes }: ArchetypeBadgesProps) {
  return (
    <section aria-labelledby="archetypes-heading">
      <h3
        id="archetypes-heading"
        className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Archival Archetypes
      </h3>
      {archetypes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">(none detected)</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {archetypes.map((archetype) => (
            <Badge
              key={archetype}
              variant="secondary"
              className="text-xs font-normal"
            >
              {archetype}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sensitivity constraints
// ---------------------------------------------------------------------------

interface SensitivityConstraintsProps {
  sensitivityProfile: SensitivityProfile;
}

function SensitivityConstraints({ sensitivityProfile }: SensitivityConstraintsProps) {
  return (
    <section aria-labelledby="sensitivity-heading">
      <h3
        id="sensitivity-heading"
        className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Sensitivity Constraints
      </h3>
      <p
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs",
          sensitivityProfile === "public" &&
            "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
          sensitivityProfile === "internal" &&
            "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
          sensitivityProfile === "confidential" &&
            "bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
        )}
      >
        <AlertCircle aria-hidden className="size-3 shrink-0" />
        {SENSITIVITY_LABELS[sensitivityProfile]}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Column placeholder
// ---------------------------------------------------------------------------

function EmptyColumnPlaceholder({ label }: { label: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[120px] items-center justify-center rounded-xl",
        "border-2 border-dashed border-border bg-muted/20 p-4",
      )}
      aria-label={`No routes available for ${label}`}
    >
      <p className="text-center text-xs text-muted-foreground">
        No paths available for
        <br />
        <span className="font-medium">{label}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Routing matrix (3-column grouped by routing_category)
// ---------------------------------------------------------------------------

interface RoutingMatrixProps {
  cards: RouteCard[];
  selectedVenue: string | null;
  onSelect: (route: string) => void;
}

function RoutingMatrix({ cards, selectedVenue, onSelect }: RoutingMatrixProps) {
  const categories: RoutingCategory[] = ["fast_path", "precise_vector", "swarm_synthesis"];

  return (
    <section aria-labelledby="routing-matrix-heading">
      <h3
        id="routing-matrix-heading"
        className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Routing Recommendation Matrix
      </h3>
      <div
        className="grid gap-3 overflow-x-auto"
        style={{ gridTemplateColumns: "repeat(3, minmax(200px, 1fr))" }}
        role="radiogroup"
        aria-label="Routing path options"
      >
        {categories.map((category) => {
          const meta = CATEGORY_META[category];
          const categoryCards = cards.filter(
            (c) => c.routing_category === category,
          );

          return (
            <div key={category} className="flex flex-col gap-2">
              {/* Column header */}
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5",
                  meta.headerClass,
                )}
              >
                {meta.icon}
                <span className="text-[11px] font-bold uppercase tracking-wide">
                  {meta.label}
                </span>
              </div>

              {/* Cards or empty placeholder */}
              {categoryCards.length === 0 ? (
                <EmptyColumnPlaceholder label={meta.label} />
              ) : (
                <div className={cn("flex flex-col gap-2")}>
                  {categoryCards.map((card) => (
                    <RoutingMatrixCard
                      key={card.route}
                      card={card}
                      selected={selectedVenue === card.route}
                      onSelect={() => onSelect(card.route)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tentative execution plan
// ---------------------------------------------------------------------------

interface ExecutionPlanProps {
  selectedCategory: RoutingCategory | null;
}

function ExecutionPlan({ selectedCategory }: ExecutionPlanProps) {
  if (!selectedCategory) {
    return (
      <section aria-labelledby="execution-plan-heading">
        <h3
          id="execution-plan-heading"
          className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Tentative Execution Plan
        </h3>
        <p className="text-xs text-muted-foreground italic">
          Select a routing path above to see stage estimates.
        </p>
      </section>
    );
  }

  const meta = CATEGORY_META[selectedCategory];

  return (
    <section aria-labelledby="execution-plan-heading">
      <h3
        id="execution-plan-heading"
        className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Tentative Execution Plan
      </h3>
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        {/* Total time banner */}
        <div className="mb-3 flex items-center gap-2">
          <Clock aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{meta.timeRange}</span>
            {" "}
            <span className="text-muted-foreground">(estimated)</span>
          </p>
        </div>
        {/* Stage breakdown */}
        <ol className="flex flex-col gap-2" aria-label="Stage breakdown">
          {meta.stages.map((stage, idx) => (
            <li key={stage.name} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full",
                  "text-[10px] font-bold",
                  "bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                {idx + 1}
              </span>
              <span className="flex-1 text-xs text-foreground">{stage.name}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {stage.minutes[0]}–{stage.minutes[1]} min
                <span className="sr-only"> (estimated)</span>
                <span aria-hidden className="ml-0.5 text-muted-foreground/60">
                  (est.)
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ResearchRouteSelection() {
  const { state, dispatch } = useWizardStateContext();
  const {
    route_cards,
    selected_venue,
    intent_core,
    extracted_entities,
    archival_archetypes,
    is_fetching_routes,
    error,
    error_scope,
    package_fields,
  } = state;

  const sensitivityProfile = (package_fields.sensitivity_profile ?? "public") as SensitivityProfile;
  const showRoutingError = error !== null && error_scope === "routing";
  const canAdvance = selected_venue !== null && !is_fetching_routes;

  // Derive the routing_category of the currently selected card
  const selectedCard = route_cards?.find((c) => c.route === selected_venue) ?? null;
  const selectedCategory: RoutingCategory | null =
    selectedCard?.routing_category ?? null;

  const handleGoBack = () => dispatch({ type: "GO_BACK" });
  const handleAdvance = () => {
    if (canAdvance) dispatch({ type: "ADVANCE_TO_CONFIRM" });
  };

  return (
    <div className="flex flex-col gap-8" aria-label="Route selection — Step 2">
      {/* ------------------------------------------------------------------ */}
      {/* Section heading                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          Routing Recommendation Matrix
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the routing analysis results and select a path to initiate.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Error — routing scope                                               */}
      {/* ------------------------------------------------------------------ */}
      {showRoutingError && (
        <div
          role="alert"
          aria-live="assertive"
          className={cn(
            "rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3",
            "text-sm text-destructive",
          )}
        >
          <span className="font-semibold">Routing analysis failed: </span>
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Loading or populated state                                           */}
      {/* ------------------------------------------------------------------ */}
      {is_fetching_routes || !route_cards ? (
        <RouteSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Intent Core */}
          {intent_core && <IntentCorePanel intentCore={intent_core} />}

          {/* Extracted Entities */}
          <EntityChips entities={extracted_entities} />

          {/* Archival Archetypes */}
          <ArchetypeBadges archetypes={archival_archetypes} />

          {/* Sensitivity Constraints */}
          <SensitivityConstraints sensitivityProfile={sensitivityProfile} />

          {/* Routing Matrix */}
          <RoutingMatrix
            cards={route_cards}
            selectedVenue={selected_venue}
            onSelect={(route) =>
              dispatch({
                type: "SELECT_VENUE",
                venue: route as import("@/types/workflows/research").RoutePreference,
              })
            }
          />

          {/* Hint: nothing selected yet */}
          {selected_venue === null && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Select a path above to continue.
            </p>
          )}

          {/* Tentative Execution Plan */}
          <ExecutionPlan selectedCategory={selectedCategory} />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Navigation footer                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={handleGoBack}
          aria-label="Back to research package"
          className="gap-1.5"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </Button>

        <Button
          type="button"
          onClick={handleAdvance}
          disabled={!canAdvance}
          aria-disabled={!canAdvance}
          className="min-w-[200px] font-semibold tracking-wide"
        >
          Initiate Routing
        </Button>
      </div>
    </div>
  );
}
