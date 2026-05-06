"use client";

/**
 * RoutingRecommendationCard — displays an ML-based workflow routing
 * recommendation for an artifact (P2-4-08).
 *
 * Behavior:
 *   - Calls GET /api/artifacts/:artifactId/routing?recommend=true on mount.
 *   - When next_template is null: renders nothing.
 *   - When a recommendation is present: renders a card with:
 *       - Recommended template name (human-readable label)
 *       - Confidence score (0–1, shown as percentage badge + bar)
 *       - Rationale text
 *       - "Run Workflow" button — triggers onRunWorkflow(templateSlug) callback
 *       - "Dismiss" button — hides the card (session-local state)
 *   - Loading state: skeleton pulse.
 *   - Error state: silent (card hidden; non-critical widget).
 *   - Dismiss state: renders nothing (hidden for the session via local state).
 *
 * Variant:
 *   - "artifact" (default): full card for the Workflow OS tab on Artifact Detail.
 *   - "run": compact inline strip for Screen C / Workflows Dashboard run context.
 *
 * WCAG 2.1 AA: card has role="region" + aria-label; buttons have descriptive text.
 *
 * Design spec: Portal v2 P2-4-08.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getMLRoutingRecommendation } from "@/lib/api/artifacts";
import type { MLRoutingRecommendation } from "@/lib/api/artifacts";

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
// Confidence formatting
// ---------------------------------------------------------------------------

function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/** Colour tier for the confidence indicator */
function confidenceTier(score: number): "low" | "medium" | "high" {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function RouteIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5 shrink-0"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ConfidenceBar — visual representation of score
// ---------------------------------------------------------------------------

interface ConfidenceBarProps {
  score: number;
  className?: string;
}

function ConfidenceBar({ score, className }: ConfidenceBarProps) {
  const tier = confidenceTier(score);
  const pct = Math.round(score * 100);

  const barColour =
    tier === "high"
      ? "bg-emerald-500 dark:bg-emerald-400"
      : tier === "medium"
        ? "bg-amber-500 dark:bg-amber-400"
        : "bg-slate-400 dark:bg-slate-500";

  const labelColour =
    tier === "high"
      ? "text-emerald-700 dark:text-emerald-400"
      : tier === "medium"
        ? "text-amber-700 dark:text-amber-400"
        : "text-slate-600 dark:text-slate-400";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        aria-label={`Confidence: ${pct}%`}
        className={cn(
          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
          tier === "high"
            ? "bg-emerald-100 dark:bg-emerald-900/30"
            : tier === "medium"
              ? "bg-amber-100 dark:bg-amber-900/30"
              : "bg-slate-100 dark:bg-slate-800",
          labelColour,
        )}
      >
        {formatConfidence(score)} confidence
      </span>
      <div
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Confidence meter: ${pct}%`}
        className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
      >
        <div
          aria-hidden="true"
          className={cn("h-full rounded-full transition-all duration-500", barColour)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function RoutingCardSkeleton({ variant }: { variant: "artifact" | "run" }) {
  if (variant === "run") {
    return (
      <div
        aria-hidden="true"
        aria-busy="true"
        className="animate-pulse flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
      >
        <div className="h-3 w-3 rounded-full bg-muted" />
        <div className="h-3 w-28 rounded bg-muted" />
        <div className="h-3 w-16 rounded-full bg-muted ml-auto" />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      aria-busy="true"
      className="animate-pulse rounded-lg border border-border bg-card p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="h-3.5 w-3.5 rounded bg-muted" />
        <div className="h-3 w-28 rounded bg-muted" />
      </div>
      <div className="h-4 w-40 rounded bg-muted" />
      <div className="flex items-center gap-2">
        <div className="h-5 w-24 rounded-full bg-muted" />
        <div className="h-1.5 w-20 rounded-full bg-muted" />
      </div>
      <div className="h-3 w-full rounded bg-muted" />
      <div className="h-3 w-4/5 rounded bg-muted" />
      <div className="flex gap-2 pt-1">
        <div className="h-7 w-28 rounded-md bg-muted" />
        <div className="h-7 w-16 rounded-md bg-muted" />
      </div>
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
   * Callback invoked when the user clicks "Run Workflow".
   * Receives the recommended template slug.
   */
  onRunWorkflow?: (templateSlug: string) => void;
  /**
   * Visual variant:
   * - "artifact": full card for the Workflow OS tab (default)
   * - "run": compact inline strip for Screen C / active run context
   */
  variant?: "artifact" | "run";
  className?: string;
}

// ---------------------------------------------------------------------------
// Internal state machine
// ---------------------------------------------------------------------------

type CardState =
  | { status: "loading" }
  | { status: "dismissed" }
  | { status: "no_match" }
  | { status: "error" }
  | { status: "match"; recommendation: MLRoutingRecommendation };

// ---------------------------------------------------------------------------
// RoutingRecommendationCard
// ---------------------------------------------------------------------------

export function RoutingRecommendationCard({
  artifactId,
  onRunWorkflow,
  variant = "artifact",
  className,
}: RoutingRecommendationCardProps) {
  const [state, setState] = useState<CardState>({ status: "loading" });

  const fetchRecommendation = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const rec = await getMLRoutingRecommendation(artifactId);
      if (!rec.next_template) {
        setState({ status: "no_match" });
      } else {
        setState({ status: "match", recommendation: rec });
      }
    } catch {
      // Silent — non-critical widget; don't surface API errors to user.
      setState({ status: "error" });
    }
  }, [artifactId]);

  useEffect(() => {
    void fetchRecommendation();
  }, [fetchRecommendation]);

  function handleDismiss() {
    setState({ status: "dismissed" });
  }

  function handleRun() {
    if (state.status !== "match" || !state.recommendation.next_template) return;
    if (onRunWorkflow) {
      onRunWorkflow(state.recommendation.next_template);
    } else {
      console.warn(
        "[RoutingRecommendationCard] onRunWorkflow not wired — template:",
        state.recommendation.next_template,
      );
    }
  }

  // Loading skeleton
  if (state.status === "loading") {
    return <RoutingCardSkeleton variant={variant} />;
  }

  // Suppressed states — render nothing
  if (
    state.status === "no_match" ||
    state.status === "error" ||
    state.status === "dismissed"
  ) {
    return null;
  }

  const { recommendation } = state;
  const label = templateLabel(recommendation.next_template!);

  // ---------------------------------------------------------------------------
  // Compact "run" variant — inline strip for Screen C
  // ---------------------------------------------------------------------------

  if (variant === "run") {
    return (
      <div
        role="region"
        aria-label={`Suggested next workflow: ${label}`}
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md",
          "border border-blue-200/70 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20",
          "px-3 py-2",
          className,
        )}
      >
        {/* Icon + label */}
        <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
          <RouteIcon />
          <span className="text-[11px] font-semibold">Suggested next:</span>
        </div>
        <span className="text-xs font-medium text-foreground">{label}</span>

        {/* Confidence badge */}
        <span
          aria-label={`${formatConfidence(recommendation.confidence_score)} confidence`}
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
            confidenceTier(recommendation.confidence_score) === "high"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : confidenceTier(recommendation.confidence_score) === "medium"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
          )}
        >
          {formatConfidence(recommendation.confidence_score)}
        </span>

        {/* Actions pushed to right */}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRun}
            aria-label={`Run ${label} workflow`}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1",
              "bg-blue-600 text-white text-[11px] font-medium",
              "hover:bg-blue-700 active:bg-blue-800 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
            )}
          >
            <PlayIcon />
            Run
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss suggestion"
            className={cn(
              "inline-flex items-center rounded p-1",
              "text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            <XIcon />
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Full "artifact" variant — card for Workflow OS tab
  // ---------------------------------------------------------------------------

  return (
    <section
      role="region"
      aria-label="Workflow routing recommendation"
      className={cn(
        "rounded-lg border",
        "border-blue-200/80 bg-gradient-to-br from-blue-50/80 to-slate-50/40",
        "dark:border-blue-900/40 dark:from-blue-950/30 dark:to-slate-900/20",
        "p-4 shadow-sm",
        className,
      )}
    >
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
          >
            <RouteIcon />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            Suggested Next Workflow
          </span>
        </div>
        {/* Dismiss */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss routing suggestion"
          className={cn(
            "inline-flex items-center rounded p-1 -mr-1 -mt-0.5",
            "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/60",
            "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <XIcon />
        </button>
      </div>

      {/* Template name */}
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>

      {/* Confidence score */}
      <ConfidenceBar score={recommendation.confidence_score} className="mb-3" />

      {/* Rationale */}
      {recommendation.rationale && (
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          {recommendation.rationale}
        </p>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleRun}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5",
            "bg-blue-600 text-white text-xs font-medium",
            "hover:bg-blue-700 active:bg-blue-800 transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            "shadow-sm",
          )}
        >
          <PlayIcon />
          Run Workflow
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss this recommendation"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5",
            "border border-input bg-background text-xs font-medium text-foreground",
            "hover:bg-accent hover:text-accent-foreground transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
