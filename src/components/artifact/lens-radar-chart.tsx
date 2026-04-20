"use client";

/**
 * LensRadarChart — 8-spoke SVG radar chart for Lens dimensions.
 *
 * Dimensions (8 total):
 *   Numeric (0–10): novelty, clarity, significance, originality, rigor, utility
 *   Categorical mapped to 0/5/10:
 *     verification_status: unverified=0, partial=5, verified=10
 *     fidelity:            speculative=0, contested=5, established=10
 *
 * Features:
 *   - Hoverable spoke labels / data points showing lens_rationale_jsonb rationale
 *   - Tooltip rendered via HTML overlay (absolute positioned)
 *   - Empty state: "No assessment yet" + optional CTA to open AssessmentModal
 *   - All dimensions null → empty state
 *
 * Implementation: pure SVG + CSS — no external chart library.
 *
 * WCAG 2.1 AA:
 *   - aria-label on the SVG element
 *   - Data polygon described in a visually-hidden summary table
 *   - Tooltips associated via aria-describedby
 *
 * Portal v1.5 Phase 1 (P1.5-1-04).
 * Traces FR-1.5-03.
 */

import { useState, useCallback, useId } from "react";
import { cn } from "@/lib/utils";
import type {
  ArtifactMetadataResponse,
  LensRationaleMap,
} from "@/types/artifact";

// ---------------------------------------------------------------------------
// Dimension definitions
// ---------------------------------------------------------------------------

type DimKey =
  | "novelty"
  | "clarity"
  | "significance"
  | "originality"
  | "rigor"
  | "utility"
  | "verification_status"
  | "fidelity";

const DIMS: DimKey[] = [
  "novelty",
  "clarity",
  "significance",
  "originality",
  "rigor",
  "utility",
  "verification_status",
  "fidelity",
];

const DIM_LABELS: Record<DimKey, string> = {
  novelty: "Novelty",
  clarity: "Clarity",
  significance: "Significance",
  originality: "Originality",
  rigor: "Rigor",
  utility: "Utility",
  verification_status: "Verification",
  fidelity: "Fidelity",
};

// ---------------------------------------------------------------------------
// Categorical → numeric mapping
// ---------------------------------------------------------------------------

const VERIFICATION_SCORES: Record<string, number> = {
  unverified: 0,
  partial: 5,
  verified: 10,
};

const FIDELITY_SCORES: Record<string, number> = {
  speculative: 0,
  contested: 5,
  established: 10,
};

function scoreFor(
  dim: DimKey,
  metadata: ArtifactMetadataResponse | null | undefined,
): number | null {
  if (!metadata) return null;

  switch (dim) {
    case "novelty":
      return metadata.novelty ?? null;
    case "clarity":
      return metadata.clarity ?? null;
    case "significance":
      return metadata.significance ?? null;
    case "originality":
      return metadata.originality ?? null;
    case "rigor":
      return metadata.rigor ?? null;
    case "utility":
      return metadata.utility ?? null;
    case "verification_status": {
      const v = metadata.verification_status;
      if (!v) return null;
      return VERIFICATION_SCORES[v] ?? null;
    }
    case "fidelity": {
      const f = metadata.fidelity_level;
      if (!f) return null;
      return FIDELITY_SCORES[f] ?? null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// SVG geometry helpers
// ---------------------------------------------------------------------------

const CENTER = 110;
const MAX_RADIUS = 85;
const NUM_RINGS = 5; // concentric ring count (each ring = 2 units)

/** Polar to Cartesian, angle 0 at top, clockwise. */
function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/** Build a closed polygon path string for a set of (angle, fraction) pairs. */
function buildPolygon(
  cx: number,
  cy: number,
  maxR: number,
  fractions: number[],
  totalDims: number,
): string {
  const pts = fractions.map((f, i) => {
    const angle = (360 / totalDims) * i;
    const [x, y] = polarToCartesian(cx, cy, maxR * f, angle);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return `M ${pts.join(" L ")} Z`;
}

// ---------------------------------------------------------------------------
// Tooltip component
// ---------------------------------------------------------------------------

interface TooltipState {
  dim: DimKey;
  score: number | null;
  rationale: string | null;
  x: number;
  y: number;
}

interface RadarTooltipProps {
  state: TooltipState | null;
  id: string;
}

function RadarTooltip({ state, id }: RadarTooltipProps) {
  if (!state) return null;

  const scoreLabel =
    state.score !== null
      ? `${state.score}/10`
      : "not assessed";

  return (
    <div
      id={id}
      role="tooltip"
      className={cn(
        "pointer-events-none absolute z-10 rounded-md border bg-popover px-3 py-2 text-xs shadow-md",
        "max-w-[14rem] break-words",
      )}
      style={{ left: state.x, top: state.y, transform: "translate(-50%, -110%)" }}
    >
      <p className="font-semibold text-popover-foreground">
        {DIM_LABELS[state.dim]}
      </p>
      <p className="text-muted-foreground">{scoreLabel}</p>
      {state.rationale && (
        <p className="mt-1 text-popover-foreground/80">{state.rationale}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  onAssess?: () => void;
}

function EmptyState({ onAssess }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-10 text-center"
      data-testid="lens-radar-empty"
    >
      <div
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 bg-muted/40"
      >
        <svg
          className="size-6 text-muted-foreground/50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No assessment yet</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Lens dimensions have not been scored for this artifact.
        </p>
      </div>
      {onAssess && (
        <button
          type="button"
          onClick={onAssess}
          className={cn(
            "mt-1 inline-flex h-8 items-center rounded-md px-3 text-xs font-medium",
            "border border-input bg-background text-foreground",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Start assessment
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LensRadarChartProps {
  /**
   * The ArtifactMetadataResponse from the backend PATCH /lens endpoint
   * (or loaded from the artifact detail). Pass null/undefined to show
   * the empty state.
   */
  metadata?: ArtifactMetadataResponse | null;
  /**
   * Called when the user clicks "Start assessment" in the empty state.
   * When omitted, the CTA button is not rendered.
   */
  onAssess?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LensRadarChart({
  metadata,
  onAssess,
  className,
}: LensRadarChartProps) {
  const chartId = useId();
  const tooltipId = `${chartId}-tooltip`;

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Derive scores and check if ALL are null (empty state)
  const scores = DIMS.map((dim) => scoreFor(dim, metadata));
  const allNull = scores.every((s) => s === null);

  const handleMouseEnter = useCallback(
    (
      e: React.MouseEvent<SVGElement>,
      dim: DimKey,
      score: number | null,
      rationale: LensRationaleMap | null | undefined,
    ) => {
      const rect = (e.currentTarget.closest("svg") as SVGSVGElement)
        .getBoundingClientRect();
      const ptX = e.clientX - rect.left;
      const ptY = e.clientY - rect.top;

      setTooltip({
        dim,
        score,
        rationale: rationale?.[dim]?.rationale ?? null,
        x: ptX,
        y: ptY,
      });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  if (allNull) {
    return <EmptyState onAssess={onAssess} />;
  }

  const fractions = scores.map((s) => (s !== null ? s / 10 : 0));
  const numDims = DIMS.length;
  const polygonPath = buildPolygon(CENTER, CENTER, MAX_RADIUS, fractions, numDims);
  const rationale = metadata?.lens_rationale_jsonb;

  return (
    <div className={cn("relative flex flex-col items-center gap-3", className)}>
      {/* Accessible data table (visually hidden) */}
      <table className="sr-only">
        <caption>Lens dimension scores</caption>
        <thead>
          <tr>
            <th scope="col">Dimension</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {DIMS.map((dim, i) => (
            <tr key={dim}>
              <th scope="row">{DIM_LABELS[dim]}</th>
              <td>{scores[i] !== null ? `${scores[i]}/10` : "not assessed"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* SVG chart */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${CENTER * 2} ${CENTER * 2}`}
          aria-label="Lens radar chart showing 8 dimension scores"
          aria-describedby={tooltip ? tooltipId : undefined}
          className="h-[220px] w-[220px]"
        >
          {/* Concentric rings */}
          {Array.from({ length: NUM_RINGS }, (_, ring) => {
            const r = (MAX_RADIUS / NUM_RINGS) * (ring + 1);
            const pts = DIMS.map((_, i) => {
              const angle = (360 / numDims) * i;
              const [x, y] = polarToCartesian(CENTER, CENTER, r, angle);
              return `${x.toFixed(2)},${y.toFixed(2)}`;
            });
            return (
              <polygon
                key={ring}
                points={pts.join(" ")}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeWidth={1}
              />
            );
          })}

          {/* Spoke lines */}
          {DIMS.map((_, i) => {
            const angle = (360 / numDims) * i;
            const [x, y] = polarToCartesian(CENTER, CENTER, MAX_RADIUS, angle);
            return (
              <line
                key={i}
                x1={CENTER}
                y1={CENTER}
                x2={x}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.12}
                strokeWidth={1}
              />
            );
          })}

          {/* Data polygon */}
          <path
            d={polygonPath}
            fill="hsl(var(--primary) / 0.15)"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />

          {/* Data points + hover targets */}
          {DIMS.map((dim, i) => {
            const angle = (360 / numDims) * i;
            const f = fractions[i];
            const [px, py] = polarToCartesian(CENTER, CENTER, MAX_RADIUS * f, angle);
            const score = scores[i];
            const isAssessed = score !== null;

            return (
              <circle
                key={dim}
                cx={px}
                cy={py}
                r={isAssessed ? 4.5 : 2.5}
                fill={isAssessed ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                strokeWidth={1.5}
                stroke="hsl(var(--card))"
                className="cursor-pointer transition-opacity hover:opacity-80"
                role="img"
                aria-label={`${DIM_LABELS[dim]}: ${score !== null ? `${score}/10` : "not assessed"}`}
                onMouseEnter={(e) => handleMouseEnter(e, dim, score, rationale)}
                onMouseLeave={handleMouseLeave}
                onFocus={(e) => {
                  setTooltip({
                    dim,
                    score,
                    rationale: rationale?.[dim]?.rationale ?? null,
                    x: parseFloat(e.currentTarget.getAttribute("cx") ?? "0"),
                    y: parseFloat(e.currentTarget.getAttribute("cy") ?? "0"),
                  });
                }}
                onBlur={handleMouseLeave}
                tabIndex={0}
              />
            );
          })}

          {/* Spoke labels */}
          {DIMS.map((dim, i) => {
            const angle = (360 / numDims) * i;
            const labelR = MAX_RADIUS + 16;
            const [lx, ly] = polarToCartesian(CENTER, CENTER, labelR, angle);

            // Anchor based on horizontal position
            let textAnchor: "start" | "middle" | "end" = "middle";
            const dx = lx - CENTER;
            if (dx > 5) textAnchor = "start";
            else if (dx < -5) textAnchor = "end";

            return (
              <text
                key={dim}
                x={lx}
                y={ly}
                textAnchor={textAnchor}
                dominantBaseline="central"
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.65}
                className="select-none"
                aria-hidden="true"
              >
                {DIM_LABELS[dim]}
              </text>
            );
          })}
        </svg>

        {/* Tooltip overlay */}
        <RadarTooltip state={tooltip} id={tooltipId} />
      </div>
    </div>
  );
}
