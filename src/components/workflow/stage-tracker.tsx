"use client";

/**
 * StageTracker — visual progress indicator for a workflow run.
 *
 * Two variants:
 *   compact — used on artifact cards and in Workflow Status Panel run rows.
 *             Renders as a horizontal progress bar with stage label.
 *   full    — used in Quick Add post-submit confirmation strip and SSE progress.
 *             Renders as a vertical step list with stage names.
 *
 * In v1 this is a purely presentational scaffold — P3-08 wires the SSE
 * subscription that drives the stage/status props.
 *
 * Design spec §7 (Workflow Stage Tracker compact); addendum §3.4.
 * Stitch reference: §3.1 StageTracker compact + full variants.
 */

import { cn } from "@/lib/utils";
import type { WorkflowRunStatus } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Stage definitions per template (design spec §7, 4 templates)
// ---------------------------------------------------------------------------

const TEMPLATE_STAGES: Record<string, string[]> = {
  source_ingest_v1: ["Receive", "Parse", "Classify", "Index"],
  research_synthesis_v1: ["Scope", "Compile", "Extract", "Synthesise", "Lint"],
  lint_scope_v1: ["Scan", "Lint", "Report"],
  compile_v1: ["Classify", "Extract", "Compile", "Lint"],
};

const DEFAULT_STAGES = ["Stage 1", "Stage 2", "Stage 3"];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StageTrackerProps {
  runId: string;
  templateId?: string | null;
  status: WorkflowRunStatus;
  currentStage?: number | null;
  variant?: "compact" | "full";
  /** "sse" — will subscribe when P3-08 wires hooks; "static" — static replay */
  mode?: "sse" | "static";
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
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
// Compact variant
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
  const label = status === "complete"
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
        <span className="text-[11px] text-muted-foreground truncate">{label}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{progress}%</span>
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
// Full variant
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
    <ol
      aria-label="Workflow stages"
      className={cn("flex flex-col gap-2", className)}
    >
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
// Public export
// ---------------------------------------------------------------------------

export function StageTracker({
  runId: _runId, // eslint-disable-line @typescript-eslint/no-unused-vars
  templateId,
  status,
  currentStage,
  variant = "compact",
  mode: _mode = "static", // eslint-disable-line @typescript-eslint/no-unused-vars
  className,
}: StageTrackerProps) {
  const stages = templateId
    ? (TEMPLATE_STAGES[templateId] ?? DEFAULT_STAGES)
    : DEFAULT_STAGES;
  const safeStage = Math.min(
    Math.max(currentStage ?? 0, 0),
    stages.length - 1,
  );

  if (variant === "compact") {
    return (
      <CompactTracker
        stages={stages}
        currentStage={safeStage}
        status={status}
        className={className}
      />
    );
  }

  return (
    <FullTracker
      stages={stages}
      currentStage={safeStage}
      status={status}
      className={className}
    />
  );
}
