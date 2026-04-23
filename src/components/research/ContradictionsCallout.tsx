/**
 * ContradictionsCallout — rose-tinted callout card with skeleton count placeholder.
 *
 * Displayed in the Research Home editorial layout to surface contradiction signals.
 * Rose-tinted surface tokens: bg-rose-50 / dark:bg-rose-950/20.
 *
 * P6-03: Research Home editorial scaffold (APIs deferred to v1.6 per OQ-2).
 *
 * TODO v1.6: wire GET /api/research/evidence-pulse/contradictions to populate
 * the real contradiction count and item list.
 */

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shimmer primitive
// ---------------------------------------------------------------------------

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-rose-200/60 dark:bg-rose-800/30", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// ContradictionsCallout
// ---------------------------------------------------------------------------

export interface ContradictionsCalloutProps {
  className?: string;
}

/**
 * Rose-tinted callout card for contradiction signals.
 * All content is skeleton until GET /api/research/evidence-pulse/contradictions ships.
 */
export function ContradictionsCallout({ className }: ContradictionsCalloutProps) {
  return (
    <section
      aria-labelledby="contradictions-heading"
      className={cn(
        "rounded-lg border border-rose-200 dark:border-rose-800/50",
        "bg-rose-50 dark:bg-rose-950/20",
        "p-4",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle
          aria-hidden="true"
          className="size-4 shrink-0 text-rose-500 dark:text-rose-400"
        />
        <h2
          id="contradictions-heading"
          className="text-sm font-semibold text-rose-900 dark:text-rose-200"
        >
          Contradictions
        </h2>
        <span
          className="rounded-sm bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 dark:bg-rose-900/40 dark:text-rose-400"
          role="note"
          aria-label="Requires v1.6 API"
        >
          v1.6
        </span>
      </div>

      {/*
       * TODO v1.6: Replace skeleton with real contradiction count and items from
       * GET /api/research/evidence-pulse/contradictions.
       * Shape: { count: number; items: Array<{ id, title, entities, detected_at }> }
       */}
      <div
        aria-busy="true"
        aria-label="Contradictions count loading"
        className="flex flex-col gap-2"
      >
        {/* Count placeholder */}
        <div className="flex items-baseline gap-2">
          <Shimmer className="h-7 w-8" />
          <Shimmer className="h-4 w-32" />
        </div>
        {/* Item rows */}
        <div className="mt-1 flex flex-col gap-2">
          <Shimmer className="h-3.5 w-full" />
          <Shimmer className="h-3.5 w-4/5" />
        </div>
      </div>
    </section>
  );
}
