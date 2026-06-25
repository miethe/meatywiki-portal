"use client";

/**
 * StoryStatusBadge — compact lifecycle-state pill for an op story.
 *
 * Cloned from WorkflowStatusBadge; adapted for story lifecycle_state vocab:
 *   new | backlog | hold | held | drafted | pr_opened | archived | published
 *
 * WCAG 2.1 AA: status conveyed by both colour AND text label.
 */

import { cn } from "@/lib/utils";
import type { LifecycleState } from "@/types/stories";

interface StoryStatusBadgeProps {
  lifecycleState: LifecycleState;
  className?: string;
}

const STATE_LABELS: Record<LifecycleState, string> = {
  new: "New",
  backlog: "Backlog",
  hold: "Hold",
  held: "Held",
  drafted: "Drafted",
  pr_opened: "PR Opened",
  archived: "Archived",
  published: "Published",
};

const STATE_COLOURS: Record<LifecycleState, string> = {
  new: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  backlog: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  hold: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  held: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  drafted: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  pr_opened:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  archived: "bg-muted text-muted-foreground",
  published:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};

export function StoryStatusBadge({
  lifecycleState,
  className,
}: StoryStatusBadgeProps) {
  const label = STATE_LABELS[lifecycleState] ?? lifecycleState;
  const colours =
    STATE_COLOURS[lifecycleState] ?? "bg-muted text-muted-foreground";

  return (
    <span
      aria-label={`Story status: ${label}`}
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        colours,
        className,
      )}
    >
      {label}
    </span>
  );
}
