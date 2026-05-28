"use client";

/**
 * CompletedResearchRuns — displays completed (including failed/abandoned) research runs.
 *
 * Fetches GET /api/research/runs?status=completed on mount.
 * Each card shows: date range, template name, summary preview, artifacts count badge.
 * Click → navigate to /workflows/[runId].
 *
 * Features:
 * - Initial load skeleton (3 ghost cards)
 * - Empty state with a start-research CTA
 * - Inline error banner with retry
 * - "Load more" button for cursor pagination
 * - WCAG 2.1 AA: keyboard-navigable cards, aria-labels, region landmarks
 *
 * P5-05 (portal-research-workflow-realignment-v2-1).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  PackageSearch,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listResearchRuns,
  type WorkflowRunItem,
} from "@/lib/api/research-home";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateRange(
  started_at: string | null,
  completed_at: string | null,
): string {
  if (!started_at && !completed_at) return "—";
  if (!completed_at) return formatDate(started_at);
  if (!started_at) return formatDate(completed_at);
  return `${formatDate(started_at)} – ${formatDate(completed_at)}`;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

type RunStatus = "complete" | "failed" | "abandoned" | string;

interface StatusBadgeProps {
  status: RunStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  if (status === "complete") {
    return (
      <span
        aria-label="Completed"
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
          "text-[10px] font-semibold uppercase tracking-wide",
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
        )}
      >
        <CheckCircle2 aria-hidden="true" className="size-2.5" />
        Done
      </span>
    );
  }

  if (status === "failed" || status === "abandoned") {
    return (
      <span
        aria-label={status === "failed" ? "Failed" : "Abandoned"}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
          "text-[10px] font-semibold uppercase tracking-wide",
          status === "failed"
            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
        )}
      >
        <XCircle aria-hidden="true" className="size-2.5" />
        {status === "failed" ? "Failed" : "Abandoned"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5",
        "text-[10px] font-semibold uppercase tracking-wide",
        "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton cards
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-2 rounded-lg border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="h-3.5 w-3/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-10 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 py-8 text-center">
      <PackageSearch
        aria-hidden="true"
        className="size-7 text-muted-foreground/40"
      />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">
          No completed runs yet
        </p>
        <p className="text-xs text-muted-foreground">
          Completed research runs will appear here.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run card
// ---------------------------------------------------------------------------

interface CompletedRunCardProps {
  run: WorkflowRunItem;
  onClick: (runId: string) => void;
}

function CompletedRunCard({ run, onClick }: CompletedRunCardProps) {
  const shortId = run.run_id.slice(-8);
  const label = `Completed run ${shortId}${run.summary ? ": " + run.summary : ""}`;

  return (
    <article
      aria-label={label}
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border bg-card p-4",
        "transition-colors hover:border-border/80 hover:bg-muted/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Date range */}
          <p className="text-xs font-medium text-muted-foreground">
            {formatDateRange(run.started_at, run.completed_at)}
          </p>

          {/* Template badge */}
          <p className="text-[10px] font-mono text-muted-foreground/70">
            {run.template_id}
          </p>

          {/* Summary preview */}
          {run.summary && (
            <p className="mt-0.5 line-clamp-2 text-sm text-foreground/80">
              {run.summary}
            </p>
          )}
        </div>

        <StatusBadge status={run.status} />
      </div>

      {/* Footer row: artifacts count + navigate button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            aria-label={`${run.artifacts_count} artifact${run.artifacts_count === 1 ? "" : "s"} produced`}
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5",
              "text-[10px] font-semibold",
              "bg-primary/10 text-primary",
            )}
          >
            {run.artifacts_count} artifact{run.artifacts_count === 1 ? "" : "s"}
          </span>
        </div>

        {/* Navigable button — entire card is a focusable affordance */}
        <button
          type="button"
          aria-label={`View run ${shortId} details`}
          onClick={() => onClick(run.run_id)}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-2 py-1",
            "text-[11px] font-medium text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          View
          <ChevronRight aria-hidden="true" className="size-3" />
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CompletedResearchRuns() {
  const router = useRouter();

  const [runs, setRuns] = useState<WorkflowRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchPage = useCallback(
    async (nextCursor: string | null, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const envelope = await listResearchRuns({
          status: "completed",
          cursor: nextCursor,
          limit: 20,
        });

        if (!mountedRef.current) return;

        setRuns((prev) =>
          append ? [...prev, ...envelope.data] : envelope.data,
        );
        setCursor(envelope.cursor);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(
          err instanceof Error ? err.message : "Failed to load completed runs",
        );
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    void fetchPage(null, false);
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunClick = useCallback(
    (runId: string) => {
      router.push(`/workflows/${encodeURIComponent(runId)}`);
    },
    [router],
  );

  const handleLoadMore = useCallback(() => {
    if (cursor) void fetchPage(cursor, true);
  }, [cursor, fetchPage]);

  const handleRetry = useCallback(() => {
    void fetchPage(null, false);
  }, [fetchPage]);

  const hasRuns = runs.length > 0;
  const hasMore = cursor !== null;

  return (
    <section
      aria-label="Completed Research Runs"
      aria-busy={loading}
      className="flex flex-col gap-3"
    >
      {/* Loading skeleton */}
      {loading && !hasRuns && (
        <div
          aria-label="Loading completed runs"
          className="grid gap-3 sm:grid-cols-2"
        >
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error banner */}
      {error && !loading && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          <div className="flex items-center gap-2">
            <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="shrink-0 rounded border border-destructive/30 px-2 py-0.5 text-[10px] font-medium hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !hasRuns && <EmptyState />}

      {/* Run grid */}
      {hasRuns && (
        <div
          aria-label={`${runs.length} completed run${runs.length === 1 ? "" : "s"}`}
          className="grid gap-3 sm:grid-cols-2"
        >
          {runs.map((run) => (
            <CompletedRunCard
              key={run.run_id}
              run={run}
              onClick={handleRunClick}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && !error && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            aria-label="Load more completed runs"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-4 py-1.5",
              "text-xs font-medium text-foreground transition-colors",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </section>
  );
}
