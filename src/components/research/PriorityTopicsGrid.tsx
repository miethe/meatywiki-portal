"use client";

/**
 * PriorityTopicsGrid — Research workspace Priority Topics section.
 *
 * Wires GET /api/research/priority-topics into a 2-column card grid.
 * Each card displays the topic title, a colour-coded priority_score badge,
 * and inline derivative_count / stale_count stats.
 *
 * Priority score badge colours (WCAG 2.1 AA — text + background both coded):
 *   green  0.70–1.00  (High)
 *   yellow 0.40–0.69  (Medium)
 *   red    0.00–0.39  (Low)
 *
 * Colour is never the sole differentiator: the badge always carries a text
 * label ("High", "Med", "Low") alongside the score.
 *
 * Replaces the all-skeleton placeholder introduced in P6-03.
 * Portal v1.7 Phase 4 (P4-03).
 * Endpoint: GET /api/research/priority-topics
 */

import { Plus, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePriorityTopics } from "@/hooks/usePriorityTopics";
import type { PriorityTopicItem } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PriorityBand = "high" | "medium" | "low";

function getPriorityBand(score: number): PriorityBand {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

const BAND_STYLES: Record<
  PriorityBand,
  { label: string; badge: string; border: string }
> = {
  high: {
    label: "High",
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800/50",
  },
  medium: {
    label: "Med",
    badge:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800/50",
  },
  low: {
    label: "Low",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800/50",
  },
};

// ---------------------------------------------------------------------------
// Shimmer primitive (preserved from original skeleton)
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
// Skeleton topic card (unchanged from P6-03)
// ---------------------------------------------------------------------------

function SkeletonTopicCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4",
        className,
      )}
    >
      {/* Status pill skeleton */}
      <div className="flex items-center gap-2">
        <Shimmer className="h-4 w-16 rounded-full" />
        <Shimmer className="h-3 w-10" />
      </div>
      {/* Title skeleton */}
      <Shimmer className="h-5 w-3/4" />
      {/* Edge labels skeleton */}
      <div className="flex gap-1.5">
        <Shimmer className="h-3 w-14" />
        <Shimmer className="h-3 w-10" />
        <Shimmer className="h-3 w-12" />
      </div>
      {/* Metadata row skeleton */}
      <div className="mt-auto flex items-center justify-between pt-1">
        <Shimmer className="h-3 w-20" />
        <Shimmer className="h-3 w-12" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add New Entity slot
// ---------------------------------------------------------------------------

function AddEntitySlot() {
  return (
    <button
      type="button"
      aria-label="Add new entity (planned feature)"
      aria-disabled="true"
      title="Entity creation — planned feature"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed",
        "bg-transparent p-4 text-muted-foreground/50",
        "cursor-default opacity-60",
        "focus:outline-none",
      )}
    >
      <Plus aria-hidden="true" className="size-6" />
      <span className="text-xs font-medium">Add New Entity</span>
      <span className="text-[10px] opacity-70">Soon</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Live topic card
// ---------------------------------------------------------------------------

interface TopicCardProps {
  topic: PriorityTopicItem;
}

function TopicCard({ topic }: TopicCardProps) {
  const band = getPriorityBand(topic.priority_score);
  const styles = BAND_STYLES[band];
  const scoreDisplay = topic.priority_score.toFixed(2);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4",
        styles.border,
      )}
      aria-label={`${topic.title}, priority ${styles.label} (${scoreDisplay})`}
    >
      {/* Priority badge + score */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            styles.badge,
          )}
          aria-label={`Priority: ${styles.label}`}
        >
          {styles.label}
        </span>
        <span
          className="text-[11px] tabular-nums text-muted-foreground"
          aria-label={`Score ${scoreDisplay}`}
        >
          {scoreDisplay}
        </span>
      </div>

      {/* Title */}
      <p className="truncate text-sm font-medium text-foreground" title={topic.title}>
        {topic.title}
      </p>

      {/* Derivative count + stale count */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1"
          aria-label={`${topic.derivative_count} derivative${topic.derivative_count !== 1 ? "s" : ""}`}
        >
          <TrendingUp aria-hidden="true" className="size-3 shrink-0" />
          {topic.derivative_count}
          <span className="sr-only">derivatives</span>
        </span>

        {topic.stale_count > 0 && (
          <span
            className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
            aria-label={`${topic.stale_count} stale`}
          >
            <AlertCircle aria-hidden="true" className="size-3 shrink-0" />
            {topic.stale_count}
            <span className="sr-only">stale</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PriorityTopicsGrid
// ---------------------------------------------------------------------------

export interface PriorityTopicsGridProps {
  className?: string;
}

/**
 * Renders a 2-column grid of priority topic cards populated from
 * GET /api/research/priority-topics. The final slot is an "Add New Entity"
 * button (disabled — planned feature).
 *
 * Loading: 3 skeleton cards + AddEntitySlot.
 * Empty: "No priority topics." message + AddEntitySlot.
 * Error: inline error message.
 * Populated: TopicCard per item + AddEntitySlot appended.
 */
export function PriorityTopicsGrid({ className }: PriorityTopicsGridProps) {
  const { topics, isLoading, isError, error } = usePriorityTopics();

  // ---------------------------------------------------------------------------
  // Grid content
  // ---------------------------------------------------------------------------

  const renderCards = () => {
    // Loading state — preserve original skeleton layout (3 cards + slot)
    if (isLoading) {
      return (
        <>
          <SkeletonTopicCard />
          <SkeletonTopicCard />
          <SkeletonTopicCard />
          <AddEntitySlot />
        </>
      );
    }

    // Error state
    if (isError) {
      return (
        <div
          role="alert"
          className="col-span-2 py-2 text-xs text-destructive"
        >
          <span className="font-medium">Failed to load priority topics.</span>
          {error?.message && (
            <span className="ml-1 opacity-70">{error.message}</span>
          )}
        </div>
      );
    }

    // Empty state
    if (topics.length === 0) {
      return (
        <>
          <div
            role="status"
            aria-label="No priority topics"
            className="col-span-2 py-4 text-center text-xs text-muted-foreground"
          >
            No priority topics.
          </div>
          <AddEntitySlot />
        </>
      );
    }

    // Populated — cards + Add slot at the end
    return (
      <>
        {topics.map((topic) => (
          <TopicCard key={topic.id} topic={topic} />
        ))}
        <AddEntitySlot />
      </>
    );
  };

  // ---------------------------------------------------------------------------
  // Section shell
  // ---------------------------------------------------------------------------

  return (
    <section aria-labelledby="priority-topics-heading" className={className}>
      <div className="mb-3 flex items-center gap-2">
        <h2
          id="priority-topics-heading"
          className="text-sm font-semibold text-foreground"
        >
          Priority Topics
        </h2>
        {/* Count badge — visible once loaded */}
        {!isLoading && !isError && topics.length > 0 && (
          <span
            className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            aria-label={`${topics.length} priority topics`}
          >
            {topics.length}
          </span>
        )}
      </div>

      <div
        aria-busy={isLoading}
        aria-label={isLoading ? "Priority topics loading" : undefined}
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2",
          className,
        )}
      >
        {renderCards()}
      </div>
    </section>
  );
}
