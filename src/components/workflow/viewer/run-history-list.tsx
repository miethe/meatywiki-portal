"use client";

/**
 * RunHistoryList — previous runs of the same template (Panel D).
 *
 * Renders the list of prior runs fetched from GET /api/workflows/runs?template_id=X.
 * Each row shows: run ID, status badge, started_at relative time.
 * A "Re-run" button at the top POSTs to /api/workflows to enqueue a new run.
 *
 * Design reference: workflow-viewer-screen-b.html — sidebar / run history region.
 * Adapted to shadcn/ui card style (not a literal port).
 *
 * FR-1.5-07 (P1.5-2-02).
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { WorkflowStatusBadge } from "@/components/ui/workflow-status-badge";
import type { WorkflowRun } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Short run ID
// ---------------------------------------------------------------------------

function shortRunId(id: string): string {
  const parts = id.split("-");
  const tail = parts[parts.length - 1] ?? id;
  return `…${tail.slice(-6)}`;
}

// ---------------------------------------------------------------------------
// Row skeleton
// ---------------------------------------------------------------------------

function RowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-between gap-2 rounded-md px-3 py-2.5 animate-pulse"
    >
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="h-4 w-16 rounded-full bg-muted" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Re-run icon
// ---------------------------------------------------------------------------

function ReRunIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Single run row
// ---------------------------------------------------------------------------

interface RunRowProps {
  run: WorkflowRun;
  isCurrent: boolean;
}

function RunRow({ run, isCurrent }: RunRowProps) {
  return (
    <li>
      <Link
        href={`/workflows/${encodeURIComponent(run.id)}`}
        aria-label={`Run ${run.id}: ${run.status}, started ${relativeTime(run.started_at)}`}
        aria-current={isCurrent ? "page" : undefined}
        className={cn(
          "flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm",
          "transition-colors hover:bg-muted/60",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          isCurrent && "bg-muted",
        )}
        data-testid="run-history-row"
        data-run-id={run.id}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <code className="font-mono text-[11px] text-muted-foreground">
            {shortRunId(run.id)}
          </code>
          <span className="text-[11px] text-muted-foreground">
            {relativeTime(run.started_at)}
          </span>
        </div>
        <WorkflowStatusBadge status={run.status} />
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

interface RunHistoryListProps {
  runs: WorkflowRun[];
  currentRunId: string;
  isLoading: boolean;
  isReRunning: boolean;
  error: string | null;
  reRunError: string | null;
  onReRun: () => void;
  className?: string;
}

export function RunHistoryList({
  runs,
  currentRunId,
  isLoading,
  isReRunning,
  error,
  reRunError,
  onReRun,
  className,
}: RunHistoryListProps) {
  return (
    <section
      aria-label="Run history"
      className={cn("rounded-xl border border-border bg-card", className)}
    >
      {/* Header + Re-run button */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Run History</h3>
        <button
          type="button"
          onClick={onReRun}
          disabled={isReRunning}
          aria-label="Re-run this workflow template"
          data-testid="rerun-button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
            "border border-input bg-background text-foreground",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:pointer-events-none disabled:opacity-50",
            isReRunning && "animate-pulse",
          )}
        >
          <ReRunIcon />
          {isReRunning ? "Queuing…" : "Re-run"}
        </button>
      </div>

      {/* Re-run error */}
      {reRunError && (
        <p
          role="alert"
          className="px-4 py-2 text-xs text-red-600 dark:text-red-400"
        >
          {reRunError}
        </p>
      )}

      {/* Body */}
      <div className="p-2">
        {isLoading && runs.length === 0 ? (
          <div aria-busy="true" aria-label="Loading run history">
            {Array.from({ length: 4 }, (_, i) => <RowSkeleton key={i} />)}
          </div>
        ) : error ? (
          <p role="alert" className="px-3 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : runs.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No previous runs found.
          </p>
        ) : (
          <ul
            role="list"
            aria-label="Previous runs"
            className="flex flex-col gap-0.5"
          >
            {runs.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                isCurrent={run.id === currentRunId}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
