"use client";

/**
 * TimelinePanel — horizontal stage timeline for WorkflowViewerScreen (Panel A).
 *
 * Renders the derived TimelineStage[] as a horizontal row of stage nodes
 * with status colours, duration badges, and click selection.
 *
 * Accessibility: keyboard navigable via tabIndex + onKeyDown Enter/Space;
 * aria-selected on active stage; role="listitem" on each node.
 *
 * Design reference: workflow-viewer-screen-b.html — "Expanded Workflow Stage
 * Tracker" section, adapted to shadcn/ui + Tailwind (not a literal port —
 * connector line approach and colour tokens match the Stitch aesthetic).
 *
 * FR-1.5-07 (P1.5-2-02).
 */

import React from "react";
import { cn } from "@/lib/utils";
import type { TimelineStage, TimelineStageStatus } from "@/types/workflow-viewer";

// ---------------------------------------------------------------------------
// Status colour helpers
// ---------------------------------------------------------------------------

function nodeClass(status: TimelineStageStatus, selected: boolean): string {
  const base =
    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-all duration-200 border-2";

  const variant: Record<TimelineStageStatus, string> = {
    success: "bg-emerald-600 border-emerald-600 text-white",
    error: "bg-red-500 border-red-500 text-white",
    in_progress:
      "bg-blue-500 border-blue-500 text-white animate-pulse ring-4 ring-blue-200 dark:ring-blue-900/50",
    pending: "bg-muted border-muted-foreground/30 text-muted-foreground",
  };

  const ring = selected
    ? "ring-2 ring-offset-2 ring-primary dark:ring-offset-background"
    : "";

  return cn(base, variant[status], ring);
}

function connectorClass(leftStatus: TimelineStageStatus): string {
  return cn(
    "h-0.5 flex-1 transition-colors duration-300",
    leftStatus === "success"
      ? "bg-emerald-500"
      : leftStatus === "error"
        ? "bg-red-400"
        : "bg-muted-foreground/20",
  );
}

function labelClass(status: TimelineStageStatus, selected: boolean): string {
  const base = "text-center transition-colors duration-150";
  const colour: Record<TimelineStageStatus, string> = {
    success: "text-emerald-700 dark:text-emerald-400",
    error: "text-red-600 dark:text-red-400",
    in_progress: "text-blue-600 dark:text-blue-400",
    pending: "text-muted-foreground",
  };
  return cn(base, colour[status], selected && "font-semibold");
}

// ---------------------------------------------------------------------------
// Duration formatter
// ---------------------------------------------------------------------------

function formatDuration(s: number | null): string | null {
  if (s === null || s < 0) return null;
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}m${sec > 0 ? ` ${sec}s` : ""}`;
}

// ---------------------------------------------------------------------------
// Stage icon
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: TimelineStageStatus }) {
  if (status === "success") {
    return (
      <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  if (status === "in_progress") {
    return (
      <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="5" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className="size-3" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Single stage node
// ---------------------------------------------------------------------------

interface StageNodeProps {
  stage: TimelineStage;
  index: number;
  isLast: boolean;
  selected: boolean;
  onClick: () => void;
}

function StageNode({ stage, index, isLast, selected, onClick }: StageNodeProps) {
  const dur = formatDuration(stage.durationS);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <li
      role="listitem"
      aria-label={`Stage ${index + 1}: ${stage.label} — ${stage.status}${dur ? `, ${dur}` : ""}`}
      className="relative flex items-center"
    >
      {/* Node + label column */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKey}
        aria-pressed={selected}
        className="group flex flex-col items-center gap-2 cursor-pointer focus:outline-none"
      >
        {/* Circle */}
        <div className={nodeClass(stage.status, selected)}>
          <StatusIcon status={stage.status} />
        </div>

        {/* Stage number + label */}
        <div className={cn("w-20 text-center", labelClass(stage.status, selected))}>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Stage {index + 1}
          </p>
          <p className="text-xs font-bold leading-tight">{stage.label}</p>
          {dur && (
            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">{dur}</p>
          )}
        </div>
      </div>

      {/* Connector — after node, before next node */}
      {!isLast && (
        <div
          aria-hidden="true"
          className={cn("mx-2 mt-[-1.5rem] min-w-[2rem]", connectorClass(stage.status))}
        />
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TimelineSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading timeline" className="flex items-start gap-2 px-2">
      {Array.from({ length: 5 }, (_, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
            <div className="w-16 h-3 rounded bg-muted animate-pulse" />
          </div>
          {i < 4 && <div className="h-0.5 flex-1 mt-5 bg-muted animate-pulse" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

interface TimelinePanelProps {
  stages: TimelineStage[];
  selectedStageName: string | null;
  onSelectStage: (name: string | null) => void;
  isLoading: boolean;
  error: string | null;
  className?: string;
}

export function TimelinePanel({
  stages,
  selectedStageName,
  onSelectStage,
  isLoading,
  error,
  className,
}: TimelinePanelProps) {
  if (isLoading && stages.length === 0) {
    return (
      <section aria-label="Workflow timeline" className={cn("w-full", className)}>
        <TimelineSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <section aria-label="Workflow timeline" className={cn(className)}>
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </section>
    );
  }

  if (stages.length === 0) {
    return (
      <section aria-label="Workflow timeline" className={cn(className)}>
        <p className="text-sm text-muted-foreground">No timeline events yet.</p>
      </section>
    );
  }

  return (
    <section
      aria-label="Workflow stage timeline"
      className={cn("w-full overflow-x-auto", className)}
    >
      <ol
        role="list"
        className="flex items-start gap-0 min-w-[480px] px-2 py-4"
      >
        {stages.map((stage, idx) => (
          <StageNode
            key={stage.name}
            stage={stage}
            index={idx}
            isLast={idx === stages.length - 1}
            selected={selectedStageName === stage.name}
            onClick={() =>
              onSelectStage(selectedStageName === stage.name ? null : stage.name)
            }
          />
        ))}
      </ol>
    </section>
  );
}
