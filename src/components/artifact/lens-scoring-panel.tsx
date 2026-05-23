"use client";

/**
 * LensScoringPanel — read-only display of the five core Lens dimension scores.
 *
 * Dimensions (5 total, drawn from lens_scores_jsonb or explicit props):
 *   fidelity, freshness, confidence, relevance, completeness
 *
 * Each dimension row renders:
 *   - A capitalised label
 *   - An <InfoTooltip> loaded from TOOLTIP_COPY.lens (no inline strings)
 *   - A numeric score (0.0–1.0 range) displayed as a progress bar + percentage
 *
 * The component accepts either:
 *   - `scores`: a Record<string, number | undefined | null> (e.g. lens_scores_jsonb)
 *   - Null / undefined → renders an empty state
 *
 * WCAG 2.1 AA:
 *   - Progress bar includes aria-valuenow / aria-valuemin / aria-valuemax
 *   - InfoTooltip buttons carry accessible labels
 *
 * Usage (graph node detail, artifact sidebar, etc.):
 *   <LensScoringPanel scores={node.lens_scores_jsonb} />
 *
 * Portal v2 — P2-04.
 */

import { cn } from "@/lib/utils";
import InfoTooltip from "@/components/ui/info-tooltip";
import { TOOLTIP_COPY } from "@/lib/copy/tooltips";

// ---------------------------------------------------------------------------
// Dimension config
// ---------------------------------------------------------------------------

/** The five canonical Lens scoring dimensions. */
type LensDimension = keyof typeof TOOLTIP_COPY.lens;

const LENS_DIMENSIONS: LensDimension[] = [
  "fidelity",
  "freshness",
  "confidence",
  "relevance",
  "completeness",
];

const DIM_LABELS: Record<LensDimension, string> = {
  fidelity: "Fidelity",
  freshness: "Freshness",
  confidence: "Confidence",
  relevance: "Relevance",
  completeness: "Completeness",
};

// ---------------------------------------------------------------------------
// Score bar colour thresholds (0–1 scale)
// ---------------------------------------------------------------------------

function barColour(score: number): string {
  if (score >= 0.7) return "bg-emerald-500";
  if (score >= 0.4) return "bg-amber-500";
  return "bg-rose-400";
}

// ---------------------------------------------------------------------------
// Single dimension row
// ---------------------------------------------------------------------------

interface DimRowProps {
  dim: LensDimension;
  score: number | null | undefined;
}

function DimRow({ dim, score }: DimRowProps) {
  const hasScore = typeof score === "number" && !Number.isNaN(score);
  const clamped = hasScore ? Math.max(0, Math.min(1, score as number)) : 0;
  const pct = Math.round(clamped * 100);

  return (
    <div className="flex flex-col gap-1">
      {/* Label row */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-foreground">
          {DIM_LABELS[dim]}
        </span>
        <InfoTooltip
          content={TOOLTIP_COPY.lens[dim]}
          side="right"
          align="center"
          icon="info"
          label={`${DIM_LABELS[dim]} — more information`}
          iconClassName="h-3 w-3"
        />
        {hasScore && (
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {pct}%
          </span>
        )}
        {!hasScore && (
          <span className="ml-auto text-xs text-muted-foreground/60">—</span>
        )}
      </div>

      {/* Progress bar */}
      <div
        role="meter"
        aria-label={DIM_LABELS[dim]}
        aria-valuenow={hasScore ? pct : 0}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          aria-hidden="true"
          className={cn(
            "h-full rounded-full transition-all duration-300",
            hasScore ? barColour(clamped) : "bg-muted-foreground/20",
          )}
          style={{ width: `${hasScore ? pct : 0}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <p className="text-xs font-medium text-foreground">No lens scores</p>
      <p className="text-[11px] text-muted-foreground">
        Lens dimensions have not been scored for this artifact.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LensScoringPanelProps {
  /**
   * Map of lens dimension key → score (0.0–1.0).
   * Accepts lens_scores_jsonb directly; keys not in LENS_DIMENSIONS are ignored.
   * Null / undefined → renders an empty state.
   */
  scores?: Record<string, number | undefined | null> | null;
  /**
   * Optional heading rendered above the dimension rows.
   * Pass an empty string or omit to suppress the heading entirely.
   */
  heading?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * LensScoringPanel renders a compact read-only view of the five core Lens
 * dimension scores (fidelity, freshness, confidence, relevance, completeness).
 * Each label is accompanied by an InfoTooltip sourced from TOOLTIP_COPY.lens.
 */
export function LensScoringPanel({
  scores,
  heading = "Lens Scores",
  className,
}: LensScoringPanelProps) {
  const hasAny =
    scores != null &&
    LENS_DIMENSIONS.some(
      (dim) =>
        typeof scores[dim] === "number" && !Number.isNaN(scores[dim]),
    );

  return (
    <section
      data-tour="lens-score-explanation"
      aria-label="Lens scoring panel"
      className={cn("flex flex-col gap-3", className)}
    >
      {heading && (
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" data-tour="lens-comparison">
          {heading}
        </h3>
      )}

      {!hasAny ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-2.5" data-tour="lens-dimension-sliders">
          {LENS_DIMENSIONS.map((dim) => (
            <DimRow key={dim} dim={dim} score={scores?.[dim]} />
          ))}
        </div>
      )}
    </section>
  );
}
