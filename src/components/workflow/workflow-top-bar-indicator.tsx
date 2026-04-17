"use client";

/**
 * WorkflowTopBarIndicator — top-bar badge showing count of active workflow runs.
 *
 * Mounted in ShellHeader (P3-07).
 *
 * Two usage modes:
 *   1. Self-contained (no props): owns useActiveWorkflowCount, polls every 30 s.
 *      Used in ShellHeader so every authenticated page shows the badge.
 *   2. Controlled (`activeCount` prop provided): consumes an externally-managed
 *      count (e.g. from useWorkflowRuns on the /workflows page).
 *
 * Behaviour:
 *   - Renders nothing when there are no active runs (zero-noise idle state).
 *   - Shows animated pulse dot + count badge when runs are pending/running.
 *   - Click navigates to /workflows.
 *
 * Design spec §7, Stitch audit §2.1.
 * ARIA: Link with descriptive aria-label; count announced via aria-label.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useActiveWorkflowCount } from "@/hooks/useActiveWorkflowCount";

interface WorkflowTopBarIndicatorProps {
  /**
   * Externally managed active count. When provided, the internal hook is
   * NOT called (controlled mode). When omitted, the component polls for its
   * own count (self-contained mode).
   */
  activeCount?: number;
  className?: string;
}

function WorkflowGridIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
      />
    </svg>
  );
}

/** Inner rendering — separated so the outer can conditionally call the hook. */
function IndicatorInner({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count === 0) return null;

  const label =
    count === 1
      ? "1 active workflow run — view workflows"
      : `${count} active workflow runs — view workflows`;

  return (
    <Link
      href="/workflows"
      aria-label={label}
      className={cn(
        "relative inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
        "border border-blue-200 bg-blue-50 text-blue-700",
        "dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
        "transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/60",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        className,
      )}
    >
      {/* Animated pulse dot */}
      <span aria-hidden="true" className="relative flex size-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
      </span>

      <WorkflowGridIcon />

      {/* Count badge */}
      <span
        aria-hidden="true"
        className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white dark:bg-blue-500"
      >
        {count > 99 ? "99+" : count}
      </span>
    </Link>
  );
}

/** Self-contained variant — owns the poll hook. */
function SelfContainedIndicator({ className }: { className?: string }) {
  const count = useActiveWorkflowCount();
  return <IndicatorInner count={count} className={className} />;
}

/** Controlled variant — uses externally provided count. */
function ControlledIndicator({
  activeCount,
  className,
}: {
  activeCount: number;
  className?: string;
}) {
  return <IndicatorInner count={activeCount} className={className} />;
}

/**
 * WorkflowTopBarIndicator — mount in ShellHeader.
 *
 * No props needed for the default self-contained usage:
 *   <WorkflowTopBarIndicator />
 */
export function WorkflowTopBarIndicator({
  activeCount,
  className,
}: WorkflowTopBarIndicatorProps) {
  if (activeCount !== undefined) {
    return <ControlledIndicator activeCount={activeCount} className={className} />;
  }
  return <SelfContainedIndicator className={className} />;
}
