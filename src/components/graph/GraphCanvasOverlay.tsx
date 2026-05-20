"use client";

/**
 * GraphCanvasOverlay — absolutely-positioned overlay states for the graph canvas.
 *
 * Renders inside the SigmaContainer wrapper div (position: relative) and covers
 * the full canvas area with an appropriate state indicator.
 *
 * State priority (mutually exclusive, highest wins):
 *   1. error   — fetch error or WebGL context loss
 *   2. empty   — zero nodes after filters applied (hasActiveFilters must be true
 *                for the "no match" empty state; without filters it stays silent)
 *   3. loading — initial load OR filter-driven refetch (isFetching)
 *   4. none    — overlay not rendered
 *
 * Props:
 *   loading          — true while isLoading || isFetchingMore (initial or refetch)
 *   error            — Error object if useVaultGraph returned isError, else null
 *   nodeCount        — accNodes.length from useVaultGraph
 *   hasActiveFilters — true when any filter dim deviates from its default
 *   onClearAll       — resets all filter state to GRAPH_FILTERS_DEFAULT
 *
 * v2.2 — graph canvas overlay states (P3-08).
 */

import { Network, AlertTriangle, FilterX } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GraphCanvasOverlayProps {
  /** True when the initial fetch OR a filter-driven refetch is in progress. */
  loading: boolean;
  /** Non-null when useVaultGraph returned isError. */
  error: Error | null;
  /** Number of nodes in the accumulated display set. */
  nodeCount: number;
  /** True when at least one filter dim deviates from GRAPH_FILTERS_DEFAULT. */
  hasActiveFilters: boolean;
  /** Callback to reset all filters to defaults. */
  onClearAll: () => void;
}

// ---------------------------------------------------------------------------
// Sub-states
// ---------------------------------------------------------------------------

function LoadingOverlay() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading graph"
      role="status"
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center gap-3",
        "rounded-[inherit] bg-background/60 backdrop-blur-[2px]",
        "animate-in fade-in duration-200",
      )}
    >
      {/* Pulsing node cluster animation */}
      <div className="relative size-12">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
        <div className="absolute inset-2 rounded-full bg-primary/20 animate-pulse" />
        <Network
          aria-hidden="true"
          className="absolute inset-0 m-auto size-5 text-muted-foreground/50"
        />
      </div>
      <p className="text-xs text-muted-foreground animate-pulse">Loading graph…</p>
    </div>
  );
}

interface EmptyOverlayProps {
  onClearAll: () => void;
}

function EmptyOverlay({ onClearAll }: EmptyOverlayProps) {
  return (
    <div
      role="status"
      aria-label="No nodes match the active filters"
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center gap-4",
        "rounded-[inherit] bg-background/80 backdrop-blur-[2px]",
        "animate-in fade-in duration-200",
      )}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-muted bg-muted/40">
          <FilterX aria-hidden="true" className="size-5 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium text-foreground">
          No nodes match these filters
        </p>
        <p className="max-w-[220px] text-xs text-muted-foreground">
          Try relaxing your filters to see more of the vault graph.
        </p>
      </div>

      <button
        type="button"
        onClick={onClearAll}
        aria-label="Clear all active graph filters"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium",
          "border-input bg-background text-foreground",
          "transition-colors hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <FilterX aria-hidden="true" className="size-3" />
        Clear all filters
      </button>
    </div>
  );
}

interface ErrorOverlayProps {
  error: Error;
}

function ErrorOverlay({ error }: ErrorOverlayProps) {
  return (
    <div
      role="alert"
      aria-label={`Graph error: ${error.message}`}
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center gap-3",
        "rounded-[inherit] bg-background/80 backdrop-blur-[2px]",
        "animate-in fade-in duration-200",
      )}
    >
      <AlertTriangle aria-hidden="true" className="size-8 text-destructive/60" />
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          Graph failed to load
        </p>
        <p className="mt-0.5 max-w-[240px] text-xs text-muted-foreground">
          {error.message}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GraphCanvasOverlay — main export
// ---------------------------------------------------------------------------

export function GraphCanvasOverlay({
  loading,
  error,
  nodeCount,
  hasActiveFilters,
  onClearAll,
}: GraphCanvasOverlayProps) {
  // Priority: error > empty (post-filter) > loading > nothing
  if (error) {
    return <ErrorOverlay error={error} />;
  }

  if (!loading && nodeCount === 0 && hasActiveFilters) {
    return <EmptyOverlay onClearAll={onClearAll} />;
  }

  if (loading) {
    return <LoadingOverlay />;
  }

  return null;
}
