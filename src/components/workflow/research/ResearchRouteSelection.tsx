"use client";

/**
 * ResearchRouteSelection — Step 2 of the 3-step external-research wizard.
 *
 * Reads state.route_cards from the wizard context (populated by FETCH_ROUTES_SUCCESS
 * after submitPackage() fires POST /api/workflows/external-research/routing-analysis).
 *
 * Renders up to 5 VenueCard tiles in a responsive grid. User clicks a card →
 * dispatches SELECT_VENUE (action.venue = card.route slug). The "Continue to
 * Preview" button dispatches ADVANCE_TO_CONFIRM (disabled until selected_venue
 * is non-null). Back button dispatches GO_BACK (returns to Step 1).
 *
 * Loading state: is_fetching_routes === true while routing analysis is in flight.
 * Error state: error_scope === "routing" surfaces an inline alert.
 *
 * NOTE: the task description referenced an "ADVANCE_STEP" action, but the
 * hook's discriminated union (useWorkflowWizardState.tsx line 137) defines
 * ADVANCE_TO_CONFIRM. This component uses ADVANCE_TO_CONFIRM — the correct
 * contract. See hook-contract gap note in report.
 *
 * P4-04 (audit-wave-2-phase-4).
 */

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWizardStateContext } from "@/hooks/useWorkflowWizardState";
import { VenueCard } from "./VenueCard";
import { ArrowLeft } from "lucide-react";

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function RouteSkeleton() {
  return (
    <div
      aria-label="Loading route analysis…"
      aria-busy="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-52 animate-pulse rounded-xl border-2 border-border bg-accent/20",
          )}
          aria-hidden="true"
        />
      ))}
    </div>
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
    is_fetching_routes,
    error,
    error_scope,
  } = state;

  const showRoutingError = error !== null && error_scope === "routing";
  const canAdvance = selected_venue !== null && !is_fetching_routes;

  const handleGoBack = () => {
    dispatch({ type: "GO_BACK" });
  };

  const handleAdvance = () => {
    if (!canAdvance) return;
    dispatch({ type: "ADVANCE_TO_CONFIRM" });
  };

  return (
    <div className="flex flex-col gap-8" aria-label="Route selection — Step 2">
      {/* Section heading */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          Select Research Venue
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The routing analyser ranked these venues by suitability for your
          research package. Pick the one you want to use.
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
      {/* Venue cards — loading / populated states                            */}
      {/* ------------------------------------------------------------------ */}
      {is_fetching_routes || !route_cards ? (
        <RouteSkeleton />
      ) : (
        <div
          role="radiogroup"
          aria-label="Available research venues"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {route_cards.map((card) => (
            <VenueCard
              key={card.route}
              card={card}
              selected={selected_venue === card.route}
              onSelect={() =>
                dispatch({ type: "SELECT_VENUE", venue: card.route })
              }
            />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Hint: nothing selected yet                                          */}
      {/* ------------------------------------------------------------------ */}
      {!is_fetching_routes && route_cards && selected_venue === null && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Select a venue to continue.
        </p>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Navigation footer                                                   */}
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
          className="min-w-[180px]"
        >
          Continue to Preview
        </Button>
      </div>
    </div>
  );
}
