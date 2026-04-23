"use client";

/**
 * ActivityTimeline — inline activity timeline at the bottom of the artifact body.
 *
 * Renders chronological activity entries (avatar/initials + actor name + action +
 * relative time + optional collapsible summary). Sits below `<ArtifactBody>`
 * before any footer, spanning the full main-content width.
 *
 * ## Data source
 *
 * Consumes `useArtifactActivity(id)` which:
 * - Fetches GET /api/artifacts/:id/activity when available.
 * - Falls back to deterministic mock fixture data when the endpoint is absent
 *   (404/405). This is intentional per P4-04 plan Notes section.
 *
 * ## Relationship to ContextRail HistoryPanel (P4-03)
 *
 * The HistoryPanel in the right rail tab renders a graceful empty state (no mocks)
 * because it is always visible. This inline body timeline intentionally uses mocks
 * so the Stitch-mirroring layout is always populated. They are two separate surfaces
 * but share the same `useArtifactActivity` hook — both would benefit when the
 * real endpoint ships.
 *
 * ## Relative time
 *
 * Implemented without additional dependencies (no date-fns/dayjs). Uses the
 * same `RelativeTime` pattern already in ContextRail.tsx.
 *
 * P4-04 — Handoff Chain + Activity Timeline.
 * Stitch reference: Artifact Detail footer activity section.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useArtifactActivity, type ActivityEntry } from "@/hooks/useArtifactActivity";

// ---------------------------------------------------------------------------
// Relative time util (no external deps — mirrors ContextRail.tsx pattern)
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ---------------------------------------------------------------------------
// Avatar — image with initials fallback
// ---------------------------------------------------------------------------

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: "sm" | "md";
}

function Avatar({ name, src, size = "md" }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sizeClasses = size === "sm" ? "size-6 text-[9px]" : "size-8 text-[11px]";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        aria-hidden="true"
        className={cn(
          "shrink-0 rounded-full object-cover",
          "ring-1 ring-border",
          sizeClasses,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        "bg-muted font-semibold uppercase tracking-wide text-muted-foreground",
        "ring-1 ring-border",
        sizeClasses,
      )}
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single timeline entry
// ---------------------------------------------------------------------------

function TimelineEntry({ entry }: { entry: ActivityEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasSummary = Boolean(entry.summary);
  const relTime = formatRelativeTime(entry.timestamp);

  return (
    <li className="group flex items-start gap-3">
      {/* Avatar */}
      <Avatar name={entry.actor.name} src={entry.actor.avatar} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
          <span className="text-sm font-semibold text-foreground">
            {entry.actor.name}
          </span>
          <span className="text-sm text-muted-foreground">{entry.action}</span>
          <time
            dateTime={entry.timestamp}
            className="ml-auto text-xs text-muted-foreground/60"
          >
            {relTime}
          </time>
        </div>

        {/* Expandable summary */}
        {hasSummary && (
          <div className="mt-1">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
                "transition-colors hover:text-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
              )}
            >
              {expanded ? (
                <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
              ) : (
                <ChevronRight aria-hidden="true" className="size-3 shrink-0" />
              )}
              {expanded ? "Hide details" : "Show details"}
            </button>

            {expanded && (
              <p className="mt-1 rounded-md border-l-2 border-border bg-muted/30 py-1.5 pl-3 pr-2 text-[12px] leading-relaxed text-muted-foreground">
                {entry.summary}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Skeleton — used while loading
// ---------------------------------------------------------------------------

function ActivitySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading activity" className="flex flex-col gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex animate-pulse items-start gap-3">
          <div className="size-8 shrink-0 rounded-full bg-muted" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex gap-2">
              <div className="h-3.5 w-24 rounded bg-muted" />
              <div className="h-3.5 w-32 rounded bg-muted" />
              <div className="ml-auto h-3 w-14 rounded bg-muted" />
            </div>
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ActivityTimelineProps {
  artifactId: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Inline activity timeline, rendered below the body content.
 *
 * Fetches from `/api/artifacts/{id}/activity` via `useArtifactActivity`.
 * Falls back to mock fixture data when the endpoint is absent (P4-04 spec).
 */
export function ActivityTimeline({ artifactId, className }: ActivityTimelineProps) {
  const { activity, isLoading } = useArtifactActivity(artifactId);

  return (
    <section
      aria-labelledby="activity-timeline-heading"
      className={cn(
        "rounded-xl border bg-card/50 px-4 py-4 sm:px-6",
        className,
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Activity
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <h2
          id="activity-timeline-heading"
          className="text-sm font-semibold text-foreground"
        >
          Activity
        </h2>
      </div>

      {/* Content */}
      {isLoading ? (
        <ActivitySkeleton />
      ) : activity.length === 0 ? (
        <div
          role="status"
          className="flex flex-col items-center gap-2 rounded-md border border-dashed py-8 text-center"
        >
          <p className="text-xs font-medium text-foreground">No activity recorded</p>
          <p className="text-[11px] text-muted-foreground">
            Revisions, promotions, and system events will appear here.
          </p>
        </div>
      ) : (
        <ol
          role="list"
          aria-label="Artifact activity"
          className="relative flex flex-col gap-4"
        >
          {/* Vertical rail line */}
          <span
            aria-hidden="true"
            className="absolute left-[15px] top-4 bottom-0 w-px bg-border"
          />
          {activity.map((entry) => (
            <TimelineEntry key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
    </section>
  );
}
