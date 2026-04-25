"use client";

/**
 * ContradictionsCallout — rose-tinted callout card surfacing contradiction signals.
 *
 * Displays in the Research Home editorial layout. Shows contradiction pair count
 * in a badge and a short list of the most recent pairs (first page, up to 5 items).
 *
 * Uses TanStack Query (`useQuery`) — a single non-paginated fetch is sufficient
 * for a compact callout. Full paginated view lives in ContradictionsPanel (P7-02).
 *
 * Endpoint: GET /api/artifacts/research/contradictions
 * API helper: fetchContradictions() from src/lib/api/research.ts (added in P3-01)
 *
 * States:
 *   loading  → existing Shimmer skeleton (aria-busy)
 *   error    → inline "Unable to load contradictions" message (role="alert")
 *   empty    → "No contradictions detected" status message (role="status")
 *   success  → badge count + item list
 *
 * WCAG 2.1 AA:
 *   - Section labelled via aria-labelledby.
 *   - Loading region uses aria-busy + aria-label.
 *   - Error region uses role="alert".
 *   - Empty region uses role="status".
 *   - Badge count exposed via aria-label.
 *   - Colour is never the sole differentiator.
 *
 * Portal v1.7 Phase 3 (P3-02).
 * DO NOT modify ContradictionsPanel.tsx or useContradictions.ts.
 */

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchContradictions } from "@/lib/api/research";
import type { ContradictionPair } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max items shown in the compact callout. */
const CALLOUT_ITEM_LIMIT = 5;

// ---------------------------------------------------------------------------
// Shimmer primitive (kept from original skeleton)
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
// Sub-components
// ---------------------------------------------------------------------------

/** Skeleton shown while the fetch is in-flight. */
function LoadingSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Contradictions loading"
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
  );
}

/** Single contradiction item row. */
function ContradictionItem({ pair }: { pair: ContradictionPair }) {
  return (
    <li className="flex min-w-0 items-baseline gap-1 text-xs text-foreground">
      <span className="min-w-0 flex-1 truncate">{pair.artifact_a.title}</span>
      <span
        aria-hidden="true"
        className="shrink-0 text-[10px] font-bold text-rose-400 dark:text-rose-600"
      >
        vs
      </span>
      <span className="min-w-0 flex-1 truncate text-right">{pair.artifact_b.title}</span>
    </li>
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
 * Wires GET /api/artifacts/research/contradictions via fetchContradictions().
 */
export function ContradictionsCallout({ className }: ContradictionsCalloutProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["research", "contradictions-callout"],
    queryFn: () => fetchContradictions({ limit: CALLOUT_ITEM_LIMIT }),
  });

  const pairs: ContradictionPair[] = data?.data ?? [];
  const count = pairs.length;

  // ---------------------------------------------------------------------------
  // Content region
  // ---------------------------------------------------------------------------

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSkeleton />;
    }

    if (isError) {
      return (
        <div
          role="alert"
          className="text-xs text-muted-foreground"
        >
          <span className="font-medium text-destructive">Unable to load contradictions.</span>
        </div>
      );
    }

    if (count === 0) {
      return (
        <div
          role="status"
          aria-label="No contradictions detected"
          className="py-2 text-xs text-muted-foreground"
        >
          No contradictions detected.
        </div>
      );
    }

    return (
      <ul
        aria-label={`${count} contradiction ${count === 1 ? "pair" : "pairs"}`}
        className="flex flex-col gap-1"
      >
        {pairs.map((pair) => (
          <ContradictionItem key={pair.id} pair={pair} />
        ))}
      </ul>
    );
  };

  // ---------------------------------------------------------------------------
  // Shell
  // ---------------------------------------------------------------------------

  return (
    <section
      aria-labelledby="contradictions-callout-heading"
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
          id="contradictions-callout-heading"
          className="text-sm font-semibold text-rose-900 dark:text-rose-200"
        >
          Contradictions
        </h2>

        {/* Count badge — visible only when data is loaded and non-empty */}
        {!isLoading && !isError && count > 0 && (
          <span
            className="ml-auto rounded-full bg-rose-200 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-rose-700 dark:bg-rose-900/50 dark:text-rose-400"
            aria-label={`${count} contradiction ${count === 1 ? "pair" : "pairs"}`}
          >
            {count}
          </span>
        )}
      </div>

      {renderContent()}
    </section>
  );
}
