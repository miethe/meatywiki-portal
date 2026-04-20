"use client";

/**
 * RoutingRecommendationCard — displays a rule-based workflow routing recommendation
 * for an artifact.
 *
 * Behavior:
 *   - Calls GET /api/artifacts/:artifactId/routing-recommendation on mount.
 *   - When the response has template=null: renders nothing (hidden).
 *   - When a recommendation is present: renders a card with:
 *       - Recommended template name (human-readable label)
 *       - Rationale text
 *       - "Start Workflow" button — opens the Quick Add modal pre-seeded with
 *         the recommended template, or navigates to the workflow initiation flow
 *         (Screen A, deferred to v1.5 — falls back to the Quick Add modal for now).
 *   - Loading state: skeleton pulse.
 *   - Error state: silent (card hidden on API errors to avoid noise on pages
 *     that embed it as a non-critical widget).
 *
 * WCAG 2.1 AA: card has role="region" + aria-label; button has descriptive text.
 *
 * Design spec: Portal v1.5 Phase 1 (P1.5-1-06).
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getRoutingRecommendation } from "@/lib/api/artifacts";
import type { RoutingRecommendation } from "@/lib/api/artifacts";

// ---------------------------------------------------------------------------
// Template label map — human-readable names for template slugs
// ---------------------------------------------------------------------------

const TEMPLATE_LABELS: Record<string, string> = {
  research_synthesis_v1: "Research Synthesis",
  verification_workflow_v1: "Verification Workflow",
  compile_v1: "Full Compile",
  lint_scope_v1: "Lint Scope",
  source_ingest_v1: "Source Ingest",
};

function templateLabel(slug: string): string {
  return TEMPLATE_LABELS[slug] ?? slug;
}

// ---------------------------------------------------------------------------
// ChevronRightIcon — inline SVG (no external dep)
// ---------------------------------------------------------------------------

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// LightBulbIcon — decoration for the recommendation header
// ---------------------------------------------------------------------------

function LightBulbIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0 text-amber-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m1.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function RoutingCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      aria-label="Loading routing recommendation"
      aria-busy="true"
      className="animate-pulse rounded-md border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-4 rounded-full bg-muted" />
        <div className="h-3.5 w-32 rounded bg-muted" />
      </div>
      <div className="h-3 w-full rounded bg-muted mb-1.5" />
      <div className="h-3 w-4/5 rounded bg-muted mb-3" />
      <div className="h-8 w-36 rounded-md bg-muted" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RoutingRecommendationCardProps {
  /** Artifact ID to fetch the recommendation for. */
  artifactId: string;
  /**
   * Callback invoked when the user clicks "Start Workflow".
   * Receives the recommended template slug.
   * When not provided, the button logs a console warning (useful during dev).
   */
  onStart?: (templateSlug: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// RoutingRecommendationCard
// ---------------------------------------------------------------------------

type CardState =
  | { status: "loading" }
  | { status: "no_match" }
  | { status: "match"; recommendation: RoutingRecommendation }
  | { status: "error"; error: string };

export function RoutingRecommendationCard({
  artifactId,
  onStart,
  className,
}: RoutingRecommendationCardProps) {
  const [cardState, setCardState] = useState<CardState>({ status: "loading" });

  const fetchRecommendation = useCallback(async () => {
    setCardState({ status: "loading" });
    try {
      const rec = await getRoutingRecommendation(artifactId);
      if (!rec.template) {
        setCardState({ status: "no_match" });
      } else {
        setCardState({ status: "match", recommendation: rec });
      }
    } catch (err) {
      // Silent error — don't render a broken card for a non-critical widget.
      const message =
        err instanceof Error ? err.message : "Failed to load recommendation";
      setCardState({ status: "error", error: message });
    }
  }, [artifactId]);

  useEffect(() => {
    void fetchRecommendation();
  }, [fetchRecommendation]);

  // Loading state
  if (cardState.status === "loading") {
    return <RoutingCardSkeleton />;
  }

  // No match, error, or hidden states — render nothing
  if (cardState.status === "no_match" || cardState.status === "error") {
    return null;
  }

  const { recommendation } = cardState;
  const label = templateLabel(recommendation.template!);

  function handleStart() {
    if (!recommendation.template) return;
    if (onStart) {
      onStart(recommendation.template);
    } else {
      // Dev fallback — Screen A wizard (deferred to v1.5).
      // When onStart is not wired, log the intent for now.
      console.warn(
        "[RoutingRecommendationCard] onStart not wired — template:",
        recommendation.template,
      );
    }
  }

  return (
    <section
      role="region"
      aria-label="Workflow recommendation"
      className={cn(
        "rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20",
        className,
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <LightBulbIcon />
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Recommended Workflow
        </span>
      </div>

      {/* Template name */}
      <p className="text-sm font-medium text-foreground mb-1">{label}</p>

      {/* Rationale */}
      {recommendation.rationale && (
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          {recommendation.rationale}
        </p>
      )}

      {/* Start button */}
      <button
        type="button"
        onClick={handleStart}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5",
          "text-xs font-medium",
          "bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2",
          "transition-colors",
        )}
        aria-label={`Start ${label} workflow`}
      >
        Start Workflow
        <ArrowRightIcon />
      </button>
    </section>
  );
}
