/**
 * SynthesisNarrative — skeleton pull-quote + 3-col breakdown.
 *
 * The pull-quote is an italic placeholder. The 3-col breakdown shows
 * skeleton cells for the three synthesis dimension slots.
 *
 * P6-03: Research Home editorial scaffold (APIs deferred per OQ-2).
 *
 * TODO: wire GET /api/research/synthesis-narrative to populate the
 * pull-quote text and the three breakdown columns.
 */

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shimmer primitive
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
// SynthesisNarrative
// ---------------------------------------------------------------------------

export interface SynthesisNarrativeProps {
  className?: string;
}

/**
 * Skeleton pull-quote and 3-column synthesis breakdown.
 * Replace with real synthesis narrative when API ships.
 */
export function SynthesisNarrative({ className }: SynthesisNarrativeProps) {
  return (
    <section aria-labelledby="synthesis-narrative-heading" className={className}>
      <div className="mb-3 flex items-center gap-2">
        <h2
          id="synthesis-narrative-heading"
          className="text-sm font-semibold text-foreground"
        >
          Synthesis Narrative
        </h2>
        <span
          className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          role="note"
          aria-label="Planned feature"
        >
          Planned
        </span>
      </div>

      {/*
       * TODO: Replace skeleton pull-quote with real synthesis narrative text from
       * GET /api/research/synthesis-narrative.
       * Shape: { text: string; sources: string[]; breakdown: Array<{ label, value }> }
       */}

      {/* Pull-quote skeleton */}
      <blockquote
        aria-hidden="true"
        className={cn(
          "mb-4 border-l-4 border-border pl-4",
          "italic text-muted-foreground",
        )}
      >
        <div className="flex flex-col gap-2">
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-5/6" />
          <Shimmer className="h-4 w-3/4" />
        </div>
        <div className="mt-2">
          <Shimmer className="h-3 w-24" />
        </div>
      </blockquote>

      {/* 3-col breakdown skeleton */}
      <div
        aria-busy="true"
        aria-label="Synthesis breakdown loading"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="flex flex-col gap-1.5 rounded-md border bg-card px-3 py-3"
          >
            {/* Column label */}
            <Shimmer className="h-3 w-14" />
            {/* Value */}
            <Shimmer className="h-5 w-10" />
            {/* Sub-label */}
            <Shimmer className="h-3 w-20" />
          </div>
        ))}
      </div>
    </section>
  );
}
