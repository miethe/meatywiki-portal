"use client";

/**
 * StageDetailClient — read-only stage event log for a single compile stage.
 *
 * Route: /artifact/[id]/compile/stages/[stage_name]
 *
 * Subscribes to the SSE stream for the given artifact, filters events to the
 * requested stage, and renders a timestamped event log with status badges,
 * token counts (when present in payload), and error detail on failure events.
 *
 * Design constraints (P3-03 / OQ-5):
 *   - Read-only: no edit surfaces, no raw LLM prompt text.
 *   - Token counts: read from payload; absent → "— Not available". Never render
 *     0 as a fake value, never crash on absent fields.
 *   - Empty state (SC-3.7): renders a clear placeholder when no events match the
 *     stage — must not 404 or crash.
 *   - Back button calls router.back(); labeled for screen readers.
 */

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCompileEvents } from "@/hooks/useCompileEvents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { cn } from "@/lib/utils";
import type { WorkflowStageEventDTO, CompileEventStatus } from "@/types/compileEvents";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Humanize a snake_case stage name: "file_back" → "File Back".
 */
function humanizeStage(stage: string): string {
  return stage
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Format an ISO 8601 timestamp for display.
 * Falls back to the raw string if parsing fails.
 */
function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Compute duration between two ISO timestamps.
 * Returns a human-readable string or null if undeterminable.
 */
function computeDuration(startIso: string, endIso: string): string | null {
  try {
    const diff = new Date(endIso).getTime() - new Date(startIso).getTime();
    if (!Number.isFinite(diff) || diff < 0) return null;
    if (diff < 1000) return `${diff}ms`;
    if (diff < 60_000) return `${(diff / 1000).toFixed(1)}s`;
    const mins = Math.floor(diff / 60_000);
    const secs = Math.round((diff % 60_000) / 1000);
    return `${mins}m ${secs}s`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_BADGE_CONFIG: Record<
  CompileEventStatus,
  { label: string; className: string }
> = {
  started: {
    label: "Started",
    className:
      "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  completed: {
    label: "Completed",
    className:
      "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  failed: {
    label: "Failed",
    className:
      "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/25",
  },
};

interface StatusBadgeProps {
  status: CompileEventStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_BADGE_CONFIG[status] ?? {
    label: status,
    className: "border-transparent bg-secondary text-secondary-foreground",
  };
  return (
    <Badge className={cn("shrink-0 font-medium text-[11px] px-2 py-0.5", config.className)}>
      {config.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Token count row
// ---------------------------------------------------------------------------

interface TokenCountsProps {
  payload: Record<string, unknown>;
}

function TokenCounts({ payload }: TokenCountsProps) {
  const tokensInput =
    typeof payload.tokens_input === "number" ? payload.tokens_input : null;
  const tokensOutput =
    typeof payload.tokens_output === "number" ? payload.tokens_output : null;
  const tokensTotal =
    typeof payload.tokens_total === "number" ? payload.tokens_total : null;

  const hasAny = tokensInput !== null || tokensOutput !== null || tokensTotal !== null;

  return (
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
      <div>
        <span className="text-muted-foreground">Input tokens</span>{" "}
        <span className="font-mono font-medium text-foreground">
          {tokensInput !== null ? tokensInput.toLocaleString() : "— Not available"}
        </span>
      </div>
      <div>
        <span className="text-muted-foreground">Output tokens</span>{" "}
        <span className="font-mono font-medium text-foreground">
          {tokensOutput !== null ? tokensOutput.toLocaleString() : "— Not available"}
        </span>
      </div>
      <div>
        <span className="text-muted-foreground">Total tokens</span>{" "}
        <span className="font-mono font-medium text-foreground">
          {tokensTotal !== null
            ? tokensTotal.toLocaleString()
            : hasAny && tokensInput !== null && tokensOutput !== null
            ? (tokensInput + tokensOutput).toLocaleString()
            : "— Not available"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error detail block
// ---------------------------------------------------------------------------

interface ErrorDetailProps {
  payload: Record<string, unknown>;
}

function ErrorDetail({ payload }: ErrorDetailProps) {
  const errorMessage =
    typeof payload.error === "string"
      ? payload.error
      : typeof payload.error_message === "string"
      ? payload.error_message
      : null;
  const errorCode =
    typeof payload.error_code === "string" ? payload.error_code : null;

  if (!errorMessage && !errorCode) return null;

  return (
    <div
      role="alert"
      className="mt-3 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-xs"
    >
      {errorCode && (
        <p className="mb-1 font-mono font-semibold text-destructive">
          {errorCode}
        </p>
      )}
      {errorMessage && (
        <p className="text-destructive/90">{errorMessage}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payload metadata table
// ---------------------------------------------------------------------------

/** Known internal keys handled by dedicated renderers — excluded from generic table. */
const HANDLED_PAYLOAD_KEYS = new Set([
  "tokens_input",
  "tokens_output",
  "tokens_total",
  "error",
  "error_message",
  "error_code",
]);

interface PayloadMetaTableProps {
  payload: Record<string, unknown>;
}

function PayloadMetaTable({ payload }: PayloadMetaTableProps) {
  const entries = Object.entries(payload).filter(
    ([key]) => !HANDLED_PAYLOAD_KEYS.has(key),
  );

  if (entries.length === 0) return null;

  return (
    <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
      {entries.map(([key, value]) => (
        <React.Fragment key={key}>
          <dt className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</dt>
          <dd className="font-mono text-foreground break-all">
            {typeof value === "string" || typeof value === "number" || typeof value === "boolean"
              ? String(value)
              : JSON.stringify(value)}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Event row
// ---------------------------------------------------------------------------

interface EventRowProps {
  event: WorkflowStageEventDTO;
  index: number;
  /** ISO timestamp of the "started" event in this stage, for duration calc. */
  stageStartIso: string | null;
}

function EventRow({ event, index, stageStartIso }: EventRowProps) {
  const isFailure = event.status === "failed";
  const duration =
    event.status !== "started" && stageStartIso
      ? computeDuration(stageStartIso, event.created_at)
      : null;

  return (
    <li
      className={cn(
        "rounded-lg border bg-card px-4 py-3 shadow-sm",
        isFailure && "border-destructive/40 bg-destructive/5",
      )}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">
          #{index + 1}
        </span>
        <StatusBadge status={event.status} />
        <time
          dateTime={event.created_at}
          className="ml-auto text-xs text-muted-foreground tabular-nums"
        >
          {formatTimestamp(event.created_at)}
        </time>
        {duration && (
          <span className="text-xs text-muted-foreground tabular-nums">
            ({duration})
          </span>
        )}
      </div>

      {/* Token counts */}
      <TokenCounts payload={event.payload} />

      {/* Error detail */}
      {isFailure && <ErrorDetail payload={event.payload} />}

      {/* Generic payload metadata */}
      <PayloadMetaTable payload={event.payload} />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Timing summary
// ---------------------------------------------------------------------------

interface TimingSummaryProps {
  events: WorkflowStageEventDTO[];
}

function TimingSummary({ events }: TimingSummaryProps) {
  const startEvent = events.find((e) => e.status === "started");
  const endEvent = [...events]
    .reverse()
    .find((e) => e.status === "completed" || e.status === "failed");

  if (!startEvent) return null;

  const duration =
    endEvent ? computeDuration(startEvent.created_at, endEvent.created_at) : null;

  return (
    <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-md border bg-muted/40 px-4 py-2.5 text-xs">
      <div>
        <span className="text-muted-foreground">Start</span>{" "}
        <time dateTime={startEvent.created_at} className="font-mono text-foreground">
          {formatTimestamp(startEvent.created_at)}
        </time>
      </div>
      {endEvent && (
        <div>
          <span className="text-muted-foreground">End</span>{" "}
          <time dateTime={endEvent.created_at} className="font-mono text-foreground">
            {formatTimestamp(endEvent.created_at)}
          </time>
        </div>
      )}
      {duration && (
        <div>
          <span className="text-muted-foreground">Duration</span>{" "}
          <span className="font-mono font-medium text-foreground">{duration}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface StageDetailClientProps {
  id: string;
  stageName: string;
}

export function StageDetailClient({ id, stageName }: StageDetailClientProps) {
  const router = useRouter();

  const { events: allEvents, isStreaming } = useCompileEvents({
    artifactId: id,
    enabled: true,
  });

  // Filter to events matching this stage only.
  const stageEvents = useMemo(
    () => allEvents.filter((e) => e.stage === stageName),
    [allEvents, stageName],
  );

  // ISO timestamp of the first "started" event in this stage — used for duration calculation.
  const stageStartIso = useMemo(() => {
    const started = stageEvents.find((e) => e.status === "started");
    return started?.created_at ?? null;
  }, [stageEvents]);

  const humanStage = humanizeStage(stageName);

  const breadcrumbItems = [
    { label: "Library", href: "/library" },
    { label: id, href: `/artifact/${id}` },
    { label: "Compile" },
    { label: humanStage },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      {/* Breadcrumb navigation */}
      <Breadcrumbs items={breadcrumbItems} className="mb-4" />

      {/* Page heading */}
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {humanStage} stage
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compile events for artifact{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
            {id}
          </code>
        </p>
      </header>

      {/* Live stream indicator */}
      {isStreaming && (
        <div
          aria-live="polite"
          className="mb-4 flex items-center gap-2 text-xs text-muted-foreground"
        >
          <span className="relative inline-flex size-1.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          Streaming live events…
        </div>
      )}

      {/* Timing summary — rendered above event list when events are present */}
      {stageEvents.length > 0 && <TimingSummary events={stageEvents} />}

      {/* Event log */}
      {stageEvents.length > 0 ? (
        <ol
          aria-label={`${humanStage} stage event log`}
          className="flex flex-col gap-3"
        >
          {stageEvents.map((event, i) => (
            <EventRow
              key={event.id}
              event={event}
              index={i}
              stageStartIso={stageStartIso}
            />
          ))}
        </ol>
      ) : (
        /* Empty state — SC-3.7: must render without crash or 404 */
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center"
        >
          <svg
            aria-hidden="true"
            className="mb-3 size-8 text-muted-foreground/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2"
            />
          </svg>
          <p className="text-sm font-medium text-muted-foreground">
            No events recorded for this stage yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Events will appear here once the{" "}
            <strong className="font-medium">{humanStage}</strong> stage runs.
          </p>
        </div>
      )}

      {/* Back button */}
      <div className="mt-8">
        <Button
          variant="outline"
          size="sm"
          aria-label="Back to artifact detail"
          onClick={() => router.back()}
        >
          <svg
            aria-hidden="true"
            className="mr-1.5 size-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to artifact detail
        </Button>
      </div>
    </div>
  );
}
