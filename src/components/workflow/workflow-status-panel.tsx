"use client";

/**
 * WorkflowStatusPanel — sidebar/panel showing active and recent workflow runs.
 *
 * P3-07: Fully wired with:
 *   - Live data via useWorkflowRuns (GET /api/workflows/runs, last 24 h)
 *   - SSE subscription per active run via RunSSEBridge
 *   - Collapsible Active / Recent sections
 *   - Inline expand → full StageTracker on row click
 *   - Loading skeleton, error state, empty state
 *
 * Variants:
 *   "full"    — /workflows page full panel with both sections
 *   "compact" — sidebar widget (active only, max 3 rows)
 *
 * Stitch reference: "Workflows Dashboard" (ID: 4f203d7cc78b4229b71c017c15c055cb).
 * Design spec §7 (workflow status surface), §3.2 (per-screen: row 10).
 */

import { useState } from "react";
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
// Helpers: relative time
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
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
// Single run row (with inline expand)
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
  const startedAt = run.started_at ? relativeTime(run.started_at) : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-0 rounded-md border overflow-hidden",
        isActive
          ? "border-blue-200 dark:border-blue-900"
          : "border-border",
        className,
      )}
    >
      {/* Row header — click to expand/collapse */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={`${label} — ${run.status}. ${expanded ? "Collapse" : "Expand"} details.`}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 p-3 text-left",
          "bg-card transition-colors",
          isActive
            ? "hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
            : "hover:bg-muted/50",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{label}</span>
            <WorkflowStatusBadge status={run.status} />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>By {run.initiator}</span>
            {startedAt && <span>{startedAt}</span>}
          </div>
        </div>

        {/* Compact stage bar (always visible) */}
        <div className="w-20 shrink-0">
          <StageTracker
            runId={run.id}
            templateId={run.template_id}
            status={run.status}
            currentStage={run.current_stage}
            variant="compact"
            mode={isActive ? "sse" : "static"}
          />
        </div>

        <ChevronIcon open={expanded} />
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
          <div className="mt-2.5 flex flex-col gap-0.5 text-[11px] text-muted-foreground">
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
}

function SectionHeader({ title, count, open, onToggle }: SectionHeaderProps) {
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
      <div className="flex items-center gap-1">
        <span className="tabular-nums">{count}</span>
        <ChevronIcon open={open} />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Panel variants
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

  return (
    <section
      aria-label="Workflow status"
      className={cn("flex flex-col gap-3", className)}
    >
      {/* Section title */}
      <div className="flex items-center justify-between">
        <h2 className={cn("font-semibold", variant === "full" ? "text-base" : "text-sm")}>
          Workflows
        </h2>
        {!isLoading && totalRuns > 0 && (
          <span className="text-xs text-muted-foreground">
            {activeRuns.length} active · {recentRuns.length} recent
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

      {/* Loading state */}
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

      {/* Empty state */}
      {!isLoading && !error && totalRuns === 0 && (
        <p className="text-sm text-muted-foreground">No active workflows.</p>
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
              />
              {activeOpen &&
                displayedActiveRuns.map((run) => (
                  <WorkflowRunRow key={run.id} run={run} defaultExpanded={false} />
                ))}
            </>
          ) : (
            displayedActiveRuns.map((run) => (
              <WorkflowRunRow key={run.id} run={run} />
            ))
          )}
          {variant === "compact" && activeRuns.length > 3 && (
            <p className="text-xs text-muted-foreground">
              +{activeRuns.length - 3} more active
            </p>
          )}
        </div>
      )}

      {/* Recent runs section — full variant only */}
      {variant === "full" && recentRuns.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionHeader
            title="Recent (24 h)"
            count={recentRuns.length}
            open={recentOpen}
            onToggle={() => setRecentOpen((v) => !v)}
          />
          {recentOpen &&
            recentRuns.slice(0, 20).map((run) => (
              <WorkflowRunRow key={run.id} run={run} />
            ))}
        </div>
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
