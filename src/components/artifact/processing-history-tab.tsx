"use client";

/**
 * ProcessingHistoryTab — renders the "Processing" tab panel in Artifact Detail.
 *
 * Displays a vertical timeline of pipeline stage events fetched from
 * GET /api/artifacts/:id/processing-history.
 *
 * States handled:
 *   - Loading: shimmer skeleton rows
 *   - Empty: friendly empty-state with icon
 *   - Error: inline error with retry button
 *   - Populated: ordered timeline, newest events first
 *
 * Each event shows:
 *   - Status icon (check / warning / x / spinner) keyed on event_type
 *   - Stage name + event type label
 *   - Formatted timestamp (relative + absolute on hover)
 *   - Duration (if present, formatted as "1.2s" or "450ms")
 *   - output_summary (collapsed preview when present)
 *   - error_detail or degraded_reason (for failure/degraded events)
 *
 * P2-02 — Processing history tab on artifact detail.
 */

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Loader2,
  Activity,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProcessingHistory, type StageEventItem, type StageEventType } from "@/hooks/use-processing-history";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a duration in milliseconds to a human-readable string.
 * < 1000ms → "450ms"
 * >= 1000ms → "1.2s"
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format an ISO datetime to a readable relative + absolute pair.
 * Returns { relative: "2 hours ago", absolute: "Apr 27, 2026 14:32:05" }
 */
function formatTimestamp(iso: string): { relative: string; absolute: string } {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  let relative: string;
  if (diffSec < 60) {
    relative = "just now";
  } else if (diffMin < 60) {
    relative = `${diffMin}m ago`;
  } else if (diffHr < 24) {
    relative = `${diffHr}h ago`;
  } else if (diffDay < 7) {
    relative = `${diffDay}d ago`;
  } else {
    relative = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  const absolute = date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return { relative, absolute };
}

/**
 * Human-readable label for each event_type.
 */
const EVENT_TYPE_LABELS: Record<StageEventType, string> = {
  stage_started: "Started",
  stage_completed: "Completed",
  stage_failed: "Failed",
  stage_degraded: "Degraded",
  compile_failed: "Compile Failed",
};

/**
 * Icon + colour config keyed on event_type.
 */
interface EventStyle {
  Icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  dotClass: string;
  labelClass: string;
  connectorClass: string;
}

const EVENT_STYLES: Record<StageEventType, EventStyle> = {
  stage_started: {
    Icon: Loader2,
    iconClass: "text-sky-500 dark:text-sky-400",
    dotClass: "bg-sky-500/20 border-sky-400",
    labelClass: "text-sky-700 dark:text-sky-300",
    connectorClass: "border-sky-200 dark:border-sky-800",
  },
  stage_completed: {
    Icon: CheckCircle2,
    iconClass: "text-emerald-500 dark:text-emerald-400",
    dotClass: "bg-emerald-500/15 border-emerald-500",
    labelClass: "text-emerald-700 dark:text-emerald-300",
    connectorClass: "border-emerald-200 dark:border-emerald-800",
  },
  stage_failed: {
    Icon: XCircle,
    iconClass: "text-destructive",
    dotClass: "bg-destructive/15 border-destructive/70",
    labelClass: "text-destructive",
    connectorClass: "border-destructive/20",
  },
  stage_degraded: {
    Icon: AlertTriangle,
    iconClass: "text-amber-500 dark:text-amber-400",
    dotClass: "bg-amber-500/15 border-amber-500",
    labelClass: "text-amber-700 dark:text-amber-300",
    connectorClass: "border-amber-200 dark:border-amber-800",
  },
  compile_failed: {
    Icon: XCircle,
    iconClass: "text-destructive",
    dotClass: "bg-destructive/15 border-destructive/70",
    labelClass: "text-destructive",
    connectorClass: "border-destructive/20",
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Small pill badge with an accessible tooltip shown on hover and keyboard focus.
 *
 * The tooltip panel is positioned above the badge and made visible via CSS
 * group-hover / group-focus-within — matching the stage-tracker pattern.
 * The badge itself is focusable (tabIndex=0) so keyboard users can reveal it.
 *
 * When `tooltipText` is empty/undefined the badge renders without a tooltip
 * wrapper (falls back to a plain span for screen readers).
 */
function BadgeWithTooltip({
  label,
  tooltipText,
  badgeClass,
  tooltipClass,
}: {
  label: string;
  tooltipText: string | undefined | null;
  /** Tailwind classes for the pill itself */
  badgeClass: string;
  /** Tailwind classes for the tooltip panel background + text */
  tooltipClass: string;
}) {
  if (!tooltipText) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight",
          badgeClass,
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <span className="group relative inline-flex items-center">
      {/* Pill badge — focusable so keyboard users can trigger the tooltip */}
      <span
        role="img"
        tabIndex={0}
        aria-label={`${label}: ${tooltipText}`}
        title={tooltipText}
        className={cn(
          "inline-flex cursor-default items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          badgeClass,
        )}
      >
        {label}
      </span>

      {/* Tooltip panel — shown on hover or keyboard focus */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2",
          "z-50 max-w-[220px] whitespace-normal rounded-md px-2.5 py-1.5 text-[11px] leading-snug shadow-md",
          "opacity-0 transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          tooltipClass,
        )}
      >
        {tooltipText}
        {/* Arrow */}
        <span
          className={cn(
            "absolute left-1/2 top-full -translate-x-1/2",
            "border-4 border-transparent",
            // Arrow colour must match tooltip background; handled via inline style below
          )}
          style={{ borderTopColor: "inherit" }}
        />
      </span>
    </span>
  );
}

/**
 * Skeleton shimmer for one timeline event row.
 */
function EventSkeleton({ isLast }: { isLast: boolean }) {
  return (
    <li className="relative flex gap-4 pb-6">
      {/* Connector line */}
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute left-[18px] top-9 w-px flex-none bg-border"
          style={{ bottom: 0 }}
        />
      )}

      {/* Icon dot */}
      <div
        aria-hidden="true"
        className="relative z-10 mt-1 flex h-9 w-9 flex-none animate-pulse items-center justify-center rounded-full border bg-muted"
      />

      {/* Content */}
      <div className="flex flex-1 animate-pulse flex-col gap-1.5 pt-1">
        <div className="flex items-center gap-2">
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="h-4 w-16 rounded-sm bg-muted" />
        </div>
        <div className="h-3 w-20 rounded bg-muted" />
      </div>
    </li>
  );
}

/**
 * A single timeline event row.
 */
function EventRow({
  event,
  isLast,
}: {
  event: StageEventItem;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const eventType = event.event_type as StageEventType;
  const styles = EVENT_STYLES[eventType] ?? EVENT_STYLES.stage_started;
  const { Icon } = styles;

  const label = EVENT_TYPE_LABELS[eventType] ?? eventType;
  const stageName = event.stage_name ?? "pipeline";
  const { relative, absolute } = formatTimestamp(event.created_at);

  const hasDetail =
    Boolean(event.output_summary) ||
    Boolean(event.error_detail) ||
    Boolean(event.degraded_reason);

  return (
    <li className="relative flex gap-4 pb-6">
      {/* Vertical connector line — spans gap to next event */}
      {!isLast && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-[18px] top-9 w-px flex-none border-l border-dashed",
            styles.connectorClass,
          )}
          style={{ bottom: 0 }}
        />
      )}

      {/* Status icon dot */}
      <div
        aria-hidden="true"
        className={cn(
          "relative z-10 mt-1 flex h-9 w-9 flex-none items-center justify-center rounded-full border",
          styles.dotClass,
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4",
            styles.iconClass,
            eventType === "stage_started" && "animate-spin",
          )}
        />
      </div>

      {/* Event body */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
        {/* Title row: stage name + type badge + duration */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-foreground capitalize">
            {stageName}
          </span>

          <span
            className={cn(
              "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
              "bg-muted/80",
              styles.labelClass,
            )}
          >
            {label}
          </span>

          {/* Degraded badge — amber pill with degraded_reason tooltip */}
          {eventType === "stage_degraded" && (
            <BadgeWithTooltip
              label="Degraded"
              tooltipText={event.degraded_reason}
              badgeClass="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
              tooltipClass="bg-amber-900 text-amber-50 dark:bg-amber-800"
            />
          )}

          {/* Failed badge — red pill with error_detail tooltip */}
          {(eventType === "stage_failed" || eventType === "compile_failed") && (
            <BadgeWithTooltip
              label="Failed"
              tooltipText={event.error_detail}
              badgeClass="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
              tooltipClass="bg-red-900 text-red-50 dark:bg-red-800"
            />
          )}

          {event.duration_ms !== null && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <Clock aria-hidden="true" className="h-3 w-3" />
              {formatDuration(event.duration_ms)}
            </span>
          )}
        </div>

        {/* Timestamp */}
        <time
          dateTime={event.created_at}
          title={absolute}
          className="text-[11px] text-muted-foreground/70"
        >
          {relative}
        </time>

        {/* Expandable detail: output_summary / error_detail / degraded_reason */}
        {hasDetail && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
                "transition-colors hover:text-foreground",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded",
              )}
            >
              {expanded ? (
                <ChevronDown aria-hidden="true" className="h-3 w-3" />
              ) : (
                <ChevronRight aria-hidden="true" className="h-3 w-3" />
              )}
              {expanded ? "Hide detail" : "Show detail"}
            </button>

            {expanded && (
              <div
                className={cn(
                  "mt-1.5 rounded-md border px-3 py-2 text-xs leading-relaxed",
                  (eventType === "stage_failed" || eventType === "compile_failed")
                    ? "border-destructive/20 bg-destructive/5 text-destructive"
                    : eventType === "stage_degraded"
                      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      : "border-border bg-muted/40 text-foreground/80",
                )}
              >
                {event.error_detail && (
                  <p>
                    <span className="font-semibold">Error: </span>
                    {event.error_detail}
                  </p>
                )}
                {event.degraded_reason && (
                  <p className={event.error_detail ? "mt-1" : undefined}>
                    <span className="font-semibold">Reason: </span>
                    {event.degraded_reason}
                  </p>
                )}
                {event.output_summary && (
                  <p className={(event.error_detail || event.degraded_reason) ? "mt-1" : undefined}>
                    {event.output_summary}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
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
      aria-label="No processing history"
      className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Activity aria-hidden="true" className="h-6 w-6 text-muted-foreground/60" />
      </div>
      <div className="max-w-xs">
        <p className="text-sm font-medium text-foreground">No processing history yet.</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Stage events appear here once the artifact has been processed by the pipeline.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 py-12 text-center"
    >
      <p className="text-sm font-medium text-foreground">Failed to load processing history</p>
      <p className="text-xs text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "inline-flex h-8 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive",
          "transition-colors hover:bg-destructive/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface ProcessingHistoryTabProps {
  artifactId: string;
}

/**
 * ProcessingHistoryTab — mounts inside a tab panel hidden via `hidden` attribute.
 * TanStack Query handles data caching; tab switches do not remount this component.
 *
 * Events are shown newest-first (the backend returns chronological order;
 * we reverse for display so the most recent status is at the top).
 */
export function ProcessingHistoryTab({ artifactId }: ProcessingHistoryTabProps) {
  const { events, isLoading, isError, error, refetch } = useProcessingHistory(artifactId);

  if (isLoading) {
    return (
      <div aria-busy="true" aria-label="Loading processing history">
        <ul role="list" className="flex flex-col">
          {[0, 1, 2, 3].map((i) => (
            <EventSkeleton key={i} isLast={i === 3} />
          ))}
        </ul>
      </div>
    );
  }

  if (isError && error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  if (events.length === 0) {
    return <EmptyState />;
  }

  // Reverse to show newest first
  const sorted = [...events].reverse();

  return (
    <section aria-labelledby="processing-history-heading">
      <h3 id="processing-history-heading" className="sr-only">
        Processing history ({events.length} events)
      </h3>

      {/* Run ID grouping hint — subtle metadata line if multiple run_ids present */}
      {new Set(events.map((e) => e.run_id)).size > 1 && (
        <p className="mb-4 text-[11px] text-muted-foreground">
          Showing {events.length} events across {new Set(events.map((e) => e.run_id)).size} runs
          — newest first.
        </p>
      )}

      <ul role="list" className="flex flex-col">
        {sorted.map((event, idx) => (
          <EventRow
            key={event.event_id}
            event={event}
            isLast={idx === sorted.length - 1}
          />
        ))}
      </ul>
    </section>
  );
}
