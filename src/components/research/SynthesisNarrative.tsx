"use client";

/**
 * SynthesisNarrative — Research workspace synthesis statistics panel.
 *
 * Wires GET /api/research/synthesis-narrative into a live 3-column
 * breakdown showing:
 *   - total_syntheses count
 *   - coverage_ratio formatted as "X.X%"
 *   - average_source_count as "X.Y sources avg"
 *   - most_active_topic as a chip (links to artifact if id present)
 *   - recent_synthesis title + relative updated_at
 *
 * States:
 *   - Loading: existing shimmer skeletons unchanged
 *   - Empty (total_syntheses === 0): "No syntheses yet."
 *   - Error: "Unable to load synthesis summary."
 *   - Populated: live stat grid + recent synthesis row
 *
 * WCAG 2.1 AA:
 *   - Section labelled via aria-labelledby.
 *   - Loading region has aria-busy + aria-label.
 *   - Stat values are labelled with aria-label on each cell.
 *   - Topic chip link has descriptive aria-label.
 *   - Colour is never the sole differentiator.
 *
 * Replaces P6-03 skeleton. Portal v1.7 Phase 4 (P4-06).
 * Endpoint: GET /api/research/synthesis-narrative
 */

import Link from "next/link";
import { BookOpen, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSynthesisNarrative } from "@/hooks/useSynthesisNarrative";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format an ISO 8601 date string as a short relative time label.
 * Mirrors helpers in ContradictionsPanel and StaleArtifactsPanel.
 */
function formatRelativeDate(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return diffMins <= 1 ? "just now" : `${diffMins} minutes ago`;

  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffHours < 24) return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;

  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

// ---------------------------------------------------------------------------
// Shimmer primitive (loading skeleton)
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
// Stat cell
// ---------------------------------------------------------------------------

interface StatCellProps {
  label: string;
  value: string;
  subLabel?: string;
}

function StatCell({ label, value, subLabel }: StatCellProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded-md border bg-card px-3 py-3"
      aria-label={`${label}: ${value}${subLabel ? `, ${subLabel}` : ""}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums text-foreground">
        {value}
      </span>
      {subLabel && (
        <span className="text-[10px] text-muted-foreground">{subLabel}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SynthesisNarrative
// ---------------------------------------------------------------------------

export interface SynthesisNarrativeProps {
  className?: string;
}

/**
 * Live synthesis narrative statistics panel.
 * Wires useSynthesisNarrative() over GET /api/research/synthesis-narrative.
 */
export function SynthesisNarrative({ className }: SynthesisNarrativeProps) {
  const { narrative, isLoading, isError } = useSynthesisNarrative();

  // ---------------------------------------------------------------------------
  // Loading state — preserve original skeleton unchanged
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <section
        aria-labelledby="synthesis-narrative-heading"
        aria-busy="true"
        aria-label="Synthesis narrative loading"
        className={className}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2
            id="synthesis-narrative-heading"
            className="text-sm font-semibold text-foreground"
          >
            Synthesis Narrative
          </h2>
        </div>

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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="flex flex-col gap-1.5 rounded-md border bg-card px-3 py-3"
            >
              <Shimmer className="h-3 w-14" />
              <Shimmer className="h-5 w-10" />
              <Shimmer className="h-3 w-20" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (isError) {
    return (
      <section
        aria-labelledby="synthesis-narrative-heading"
        className={className}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2
            id="synthesis-narrative-heading"
            className="text-sm font-semibold text-foreground"
          >
            Synthesis Narrative
          </h2>
        </div>
        <div role="alert" className="py-4 text-xs text-muted-foreground">
          <span className="font-medium text-destructive">
            Unable to load synthesis summary.
          </span>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (!narrative || narrative.total_syntheses === 0) {
    return (
      <section
        aria-labelledby="synthesis-narrative-heading"
        className={className}
      >
        <div className="mb-3 flex items-center gap-2">
          <BookOpen
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <h2
            id="synthesis-narrative-heading"
            className="text-sm font-semibold text-foreground"
          >
            Synthesis Narrative
          </h2>
        </div>
        <div
          role="status"
          aria-label="No syntheses available"
          className="py-4 text-center text-xs text-muted-foreground"
        >
          No syntheses yet.
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Populated state
  // ---------------------------------------------------------------------------

  const coveragePct = `${(narrative.coverage_ratio * 100).toFixed(1)}%`;
  const avgSources = `${narrative.average_source_count.toFixed(1)}`;

  return (
    <section
      aria-labelledby="synthesis-narrative-heading"
      className={className}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <BookOpen
          aria-hidden="true"
          className="size-4 shrink-0 text-foreground"
        />
        <h2
          id="synthesis-narrative-heading"
          className="text-sm font-semibold text-foreground"
        >
          Synthesis Narrative
        </h2>
      </div>

      {/* 3-col stat grid */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCell
          label="Total syntheses"
          value={String(narrative.total_syntheses)}
        />
        <StatCell
          label="Topic coverage"
          value={coveragePct}
          subLabel="of active topics"
        />
        <StatCell
          label="Avg sources"
          value={avgSources}
          subLabel="sources avg"
        />
      </div>

      {/* Most active topic chip */}
      {narrative.most_active_topic && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Most active topic
          </span>
          {narrative.most_active_topic.id ? (
            <Link
              href={`/library/${narrative.most_active_topic.id}`}
              aria-label={`View topic: ${narrative.most_active_topic.title}`}
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5",
                "bg-primary/10 text-[11px] font-medium text-primary",
                "hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-primary focus-visible:ring-offset-1",
                "transition-colors",
              )}
            >
              <Tag aria-hidden="true" className="size-2.5 shrink-0" />
              {narrative.most_active_topic.title}
            </Link>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5",
                "bg-primary/10 text-[11px] font-medium text-primary",
              )}
            >
              <Tag aria-hidden="true" className="size-2.5 shrink-0" />
              {narrative.most_active_topic.title}
            </span>
          )}
        </div>
      )}

      {/* Recent synthesis */}
      {narrative.recent_synthesis && (
        <div
          className="rounded-md border bg-card px-3 py-2.5"
          aria-label={`Most recent synthesis: ${narrative.recent_synthesis.title}`}
        >
          <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Most recent synthesis
          </div>
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
              {narrative.recent_synthesis.title}
            </span>
            {narrative.recent_synthesis.updated && (
              <time
                dateTime={narrative.recent_synthesis.updated}
                className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
              >
                {formatRelativeDate(narrative.recent_synthesis.updated)}
              </time>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
