"use client";

/**
 * WorkflowStatusBadge — compact status pill for a workflow run.
 *
 * Used on artifact cards in Inbox/Library when an artifact has an associated
 * active or recent workflow run (design spec §3.2, §7).
 *
 * WCAG 2.1 AA: status conveyed by both colour AND text label.
 */

import { cn } from "@/lib/utils";
import type { WorkflowRunStatus } from "@/types/artifact";

interface WorkflowStatusBadgeProps {
  status: WorkflowRunStatus;
  className?: string;
}

const STATUS_LABELS: Record<WorkflowRunStatus, string> = {
  pending: "Queued",
  running: "Running",
  paused: "Paused",
  complete: "Complete",
  failed: "Failed",
  abandoned: "Abandoned",
};

const STATUS_COLOURS: Record<WorkflowRunStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  paused: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  complete: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  abandoned: "bg-muted text-muted-foreground",
};

export function WorkflowStatusBadge({
  status,
  className,
}: WorkflowStatusBadgeProps) {
  const label = STATUS_LABELS[status];
  const colours = STATUS_COLOURS[status];
  const isActive = status === "pending" || status === "running";

  return (
    <span
      aria-label={`Workflow: ${label}`}
      role="status"
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        colours,
        className,
      )}
    >
      {isActive && (
        <span
          aria-hidden="true"
          className="size-1.5 animate-pulse rounded-full bg-current"
        />
      )}
      {label}
    </span>
  );
}
