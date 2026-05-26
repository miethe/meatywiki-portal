"use client";

/**
 * ResearchRouteCards — Step 2 for external_research_v1 wizard flow.
 *
 * Renders when selectedTemplateId === "external_research_v1" in step-2-routing.tsx.
 * The generic Step2Routing component (including RoutingRecommendationCard) is
 * left completely unchanged.
 *
 * Calls POST /api/workflows/external-research/routing-analysis on mount with the
 * current researchPackage payload. Renders venue route cards with score/rationale/
 * output-format/prompt-preview (collapsed accordion). User selects a card;
 * selection is persisted to researchPackage.selected_route in wizard state.
 *
 * Stitch visual review finding (P3-01):
 *   The routing screen uses a compact card list with score-bar visualization and
 *   an "Alternative Paths" secondary column. Our implementation uses a vertical
 *   card list with numeric score badge — consistent with the Stitch layout intent.
 *   No material blocker; card-list approach confirmed.
 *
 * Phase: P3-03 (portal-v2.1-research-workflow-realignment)
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api/client";
import type { ResearchPackage, ResearchRouteCard } from "./initiation-wizard";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ResearchRouteCardsProps {
  researchPackage: ResearchPackage;
  onSelectRoute: (card: ResearchRouteCard) => void;
  submitError?: string | null;
}

// ---------------------------------------------------------------------------
// Venue display name map
// ---------------------------------------------------------------------------

const VENUE_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT Deep Research",
  chatgpt_deep_research: "ChatGPT Deep Research",
  perplexity: "Perplexity",
  gemini: "Gemini Research",
  notebooklm: "NotebookLM",
  gemini_notebooklm: "NotebookLM",
  internal_synthesis: "Internal Synthesis",
  custom_manual: "Custom / Manual",
  auto: "Auto-Selected",
};

function venueLabel(route: string): string {
  return VENUE_LABELS[route] ?? route;
}

// ---------------------------------------------------------------------------
// Score badge
// ---------------------------------------------------------------------------

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const colourClass =
    pct >= 80
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : pct >= 50
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-muted text-muted-foreground";

  return (
    <span
      aria-label={`Suitability score: ${pct}%`}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums shrink-0",
        colourClass,
      )}
    >
      {pct}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Score bar
// ---------------------------------------------------------------------------

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const barColour =
    pct >= 80
      ? "bg-emerald-500 dark:bg-emerald-400"
      : pct >= 50
        ? "bg-amber-500 dark:bg-amber-400"
        : "bg-muted-foreground/30";

  return (
    <div
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Score: ${pct}%`}
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        aria-hidden="true"
        className={cn("h-full rounded-full transition-all", barColour)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prompt preview accordion
// ---------------------------------------------------------------------------

function PromptPreview({ preview }: { preview: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3 border-t border-border/50 pt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground",
          "hover:text-foreground transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
        )}
      >
        <svg
          aria-hidden="true"
          className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-90")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {expanded ? "Hide prompt preview" : "Show prompt preview"}
      </button>
      {expanded && (
        <pre
          className={cn(
            "mt-2 max-h-[160px] overflow-y-auto rounded-md",
            "border border-border bg-muted/40 px-3 py-2.5",
            "text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap",
          )}
        >
          {preview}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single route card
// ---------------------------------------------------------------------------

interface RouteCardItemProps {
  card: ResearchRouteCard;
  isSelected: boolean;
  onSelect: () => void;
  rank: number;
}

function RouteCardItem({ card, isSelected, onSelect, rank }: RouteCardItemProps) {
  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`Select ${venueLabel(card.route)} — score ${Math.round(card.score * 100)}%`}
      className={cn(
        "relative rounded-lg border-2 p-4 cursor-pointer transition-all duration-150",
        "hover:border-foreground/30 hover:bg-accent/30",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        isSelected
          ? "border-foreground bg-accent/40"
          : "border-border bg-card",
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* Rank indicator */}
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
              rank === 1 ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
            )}
          >
            {rank}
          </span>
          <h3 className="text-sm font-semibold truncate">{venueLabel(card.route)}</h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ScoreBadge score={card.score} />

          {/* Selected indicator */}
          <div
            aria-hidden="true"
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
              isSelected
                ? "border-foreground bg-foreground text-background"
                : "border-muted-foreground/40",
            )}
          >
            {isSelected && (
              <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="mt-2.5">
        <ScoreBar score={card.score} />
      </div>

      {/* Rationale */}
      <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">{card.rationale}</p>

      {/* Expected output */}
      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Output:
        </span>
        <span className="text-[11px] text-muted-foreground">{card.expected_output}</span>
      </div>

      {/* Prompt preview (collapsed accordion) */}
      <PromptPreview preview={card.prompt_preview} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function RoutingLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading route cards">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-[140px] animate-pulse rounded-lg border border-border bg-muted"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// API call helper
// ---------------------------------------------------------------------------

interface RoutingAnalysisRequest {
  topic: string;
  research_question: string;
  corpus_artifact_ids: string[];
  route_preference: string;
  constraints: Record<string, string>;
}

interface RoutingAnalysisResponse {
  route_cards: ResearchRouteCard[];
}

async function fetchRouteCards(
  pkg: ResearchPackage,
): Promise<ResearchRouteCard[]> {
  const body: RoutingAnalysisRequest = {
    topic: pkg.topic,
    research_question: pkg.research_question,
    corpus_artifact_ids: pkg.selected_artifact_ids,
    route_preference: pkg.route_preference,
    constraints: {
      desired_output: pkg.desired_output,
      ...(pkg.background_context ? { background_context: pkg.background_context } : {}),
    },
  };

  const response = await apiFetch<RoutingAnalysisResponse>(
    "/api/workflows/external-research/routing-analysis",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  return response.route_cards;
}

// ---------------------------------------------------------------------------
// ResearchRouteCards
// ---------------------------------------------------------------------------

export function ResearchRouteCards({
  researchPackage,
  onSelectRoute,
  submitError,
}: ResearchRouteCardsProps) {
  const [cards, setCards] = useState<ResearchRouteCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setFetchError(null);

    fetchRouteCards(researchPackage)
      .then((routeCards) => {
        if (cancelled) return;
        setCards(routeCards);
        setIsLoading(false);
        // Auto-select the highest-scoring card if none selected yet.
        if (routeCards.length > 0 && !researchPackage.selected_route) {
          onSelectRoute(routeCards[0]);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load route cards.";
        setFetchError(msg);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  return (
    <div className="flex flex-col gap-6">
      {/* Section heading */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">Select Research Venue</h2>
        <p className="mt-1 text-sm text-muted-foreground italic">
          Choose the best venue for your research question. Scores are based on
          corpus size, domain, and freshness signals.
        </p>
      </div>

      {/* Context summary */}
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground/80">Research topic</p>
        <p className="text-sm font-medium text-foreground">{researchPackage.topic}</p>
        {researchPackage.research_question && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {researchPackage.research_question}
          </p>
        )}
      </div>

      {/* Loading */}
      {isLoading && <RoutingLoadingSkeleton />}

      {/* Error boundary */}
      {!isLoading && fetchError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4"
        >
          <p className="text-sm font-medium text-destructive">
            Failed to load routing recommendations
          </p>
          <p className="text-xs text-destructive/80">{fetchError}</p>
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className={cn(
              "self-start inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
              "border border-destructive/30 bg-background text-destructive",
              "hover:bg-destructive/5 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            Try again
          </button>
        </div>
      )}

      {/* Route cards */}
      {!isLoading && !fetchError && (
        <>
          {cards.length === 0 ? (
            <div
              role="status"
              className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center"
            >
              <p className="text-sm font-medium text-muted-foreground">
                No routes returned
              </p>
              <p className="text-xs text-muted-foreground/70">
                The routing analyzer returned no cards. This is unexpected — try again.
              </p>
              <button
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
                className={cn(
                  "mt-1 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                  "border border-input bg-background text-foreground",
                  "hover:bg-accent transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                Retry analysis
              </button>
            </div>
          ) : (
            <div
              role="radiogroup"
              aria-label="Venue route options"
              className="flex flex-col gap-3"
            >
              {cards.map((card, idx) => (
                <RouteCardItem
                  key={card.route}
                  card={card}
                  isSelected={researchPackage.selected_route?.route === card.route}
                  onSelect={() => onSelectRoute(card)}
                  rank={idx + 1}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Wizard-level validation error (from Next button press) */}
      {submitError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {submitError}
        </div>
      )}
    </div>
  );
}
