"use client";

/**
 * ContradictionsPanel — Research workspace Contradictions section.
 *
 * Wires GET /api/artifacts/research/contradictions into a paginated list
 * of contradiction pairs with a side-by-side detail view on click.
 *
 * Features:
 *   - Cursor-paginated list of contradiction pairs.
 *   - Each row shows: artifact_a title, "vs" separator, artifact_b title,
 *     shared_topic tag, flagged_at relative date.
 *   - Click on a row → ContradictionDetailModal side-by-side detail view.
 *   - "Load more" button for next page.
 *   - Loading skeletons (4 rows), empty state, error state.
 *
 * WCAG 2.1 AA:
 *   - Section has aria-labelledby pointing to heading.
 *   - List items are keyboard-navigable buttons (Enter/Space to open).
 *   - Each row has a descriptive aria-label.
 *   - "Load more" is disabled + aria-disabled during fetch.
 *   - Colour is never the sole differentiator.
 *
 * Replaces ContradictionsCallout skeleton placeholder (P6-03).
 * Portal v1.6 Phase 7 (P7-02).
 * Endpoint: GET /api/artifacts/research/contradictions
 */

import { useState, useCallback } from "react";
import { AlertTriangle, ChevronDown, Tag, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContradictions } from "@/hooks/useContradictions";
import { ContradictionDetailModal } from "./ContradictionDetailModal";
import type { ContradictionPair } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format an ISO 8601 date string as a short relative time label.
 * Mirrors the same helper in StaleArtifactsPanel and ContradictionDetailModal.
 */
function formatRelativeDate(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-rose-200/60 dark:bg-rose-800/30", className)}
    />
  );
}

function SkeletonRow() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-1.5 py-2.5">
      <div className="flex items-center gap-1.5">
        <Shimmer className="h-3.5 w-2/5" />
        <Shimmer className="h-3 w-4" />
        <Shimmer className="h-3.5 w-2/5" />
      </div>
      <div className="flex items-center gap-2">
        <Shimmer className="h-3 w-14 rounded-full" />
        <Shimmer className="h-3 w-12" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contradiction row
// ---------------------------------------------------------------------------

interface ContradictionRowProps {
  pair: ContradictionPair;
  onClick: (pair: ContradictionPair) => void;
}

function ContradictionRow({ pair, onClick }: ContradictionRowProps) {
  const handleClick = useCallback(() => onClick(pair), [onClick, pair]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick(pair);
      }
    },
    [onClick, pair],
  );

  const rowLabel = `Contradiction: ${pair.artifact_a.title} vs ${pair.artifact_b.title}, topic ${pair.shared_topic}, flagged ${formatRelativeDate(pair.flagged_at)}`;

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={rowLabel}
        className={cn(
          "w-full rounded-md px-2 py-2.5 text-left",
          "hover:bg-rose-100/60 dark:hover:bg-rose-900/20",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-1",
          "transition-colors",
          "group",
        )}
      >
        {/* Artifact titles row */}
        <div className="flex min-w-0 items-baseline gap-1.5 text-xs">
          <span className="min-w-0 flex-1 truncate font-medium text-foreground group-hover:text-rose-700 dark:group-hover:text-rose-300">
            {pair.artifact_a.title}
          </span>
          <span
            aria-hidden="true"
            className="shrink-0 text-[10px] font-bold text-rose-400 dark:text-rose-600"
          >
            vs
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-foreground group-hover:text-rose-700 dark:group-hover:text-rose-300 text-right">
            {pair.artifact_b.title}
          </span>
        </div>

        {/* Meta row */}
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          {/* Topic tag */}
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-rose-100/80 px-1 py-0.5 dark:bg-rose-900/30">
            <Tag aria-hidden="true" className="size-2.5 shrink-0 text-rose-500" />
            <span className="truncate max-w-[8rem]">{pair.shared_topic}</span>
          </span>

          {/* Date */}
          <time
            dateTime={pair.flagged_at}
            className="ml-auto shrink-0 tabular-nums"
          >
            {formatRelativeDate(pair.flagged_at)}
          </time>
        </div>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// ContradictionsPanel
// ---------------------------------------------------------------------------

export interface ContradictionsPanelProps {
  className?: string;
}

/**
 * Wires GET /api/artifacts/research/contradictions into a live, paginated
 * contradiction pairs list with a side-by-side detail modal on click.
 *
 * Replaces the ContradictionsCallout skeleton placeholder from P6-03.
 */
export function ContradictionsPanel({ className }: ContradictionsPanelProps) {
  const {
    pairs,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
  } = useContradictions();

  const [selectedPair, setSelectedPair] = useState<ContradictionPair | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleRowClick = useCallback((pair: ContradictionPair) => {
    setSelectedPair(pair);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  const renderContent = () => {
    // Loading state
    if (isLoading) {
      return (
        <div aria-busy="true" aria-label="Contradictions loading">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      );
    }

    // Error state
    if (isError) {
      return (
        <div
          role="alert"
          className="flex flex-col gap-1 py-2 text-xs text-muted-foreground"
        >
          <span className="font-medium text-destructive">Failed to load contradictions.</span>
          {error?.message && (
            <span className="text-[10px] opacity-70">{error.message}</span>
          )}
        </div>
      );
    }

    // Empty state
    if (pairs.length === 0) {
      return (
        <div
          role="status"
          aria-label="No contradictions detected"
          className="py-4 text-center text-xs text-muted-foreground"
        >
          <p>No contradictions detected.</p>
          <p className="mt-0.5 text-[10px] opacity-70">
            Contradictions are flagged during the compilation workflow.
          </p>
        </div>
      );
    }

    // Populated list
    return (
      <>
        <ul
          aria-label={`Contradiction pairs — ${pairs.length} shown`}
          className="divide-y divide-rose-100 dark:divide-rose-900/20"
        >
          {pairs.map((pair) => (
            <ContradictionRow key={pair.id} pair={pair} onClick={handleRowClick} />
          ))}
        </ul>

        {/* Load more */}
        {hasNextPage && (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              aria-disabled={isFetchingNextPage}
              aria-label={isFetchingNextPage ? "Loading more contradictions" : "Load more contradictions"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-1",
                "transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <ChevronDown aria-hidden="true" className="size-3" />
                  Load more
                </>
              )}
            </button>
          </div>
        )}
      </>
    );
  };

  // ---------------------------------------------------------------------------
  // Panel shell
  // ---------------------------------------------------------------------------

  return (
    <>
      <section
        aria-labelledby="contradictions-panel-heading"
        className={cn(
          "rounded-lg border border-rose-200 dark:border-rose-800/50",
          "bg-rose-50 dark:bg-rose-950/20",
          "p-4",
          className,
        )}
      >
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle
            aria-hidden="true"
            className="size-4 shrink-0 text-rose-500 dark:text-rose-400"
          />
          <h2
            id="contradictions-panel-heading"
            className="text-sm font-semibold text-rose-900 dark:text-rose-200"
          >
            Contradictions
          </h2>
          {/* Count badge — visible once loaded */}
          {!isLoading && !isError && pairs.length > 0 && (
            <span
              className="ml-auto rounded-full bg-rose-200 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-rose-700 dark:bg-rose-900/50 dark:text-rose-400"
              aria-label={`${pairs.length} contradiction pairs`}
            >
              {pairs.length}
            </span>
          )}
        </div>

        {/* Content */}
        {renderContent()}
      </section>

      {/* Detail modal — mounted outside the section to avoid z-index stacking */}
      <ContradictionDetailModal
        pair={selectedPair}
        open={modalOpen}
        onClose={handleModalClose}
      />
    </>
  );
}
