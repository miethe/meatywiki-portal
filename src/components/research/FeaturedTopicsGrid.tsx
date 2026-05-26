"use client";

/**
 * FeaturedTopicsGrid — ranked topic cards for Research Home bento.
 *
 * ADR-DPI-004 DP1-06 #1: Featured Topic Cards grid.
 *
 * Wires GET /api/research/featured-topics via useFeaturedTopics hook.
 * Each card shows an activity bar proportional to the topic's activity_score
 * relative to the maximum score in the returned list.
 *
 * Layout: responsive 2–3 column grid; each card links to /artifact/:id.
 * Cards reuse the portal design token palette (slate base, primary accent).
 *
 * WCAG 2.1 AA: grid role="list"; cards are role="listitem" + focusable link.
 * Activity bar has aria-label with numeric value; colour is not the sole
 * differentiator (score printed in text alongside the bar).
 *
 * Stitch reference: Research Home (0cf6fb7b…) — Featured Topic Cards section.
 *
 * Portal v1.7 Phase 4 (P4-04).
 */

import Link from "next/link";
import { BookOpen, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/components/ui/type-badge";
import { useFeaturedTopics } from "@/hooks/useFeaturedTopics";
import type { FeaturedTopicItem } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="flex animate-pulse flex-col gap-2 rounded-lg border bg-card p-4"
    >
      <div className="flex items-center gap-2">
        <div className="h-4 w-14 rounded-sm bg-muted" />
        <div className="h-4 w-4 rounded-full bg-muted" />
      </div>
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-3 w-full rounded bg-muted" />
      <div className="h-3 w-2/3 rounded bg-muted" />
      <div className="mt-1 flex items-center gap-2">
        <div className="h-3 w-16 rounded bg-muted" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity score bar
// ---------------------------------------------------------------------------

interface ActivityBarProps {
  score: number;
  /** 0–1 proportion of the bar to fill. */
  proportion: number;
}

function ActivityBar({ score, proportion }: ActivityBarProps) {
  const pct = Math.round(proportion * 100);
  return (
    <div className="mt-auto flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Activity</span>
        <span className="tabular-nums">{score}</span>
      </div>
      <div
        role="meter"
        aria-label={`Activity score: ${score}`}
        aria-valuenow={score}
        aria-valuemin={0}
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          aria-hidden="true"
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single topic card
// ---------------------------------------------------------------------------

interface TopicCardProps {
  topic: FeaturedTopicItem;
  /** Proportion (0–1) of the activity bar to fill relative to list max. */
  proportion: number;
}

function TopicCard({ topic, proportion }: TopicCardProps) {
  return (
    <li
      role="listitem"
      className={cn(
        "group flex flex-col gap-2 rounded-lg border bg-card p-4 transition-shadow",
        "hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {topic.subtype && <TypeBadge type={topic.subtype} />}
        {topic.activity_score > 0 && (
          <span
            aria-label="Trending topic"
            title="Recently active topic"
            className="ml-auto inline-flex items-center gap-1 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          >
            <TrendingUp aria-hidden="true" className="size-2.5" />
            Trending
          </span>
        )}
      </div>

      <Link
        href={`/artifact/${topic.id}`}
        className={cn(
          "line-clamp-2 text-sm font-semibold leading-snug text-foreground",
          "group-hover:underline underline-offset-2",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
        )}
      >
        {topic.title}
      </Link>

      <ActivityBar score={topic.activity_score} proportion={proportion} />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-10 text-center"
    >
      <BookOpen aria-hidden="true" className="size-6 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">No featured topics.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface FeaturedTopicsGridProps {
  className?: string;
}

/**
 * FeaturedTopicsGrid self-fetches from GET /api/research/featured-topics via
 * useFeaturedTopics. Shows loading skeletons, an error alert, an empty state,
 * or a live grid of topic cards with relative activity bars.
 */
export function FeaturedTopicsGrid({ className }: FeaturedTopicsGridProps) {
  const { topics, isLoading, isError, error } = useFeaturedTopics();

  // Compute max score once for proportional bar widths.
  const maxScore =
    topics.length > 0 ? Math.max(...topics.map((t) => t.activity_score)) : 0;

  return (
    <section aria-labelledby="featured-topics-heading" className={className}>
      <div className="mb-3 flex items-center gap-2">
        <h2
          id="featured-topics-heading"
          className="text-sm font-semibold text-foreground"
        >
          Featured Topics
        </h2>
        {!isLoading && !isError && topics.length > 0 && (
          <span
            className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground"
            aria-label={`${topics.length} featured topics`}
          >
            {topics.length}
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <ul
          role="list"
          aria-busy="true"
          aria-label="Featured topics loading"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </ul>
      )}

      {/* Error */}
      {!isLoading && isError && (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-muted-foreground"
        >
          <span className="font-medium text-destructive">
            Failed to load featured topics.
          </span>
          {error?.message && (
            <span className="text-[10px] opacity-70">{error.message}</span>
          )}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && topics.length === 0 && <EmptyState />}

      {/* Populated grid */}
      {!isLoading && !isError && topics.length > 0 && (
        <ul
          role="list"
          aria-label="Featured research topics"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {topics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              proportion={maxScore > 0 ? topic.activity_score / maxScore : 0}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
