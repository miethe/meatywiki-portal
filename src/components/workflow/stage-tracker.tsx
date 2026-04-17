"use client";

/**
 * StageTracker — visual progress indicator for a workflow run.
 *
 * Three variants:
 *   compact  — horizontal progress bar with stage label (P3-07 original).
 *              Used on artifact cards and in Workflow Status Panel run rows.
 *   full     — vertical step list with stage names (P3-07 original).
 *              Used in Quick Add post-submit confirmation strip and SSE progress.
 *   timeline — horizontal circles-and-line timeline (P4-07).
 *              Six fixed stages; circles filled/outlined; tooltip on hover/focus.
 *              Used on artifact cards and next to each run in Active Workflows panel.
 *
 * Design spec §7 (Workflow Stage Tracker compact); addendum §3.4.
 * Stitch reference: §3.1 StageTracker compact + full variants.
 *
 * SSE updates: component is purely presentational (takes props). Parents feed
 * updated run objects via useWorkflowRuns / RunSSEBridge hooks.
 */

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { WorkflowRunStatus } from "@/types/artifact";
import type { SSEWorkflowEvent } from "@/lib/sse/types";
import {
  TEMPLATE_STAGES,
  DEFAULT_TEMPLATE_STAGES,
  deriveStageInfos,
  stageCircleClass,
  stageConnectorClass,
  type StageInfo,
} from "@/lib/workflow/stages";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StageTrackerProps {
  runId: string;
  templateId?: string | null;
  status: WorkflowRunStatus;
  currentStage?: number | null;
  variant?: "compact" | "full" | "timeline";
  /**
   * SSE events for the run — used by the timeline variant to resolve
   * per-stage timestamps for tooltips. Optional; gracefully absent.
   */
  events?: SSEWorkflowEvent[] | null;
  /** "sse" — will subscribe when P3-08 wires hooks; "static" — static replay */
  mode?: "sse" | "static";
  className?: string;
}

// ---------------------------------------------------------------------------
// Colour helper (shared by compact bar + full variants)
// ---------------------------------------------------------------------------

function stageColour(
  idx: number,
  currentStage: number,
  status: WorkflowRunStatus,
): string {
  if (status === "failed" && idx === currentStage)
    return "bg-red-500 dark:bg-red-400";
  if (status === "complete" || idx < currentStage)
    return "bg-emerald-500 dark:bg-emerald-400";
  if (idx === currentStage && status === "running")
    return "bg-blue-500 dark:bg-blue-400 animate-pulse";
  return "bg-muted";
}

// ---------------------------------------------------------------------------
// Compact variant (P3-07 original — progress bar)
// ---------------------------------------------------------------------------

function CompactTracker({
  stages,
  currentStage,
  status,
  className,
}: {
  stages: string[];
  currentStage: number;
  status: WorkflowRunStatus;
  className?: string;
}) {
  const progress =
    status === "complete"
      ? 100
      : Math.round((currentStage / stages.length) * 100);
  const label =
    status === "complete"
      ? "Complete"
      : status === "failed"
        ? `Failed at ${stages[currentStage] ?? "stage"}`
        : `${stages[currentStage] ?? "Running"} (${currentStage + 1}/${stages.length})`;

  return (
    <div
      aria-label={`Workflow progress: ${label}`}
      className={cn("flex flex-col gap-0.5", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground truncate">
          {label}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {progress}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Stage progress"
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            status === "failed"
              ? "bg-red-500"
              : status === "complete"
                ? "bg-emerald-500"
                : "bg-blue-500",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full variant (P3-07 original — vertical list)
// ---------------------------------------------------------------------------

function FullTracker({
  stages,
  currentStage,
  status,
  className,
}: {
  stages: string[];
  currentStage: number;
  status: WorkflowRunStatus;
  className?: string;
}) {
  return (
    <ol aria-label="Workflow stages" className={cn("flex flex-col gap-2", className)}>
      {stages.map((stage, idx) => {
        const isDone = status === "complete" || idx < currentStage;
        const isActive = idx === currentStage && status === "running";
        const isFailed = idx === currentStage && status === "failed";

        return (
          <li key={stage} className="flex items-center gap-2.5">
            {/* Stage indicator dot */}
            <span
              aria-hidden="true"
              className={cn(
                "size-2 shrink-0 rounded-full",
                stageColour(idx, currentStage, status),
              )}
            />
            <span
              className={cn(
                "text-sm",
                isDone && "text-foreground",
                isActive && "font-medium text-blue-600 dark:text-blue-400",
                isFailed && "font-medium text-red-600 dark:text-red-400",
                !isDone && !isActive && !isFailed && "text-muted-foreground",
              )}
            >
              {stage}
            </span>
            {isActive && (
              <span className="text-[11px] text-muted-foreground">(running)</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Timeline variant (P4-07) — six circles connected by a line
// ---------------------------------------------------------------------------

/**
 * Single stage node: circle with accessible tooltip via title + aria-label.
 * Hover/focus reveals a tooltip via CSS :hover/:focus-within on the wrapper.
 */
function TimelineStageNode({
  info,
  isLast,
}: {
  info: StageInfo;
  isLast: boolean;
}) {
  const tooltipText = info.lastEventAt
    ? `${info.label} · ${formatTimestamp(info.lastEventAt)}`
    : info.label;

  return (
    <li
      role="listitem"
      aria-label={`${info.label}: ${info.state}`}
      aria-current={info.state === "active" ? "step" : undefined}
      className="relative flex items-center"
    >
      {/* Tooltip wrapper */}
      <div className="group relative flex items-center">
        {/* Circle */}
        <span
          title={tooltipText}
          tabIndex={0}
          aria-label={tooltipText}
          className={cn(
            "size-3 shrink-0 rounded-full border-2 transition-all duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
            stageCircleClass(info.state),
          )}
        />

        {/* Tooltip panel — visible on hover or focus-within */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2",
            "whitespace-nowrap rounded-md bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-md",
            "opacity-0 transition-opacity duration-150",
            "group-hover:opacity-100 group-focus-within:opacity-100",
            "z-50",
          )}
        >
          <span className="font-medium">{info.label}</span>
          {info.lastEventAt && (
            <span className="ml-1 text-muted-foreground">
              · {formatTimestamp(info.lastEventAt)}
            </span>
          )}
          {/* Arrow */}
          <span
            className={cn(
              "absolute left-1/2 top-full -translate-x-1/2",
              "border-4 border-transparent border-t-popover",
            )}
          />
        </div>
      </div>

      {/* Connector line (not rendered after the last stage) */}
      {!isLast && (
        <span
          aria-hidden="true"
          className={cn(
            "mx-1 h-0.5 flex-1 min-w-[12px] transition-colors duration-300",
            stageConnectorClass(info.state),
          )}
        />
      )}
    </li>
  );
}

/**
 * Timeline tracker: horizontal row of 6 circles connected by thin lines.
 * Height: ~40px (fits within the 40–60px spec range).
 */
function TimelineTracker({
  stageInfos,
  className,
}: {
  stageInfos: StageInfo[];
  className?: string;
}) {
  return (
    <ol
      role="list"
      aria-label="Workflow stage timeline"
      className={cn(
        "flex items-center w-full min-h-[40px] max-h-[60px] px-1",
        className,
      )}
    >
      {stageInfos.map((info, idx) => (
        <TimelineStageNode
          key={info.key}
          info={info}
          isLast={idx === stageInfos.length - 1}
        />
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Timestamp formatter
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function StageTracker({
  runId: _runId, // eslint-disable-line @typescript-eslint/no-unused-vars
  templateId,
  status,
  currentStage,
  variant = "compact",
  events,
  mode: _mode = "static", // eslint-disable-line @typescript-eslint/no-unused-vars
  className,
}: StageTrackerProps) {
  // Clamp currentStage to valid range
  const templateStages = templateId
    ? (TEMPLATE_STAGES[templateId] ?? DEFAULT_TEMPLATE_STAGES)
    : DEFAULT_TEMPLATE_STAGES;

  const safeStageForTemplate = Math.min(
    Math.max(currentStage ?? 0, 0),
    templateStages.length - 1,
  );

  // Timeline variant uses the fixed 6-stage pipeline; derive per-stage state.
  const safeStageForTimeline = Math.min(
    Math.max(currentStage ?? 0, 0),
    5, // 6 stages (0-indexed max = 5)
  );

  // Memoise timeline stage derivation — pure function, safe to cache.
  const stageInfos = useMemo(
    () => deriveStageInfos(safeStageForTimeline, status, events),
    [safeStageForTimeline, status, events],
  );

  if (variant === "timeline") {
    return <TimelineTracker stageInfos={stageInfos} className={className} />;
  }

  if (variant === "compact") {
    return (
      <CompactTracker
        stages={templateStages}
        currentStage={safeStageForTemplate}
        status={status}
        className={className}
      />
    );
  }

  return (
    <FullTracker
      stages={templateStages}
      currentStage={safeStageForTemplate}
      status={status}
      className={className}
    />
  );
}
