/**
 * PriorityTopicsGrid — 2×2 skeleton grid of priority topic cards.
 *
 * All cells are skeleton placeholders until the priority-topics API ships.
 * The final cell is an "Add New Entity" slot (dashed border, disabled).
 *
 * P6-03: Research Home editorial scaffold (APIs deferred per OQ-2).
 *
 * TODO: wire GET /api/research/priority-topics to populate real cards.
 */

import { Plus } from "lucide-react";
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
// Skeleton topic card
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
      disabled
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
// PriorityTopicsGrid
// ---------------------------------------------------------------------------

export interface PriorityTopicsGridProps {
  className?: string;
}

/**
 * Renders a 2×2 skeleton grid of priority topic cards with an "Add New Entity"
 * slot. All cards are placeholders until GET /api/research/priority-topics ships.
 */
export function PriorityTopicsGrid({ className }: PriorityTopicsGridProps) {
  return (
    <section aria-labelledby="priority-topics-heading" className={className}>
      <div className="mb-3 flex items-center gap-2">
        <h2
          id="priority-topics-heading"
          className="text-sm font-semibold text-foreground"
        >
          Priority Topics
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
       * TODO: Replace skeletons with real data from Topics API.
       * Replace <SkeletonTopicCard /> with <TopicCard topic={t} /> per item.
       * Replace <AddEntitySlot /> with an interactive entity-creation trigger.
       */}
      <div
        aria-busy="true"
        aria-label="Priority topics loading"
        className={cn(
          // 2-col grid; collapses to 1 below 768px
          "grid grid-cols-1 gap-3 sm:grid-cols-2",
          className,
        )}
      >
        {/* 4 skeleton topic cards (2×2) */}
        <SkeletonTopicCard />
        <SkeletonTopicCard />
        <SkeletonTopicCard />
        {/* Final slot: Add New Entity */}
        <AddEntitySlot />
      </div>
    </section>
  );
}
