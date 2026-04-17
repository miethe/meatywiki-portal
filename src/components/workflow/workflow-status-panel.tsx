"use client";

/**
 * WorkflowStatusPanel — Active Workflows panel showing running and recent jobs.
 *
 * P3-07: Initial implementation — Active / Recent sections, SSE via RunSSEBridge,
 *   collapsible sections, inline StageTracker expand, loading/error/empty states.
 *
 * P4-08: Enhanced Active Workflows Panel:
 *   - Prominent "Active: N" count badge in header
 *   - Recent window extended to 7 days (see useWorkflowRuns RECENT_HOURS)
 *   - run_id short prefix displayed on each row
 *   - Click-through navigation to /workflows/:runId run detail page
 *   - Responsive two-column grid on >=md for the full variant
 *   - Stage Tracker compact embedded in each row header
 *
 * Stage Tracker compact:
 *   The existing StageTracker already accepts variant="compact" (P3-07 progress
 *   bar style). P4-07 (parallel task) is delivering a timeline dot-style compact
 *   variant. Once P4-07 lands, the compact display here will automatically upgrade
 *   if P4-07 changes the "compact" variant output. If P4-07 instead introduces a
 *   new variant value (e.g. "timeline"), swap the variant prop below.
 *   TODO(P4-07): If stage-tracker.tsx introduces variant="timeline", update
 *   WorkflowRunRow to use variant="timeline" instead of variant="compact".
 *
 * Variants:
 *   "full"    — /workflows page full panel with both sections + two-column grid
 *   "compact" — sidebar widget (active only, max 3 rows, single column)
 *
 * Stitch reference: "Workflows Dashboard" (ID: 4f203d7cc78b4229b71c017c15c055cb).
 * Design spec §7 (workflow status surface), §3.2 (per-screen: row 10).
 */

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { WorkflowRun } from "@/types/artifact";
import { WorkflowStatusBadge } from "@/components/ui/workflow-status-badge";
import { StageTracker } from "./stage-tracker";
import { RunSSEBridge } from "./run-sse-bridge";
import { useWorkflowRuns } from "@/hooks/useWorkflowRuns";

// ---------------------------------------------------------------------------
// Template label map
// ---------------------------------------------------------------------------

const TEMPLATE_LABELS: Record<string, string> = {
  source_ingest_v1: "Source Ingest",
  research_synthesis_v1: "Research Synthesis",
  lint_scope_v1: "Lint Scope",
  compile_v1: "Full Compile",
};

function templateLabel(templateId: string): string {
  return TEMPLATE_LABELS[templateId] ?? templateId;
}

// ---------------------------------------------------------------------------
// Helpers: relative time + short run ID
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/**
 * Returns a short display prefix for a run ID.
 * e.g. "wf-source-ingest-20260417-003" → "…003"
 * Falls back to the last 6 chars for any format.
 */
function shortRunId(runId: string): string {
  // Attempt to extract the trailing sequence segment
  const parts = runId.split("-");
  if (parts.length >= 2) {
    const tail = parts[parts.length - 1];
    // Show up to 6 chars from the tail
    return `…${tail.slice(-6)}`;
  }
  return runId.slice(-6);
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function RunRowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-3 animate-pulse"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="h-3.5 w-28 rounded bg-muted" />
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>
      <div className="h-2.5 w-40 rounded bg-muted" />
      <div className="h-1 w-full rounded-full bg-muted" />
    </div>
  );
}

function LoadingSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading workflow runs" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <RunRowSkeleton key={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chevron icon
// ---------------------------------------------------------------------------

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// External link icon (for click-through to run detail)
// ---------------------------------------------------------------------------

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Single run row (with inline expand + click-through to detail)
// ---------------------------------------------------------------------------

interface WorkflowRunRowProps {
  run: WorkflowRun;
  defaultExpanded?: boolean;
  className?: string;
}

function WorkflowRunRow({ run, defaultExpanded = false, className }: WorkflowRunRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isActive = run.status === "pending" || run.status === "running";
  const label = templateLabel(run.template_id);
  // Prefer started_at; fall back to nothing
  const timeRef = run.started_at ?? null;

  return (
    <div
      className={cn(
        "flex flex-col gap-0 rounded-md border overflow-hidden",
        isActive
          ? "border-blue-200 dark:border-blue-900"
          : "border-border",
        className,
      )}
      data-testid="workflow-run-row"
      data-run-id={run.id}
      data-status={run.status}
    >
      {/* Row header — click to expand/collapse detail */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={`${label} — ${run.status}. ${expanded ? "Collapse" : "Expand"} details.`}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-start gap-2 p-3 text-left",
          "bg-card transition-colors",
          isActive
            ? "hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
            : "hover:bg-muted/50",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        )}
      >
        {/* Left column: label + metadata */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Title row */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{label}</span>
            <WorkflowStatusBadge status={run.status} />
          </div>

          {/* Metadata row: run ID + time */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <code
              className="font-mono rounded bg-muted/60 px-1 py-px"
              title={run.id}
            >
              {shortRunId(run.id)}
            </code>
            {timeRef && <span>{relativeTime(timeRef)}</span>}
            <span>by {run.initiator}</span>
          </div>

          {/* Stage Tracker compact — always visible in row header */}
          {/*
           * TODO(P4-07): When stage-tracker.tsx ships the timeline dot variant,
           * swap variant="compact" for variant="timeline" (or whichever value
           * P4-07 defines) to get the filled/unfilled circle timeline display.
           * The current "compact" renders a progress bar (P3-07 style).
           */}
          <div
            className="mt-1 w-full"
            data-testid="stage-tracker-slot"
          >
            <StageTracker
              runId={run.id}
              templateId={run.template_id}
              status={run.status}
              currentStage={run.current_stage}
              variant="compact"
              mode={isActive ? "sse" : "static"}
            />
          </div>
        </div>

        {/* Right column: expand chevron */}
        <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
          <ChevronIcon open={expanded} />
        </div>
      </button>

      {/* Expandable detail area */}
      {expanded && (
        <div
          className={cn(
            "border-t px-3 py-2.5",
            isActive
              ? "border-blue-100 bg-blue-50/30 dark:border-blue-900/60 dark:bg-blue-950/10"
              : "border-border bg-muted/20",
          )}
        >
          <StageTracker
            runId={run.id}
            templateId={run.template_id}
            status={run.status}
            currentStage={run.current_stage}
            variant="full"
            mode={isActive ? "sse" : "static"}
          />

          {/* Run metadata + click-through link */}
          <div className="mt-2.5 flex items-end justify-between gap-2">
            <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
              <span>
                <span className="font-medium text-foreground/70">Run ID:</span>{" "}
                <code className="font-mono">{run.id}</code>
              </span>
              {run.completed_at && (
                <span>
                  <span className="font-medium text-foreground/70">Completed:</span>{" "}
                  {relativeTime(run.completed_at)}
                </span>
              )}
            </div>

            {/* Click-through to SSE stream / run detail */}
            <Link
              href={`/workflows/${encodeURIComponent(run.id)}`}
              aria-label={`View full details for run ${run.id}`}
              className={cn(
                "group inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium",
                "text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              View run
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section header
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  /** When true, renders the count as a highlighted badge (used for active section). */
  highlight?: boolean;
}

function SectionHeader({ title, count, open, onToggle, highlight = false }: SectionHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "flex w-full items-center justify-between gap-2 py-1",
        "text-xs font-medium uppercase tracking-wider text-muted-foreground",
        "hover:text-foreground transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm",
      )}
    >
      <span>{title}</span>
      <div className="flex items-center gap-1.5">
        {highlight && count > 0 ? (
          <span
            className={cn(
              "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1",
              "text-[10px] font-semibold tabular-nums",
              "bg-blue-600 text-white dark:bg-blue-500",
            )}
            data-testid="active-count-badge"
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : (
          <span className="tabular-nums">{count}</span>
        )}
        <ChevronIcon open={open} />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Active count badge — shown in the panel header (full variant)
// ---------------------------------------------------------------------------

function ActiveCountBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <span
      aria-label={`${count} active workflow${count === 1 ? "" : "s"}`}
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5",
        "text-[11px] font-semibold tabular-nums leading-none",
        "bg-blue-600 text-white dark:bg-blue-500",
        // Pulsing outline to indicate live activity
        "ring-2 ring-blue-300/50 dark:ring-blue-700/60",
      )}
      data-testid="panel-active-count-badge"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Panel variants — the inner controlled rendering
// ---------------------------------------------------------------------------

interface ControlledPanelProps {
  activeRuns: WorkflowRun[];
  recentRuns: WorkflowRun[];
  variant: "full" | "compact";
  applyEvent: ReturnType<typeof useWorkflowRuns>["applyEvent"];
  notifySSEError: ReturnType<typeof useWorkflowRuns>["notifySSEError"];
  isLoading: boolean;
  error: string | null;
  onRefetch: () => void;
  className?: string;
}

function ControlledPanel({
  activeRuns,
  recentRuns,
  variant,
  applyEvent,
  notifySSEError,
  isLoading,
  error,
  onRefetch,
  className,
}: ControlledPanelProps) {
  const [activeOpen, setActiveOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);

  const displayedActiveRuns = variant === "compact" ? activeRuns.slice(0, 3) : activeRuns;
  const totalRuns = activeRuns.length + recentRuns.length;
  const activeCount = activeRuns.length;

  return (
    <section
      aria-label="Active workflows"
      className={cn("flex flex-col gap-3", className)}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className={cn("font-semibold", variant === "full" ? "text-base" : "text-sm")}>
            {variant === "full" ? "Workflows" : "Active Workflows"}
          </h2>
          {/* Prominent active count badge — visible in both variants when active */}
          <ActiveCountBadge count={activeCount} />
        </div>

        {/* Subtitle — only in full variant, only when not loading */}
        {variant === "full" && !isLoading && totalRuns > 0 && (
          <span className="text-xs text-muted-foreground">
            {recentRuns.length > 0 && `${recentRuns.length} recent`}
          </span>
        )}
      </div>

      {/* SSE bridges — one per active run, render-null */}
      {activeRuns.map((run) => (
        <RunSSEBridge
          key={run.id}
          runId={run.id}
          applyEvent={applyEvent}
          notifySSEError={notifySSEError}
        />
      ))}

      {/* Loading state — only show skeleton before first data load */}
      {isLoading && totalRuns === 0 && <LoadingSkeleton />}

      {/* Error state */}
      {!isLoading && error && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50/50 p-3 dark:border-red-900 dark:bg-red-950/20"
        >
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={onRefetch}
            className="self-start text-xs font-medium text-red-600 underline-offset-2 hover:underline dark:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state: no active runs */}
      {!isLoading && !error && activeRuns.length === 0 && (
        <p
          className="text-sm text-muted-foreground"
          data-testid="empty-active"
        >
          No active workflows.
        </p>
      )}

      {/* Active runs section */}
      {displayedActiveRuns.length > 0 && (
        <div className="flex flex-col gap-2">
          {variant === "full" ? (
            <>
              <SectionHeader
                title="Active"
                count={activeRuns.length}
                open={activeOpen}
                onToggle={() => setActiveOpen((v) => !v)}
                highlight
              />
              {activeOpen && (
                /*
                 * Responsive grid: single column on mobile, two columns on >=md.
                 * Two columns only makes sense when there are enough runs to fill
                 * both columns; one-column on <=sm for readability.
                 */
                <div
                  className={cn(
                    "grid gap-2",
                    "grid-cols-1 md:grid-cols-2",
                  )}
                  data-testid="active-runs-grid"
                >
                  {displayedActiveRuns.map((run) => (
                    <WorkflowRunRow key={run.id} run={run} defaultExpanded={false} />
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Compact variant — single column, max 3 */
            <>
              {displayedActiveRuns.map((run) => (
                <WorkflowRunRow key={run.id} run={run} />
              ))}
              {activeRuns.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{activeRuns.length - 3} more active
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Recent runs section — full variant only */}
      {variant === "full" && (
        <>
          {recentRuns.length > 0 ? (
            <div className="flex flex-col gap-2">
              <SectionHeader
                title="Recent (7 days)"
                count={recentRuns.length}
                open={recentOpen}
                onToggle={() => setRecentOpen((v) => !v)}
              />
              {recentOpen && (
                <div
                  className={cn(
                    "grid gap-2",
                    "grid-cols-1 md:grid-cols-2",
                  )}
                  data-testid="recent-runs-grid"
                >
                  {recentRuns.slice(0, 20).map((run) => (
                    <WorkflowRunRow key={run.id} run={run} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Empty recent section — only show once loaded and no error */
            !isLoading && !error && (
              <p
                className="text-sm text-muted-foreground"
                data-testid="empty-recent"
              >
                No recent runs in the last 7 days.
              </p>
            )
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Public export — self-contained version (owns useWorkflowRuns)
// ---------------------------------------------------------------------------

interface WorkflowStatusPanelProps {
  /** "full" — /workflows page; "compact" — sidebar widget */
  variant?: "full" | "compact";
  className?: string;
  /**
   * When provided, the panel operates in controlled mode using the supplied
   * data instead of fetching its own (used when the parent already owns
   * the hook, e.g. to share activeCount with the top-bar indicator).
   */
  controlled?: {
    activeRuns: WorkflowRun[];
    recentRuns: WorkflowRun[];
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    applyEvent: ReturnType<typeof useWorkflowRuns>["applyEvent"];
    notifySSEError: ReturnType<typeof useWorkflowRuns>["notifySSEError"];
  };
}

export function WorkflowStatusPanel({
  variant = "compact",
  className,
  controlled,
}: WorkflowStatusPanelProps) {
  // Self-contained mode — own the hook
  const ownHook = useWorkflowRuns();

  const {
    activeRuns,
    recentRuns,
    isLoading,
    error,
    refetch,
    applyEvent,
    notifySSEError,
  } = controlled ?? ownHook;

  return (
    <ControlledPanel
      activeRuns={activeRuns}
      recentRuns={recentRuns}
      variant={variant}
      applyEvent={applyEvent}
      notifySSEError={notifySSEError}
      isLoading={isLoading}
      error={error}
      onRefetch={refetch}
      className={className}
    />
  );
}
