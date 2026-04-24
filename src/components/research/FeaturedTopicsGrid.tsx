"use client";

/**
 * FeaturedTopicsGrid — ranked topic cards for Research Home bento.
 *
 * ADR-DPI-004 DP1-06 #1: Featured Topic Cards grid.
 *
 * Backend aggregate endpoint not yet available.
 *   Missing endpoint: GET /api/research/featured-topics
 *   Expected response:
 *     { data: { items: Array<FeaturedTopic> } }
 *   FeaturedTopic shape:
 *     { id: string; title: string; subtype?: string; article_count: number;
 *       ranking_score: number; updated: string; snippet?: string }
 *   Query params: limit (default 6), topic_id (optional scope filter)
 *
 * While the endpoint is absent the grid renders skeletons. When
 * GET /api/research/featured-topics ships replace `MOCK_LOADING`
 * with a hook call (e.g. useFeaturedTopics) and remove the placeholder.
 *
 * Layout: responsive 2–3 column grid; each card links to /artifact/:id.
 * Cards reuse the portal design token palette (slate base, primary accent).
 *
 * WCAG 2.1 AA: grid role="list"; cards are role="listitem" + focusable link.
 *
 * Stitch reference: Research Home (0cf6fb7b…) — Featured Topic Cards section.
 */

import Link from "next/link";
import { BookOpen, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/components/ui/type-badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeaturedTopic {
  id: string;
  title: string;
  subtype?: string | null;
  article_count: number;
  ranking_score?: number | null;
  updated?: string | null;
  snippet?: string | null;
}

export interface FeaturedTopicsGridProps {
  /** Override data for testing / SSR; when undefined the component self-fetches. */
  topics?: FeaturedTopic[];
  isLoading?: boolean;
  className?: string;
}

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
// Single topic card
// ---------------------------------------------------------------------------

interface TopicCardProps {
  topic: FeaturedTopic;
}

function TopicCard({ topic }: TopicCardProps) {
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
        {topic.ranking_score != null && topic.ranking_score > 0.7 && (
          <span
            aria-label="Trending topic"
            title="High ranking score"
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

      {topic.snippet && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {topic.snippet}
        </p>
      )}

      <div className="mt-auto flex items-center gap-1 text-[11px] text-muted-foreground">
        <BookOpen aria-hidden="true" className="size-3" />
        <span>{topic.article_count} article{topic.article_count !== 1 ? "s" : ""}</span>
      </div>
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
      <p className="text-xs text-muted-foreground">No featured topics yet.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * FeaturedTopicsGrid renders a grid of ranked research topics.
 *
 * While backend endpoint is missing renders skeletons.
 * Pass `topics` prop to override with live or SSR data when endpoint ships.
 */
export function FeaturedTopicsGrid({
  topics,
  isLoading = false,
  className,
}: FeaturedTopicsGridProps) {
  // Backend endpoint missing — always show skeletons until wired
  const endpointMissing = topics === undefined;
  const loading = isLoading || endpointMissing;

  return (
    <section aria-labelledby="featured-topics-heading" className={className}>
      <div className="mb-3 flex items-center gap-2">
        <h2
          id="featured-topics-heading"
          className="text-sm font-semibold text-foreground"
        >
          Featured Topics
        </h2>
        {endpointMissing && (
          <span
            className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            role="note"
          >
            Planned
          </span>
        )}
      </div>

      {endpointMissing && (
        <p className="mb-3 text-[11px] text-muted-foreground" role="note">
          Requires{" "}
          <code className="rounded bg-muted px-1 font-mono text-[10px]">
            GET /api/research/featured-topics
          </code>{" "}
          — coming soon.
        </p>
      )}

      {loading ? (
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
      ) : topics && topics.length === 0 ? (
        <EmptyState />
      ) : (
        <ul
          role="list"
          aria-label="Featured research topics"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {(topics ?? []).map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </ul>
      )}
    </section>
  );
}
