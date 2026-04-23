"use client";

/**
 * /workflows — Workflows Dashboard (P6-02 Stitch reskin).
 *
 * Layout: two-column (main | ContextRail) per §4.6 design spec.
 *
 * Main column:
 *   1. Page header — "Workflows" heading + "New Initiation" page-level CTA +
 *      existing top-bar "Create Workflow" (InitiationWizardDialog).
 *   2. Active Workflows section — 2 side-by-side ActiveWorkflowCards
 *      (horizontal scroll overflow on mobile).
 *   3. Historical Workflows — dense table (Name / Fidelity / Cost / Completion Date).
 *
 * Right ContextRail (ContextRailProvider → ContextRail):
 *   - MetricsPanel: Total Runs, Success Rate (+delta), Avg Duration,
 *     Resource Intensity gauge.
 *   - AutomatedDiscovery promo card.
 *
 * OQ-5 resolution: /workflows/metrics endpoint assumed missing.
 * Metrics are computed client-side from the runs list returned by
 * /api/workflows/runs?limit=100:
 *   - Total Runs     = all.length
 *   - Success Rate   = complete / total * 100
 *   - Avg Duration   = mean(completed_at - started_at) for completed runs
 *   - Resource Intensity = 68% placeholder (TODO v1.6: wire telemetry endpoint)
 *
 * SSE pool cleanup on route leave (Stage Tracker manifest §2.4).
 *
 * Stitch reference: "Workflows Dashboard" (§4.6,
 *   ID: 4f203d7cc78b4229b71c017c15c055cb)
 * Shell: Standard Archival (per audit §3.2 row 10)
 * Task: P6-02 (portal-v1.5-stitch-reskin)
 *
 * DP notes:
 *   - Keep existing WorkflowStatusPanel for backward compatibility — page now
 *     composes it inside the "historical" section (recentRuns).
 *   - Active section uses new ActiveWorkflowCard; SSE bridge kept for live updates.
 *   - "Create Workflow" CTA stays as InitiationWizardDialog (top-bar slot).
 */

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Activity, CheckCircle2, Clock, Zap, ChevronRight } from "lucide-react";
import { useWorkflowRuns } from "@/hooks/useWorkflowRuns";
import { ActiveWorkflowCard } from "@/components/workflow/active-workflow-card";
import { InitiationWizardDialog } from "@/components/workflow/initiation-wizard";
import { RunSSEPoolBridge } from "@/components/workflow/run-sse-pool-bridge";
import { MetricsPanel } from "@/components/ui/metrics-panel";
import { ContextRail } from "@/components/ui/context-rail";
import { ContextRailProvider, useContextRailToggle } from "@/components/ui/context-rail-context";
import { WorkflowStatusBadge } from "@/components/ui/workflow-status-badge";
import { ssePool } from "@/lib/sse/pool";
import { cn } from "@/lib/utils";
import type { WorkflowRun } from "@/types/artifact";
import type { RailSection } from "@/components/ui/context-rail";

// ---------------------------------------------------------------------------
// Metrics computation (OQ-5: client-side aggregation)
// ---------------------------------------------------------------------------

interface ComputedMetrics {
  totalRuns: number;
  successRate: number;
  successRateDelta: number;
  avgDurationMs: number | null;
}

function computeMetrics(runs: WorkflowRun[]): ComputedMetrics {
  const total = runs.length;
  if (total === 0) {
    return { totalRuns: 0, successRate: 0, successRateDelta: 0, avgDurationMs: null };
  }

  const successful = runs.filter((r) => r.status === "complete").length;
  const successRate = Math.round((successful / total) * 1000) / 10; // 1 decimal

  // Delta: compare last-half vs first-half of runs (sorted by started_at desc)
  const sorted = [...runs].sort((a, b) => {
    const ta = a.started_at ? new Date(a.started_at).getTime() : 0;
    const tb = b.started_at ? new Date(b.started_at).getTime() : 0;
    return tb - ta;
  });
  const half = Math.max(1, Math.floor(sorted.length / 2));
  const recent = sorted.slice(0, half);
  const older = sorted.slice(half);
  const recentRate = recent.filter((r) => r.status === "complete").length / recent.length;
  const olderRate = older.length > 0
    ? older.filter((r) => r.status === "complete").length / older.length
    : recentRate;
  const successRateDelta = Math.round((recentRate - olderRate) * 1000) / 10;

  // Avg duration from completed runs with both timestamps
  const durations = runs
    .filter((r) => r.status === "complete" && r.started_at && r.completed_at)
    .map((r) => new Date(r.completed_at!).getTime() - new Date(r.started_at!).getTime());
  const avgDurationMs =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null;

  return { totalRuns: total, successRate, successRateDelta, avgDurationMs };
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

// ---------------------------------------------------------------------------
// Resource Intensity Gauge
// ---------------------------------------------------------------------------

interface ResourceIntensityGaugeProps {
  /** 0–100 percent */
  value: number;
  className?: string;
}

function ResourceIntensityGauge({ value, className }: ResourceIntensityGaugeProps) {
  const clamped = Math.min(100, Math.max(0, value));
  // Colour: green <50, amber 50–80, rose >80
  const barColour =
    clamped < 50
      ? "bg-emerald-500 dark:bg-emerald-400"
      : clamped < 80
        ? "bg-amber-500 dark:bg-amber-400"
        : "bg-rose-500 dark:bg-rose-400";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Resource Intensity</span>
        <span className="font-semibold tabular-nums">{clamped}%</span>
      </div>
      <div
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Resource intensity: ${clamped}%`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          aria-hidden="true"
          className={cn("h-full rounded-full transition-all", barColour)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Automated Discovery promo card
// ---------------------------------------------------------------------------

function AutomatedDiscoveryCard() {
  return (
    <div
      aria-label="Automated Discovery"
      className={cn(
        "rounded-lg border border-border bg-muted/60 dark:bg-muted/40 p-4",
        "flex flex-col gap-2",
      )}
    >
      <div className="flex items-center gap-2">
        <Zap
          aria-hidden="true"
          className="size-3.5 shrink-0 text-amber-500 dark:text-amber-400"
        />
        <span className="text-xs font-semibold text-foreground">Auto-sync ready</span>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Automated Discovery monitors your vault for new captures and queues ingest
        workflows automatically. Configure sources in Settings.
      </p>
      <Link
        href="/settings/workflow-templates"
        className={cn(
          "inline-flex items-center gap-1 self-start text-[11px] font-medium text-primary",
          "hover:text-primary/80 underline-offset-2 hover:underline transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
        )}
      >
        Configure
        <ChevronRight aria-hidden="true" className="size-3" />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Historical Workflows table
// ---------------------------------------------------------------------------

interface HistoricalWorkflowRowProps {
  run: WorkflowRun;
}

function HistoricalWorkflowRow({ run }: HistoricalWorkflowRowProps) {
  const completionDate = run.completed_at
    ? new Date(run.completed_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  const durationMs =
    run.started_at && run.completed_at
      ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
      : null;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-2.5 pl-4 pr-2">
        <Link
          href={`/workflows/${run.id}`}
          className={cn(
            "text-xs font-medium text-foreground truncate max-w-[160px] inline-block",
            "hover:text-primary hover:underline underline-offset-2 transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
          )}
        >
          {TEMPLATE_LABELS[run.template_id] ?? run.template_id}
        </Link>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">
          …{run.id.slice(-6)}
        </p>
      </td>
      <td className="px-2 py-2.5 text-xs text-muted-foreground capitalize">
        {run.workspace}
      </td>
      <td className="px-2 py-2.5">
        <WorkflowStatusBadge status={run.status} />
      </td>
      <td className="px-2 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
        {formatDuration(durationMs)}
      </td>
      <td className="py-2.5 pl-2 pr-4 text-right text-xs text-muted-foreground">
        {completionDate}
      </td>
    </tr>
  );
}

const TEMPLATE_LABELS: Record<string, string> = {
  source_ingest_v1: "Source Ingest",
  research_synthesis_v1: "Research Synthesis",
  lint_scope_v1: "Lint Scope",
  compile_v1: "Full Compile",
};

// ---------------------------------------------------------------------------
// Active Workflows section
// ---------------------------------------------------------------------------

interface ActiveWorkflowsSectionProps {
  activeRuns: WorkflowRun[];
  isLoading: boolean;
}

function ActiveWorkflowsSection({ activeRuns, isLoading }: ActiveWorkflowsSectionProps) {
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-1">
        {[0, 1].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className="h-[148px] w-[220px] shrink-0 animate-pulse rounded-lg border border-border bg-muted"
          />
        ))}
      </div>
    );
  }

  if (activeRuns.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-2.5 rounded-lg border border-dashed py-10 text-center"
      >
        <Activity
          aria-hidden="true"
          className="size-8 text-muted-foreground/30"
        />
        <div>
          <p className="text-sm font-medium text-foreground">No active runs</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Initiate a workflow to see it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    /* Horizontal scroll on mobile (<768px); side-by-side on ≥768px */
    <div
      role="list"
      aria-label="Active workflows"
      className={cn(
        "flex gap-4 overflow-x-auto pb-1",
        // Snap to card boundaries for smooth scrolling on mobile
        "snap-x snap-mandatory",
        // On md+: wrap naturally (2 cards side by side)
        "md:flex-wrap md:overflow-x-visible",
      )}
    >
      {activeRuns.slice(0, 6).map((run) => (
        <div
          key={run.id}
          role="listitem"
          className={cn(
            "snap-start shrink-0",
            // Mobile: fixed card width; md+: grow to fill half of available space
            "w-[260px] md:w-[calc(50%-0.5rem)] md:min-w-[220px]",
          )}
        >
          <ActiveWorkflowCard run={run} className="h-full" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Historical Workflows section
// ---------------------------------------------------------------------------

interface HistoricalWorkflowsSectionProps {
  recentRuns: WorkflowRun[];
  isLoading: boolean;
}

function HistoricalWorkflowsSection({
  recentRuns,
  isLoading,
}: HistoricalWorkflowsSectionProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className="h-10 animate-pulse rounded border border-border bg-muted"
          />
        ))}
      </div>
    );
  }

  if (recentRuns.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center"
      >
        <Clock aria-hidden="true" className="size-6 text-muted-foreground/30" />
        <p className="text-sm font-medium text-foreground">No completed workflows yet</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Completed runs appear here within 7 days.
        </p>
      </div>
    );
  }

  return (
    /* Horizontally scrollable on mobile */
    <div className="overflow-x-auto">
      <table
        className="w-full min-w-[480px] border-collapse text-left"
        aria-label="Historical workflows"
      >
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="py-2 pl-4 pr-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Name
            </th>
            <th scope="col" className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workspace
            </th>
            <th scope="col" className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </th>
            <th scope="col" className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Duration
            </th>
            <th scope="col" className="py-2 pl-2 pr-4 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Completion Date
            </th>
          </tr>
        </thead>
        <tbody>
          {recentRuns.map((run) => (
            <HistoricalWorkflowRow key={run.id} run={run} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context Rail content
// ---------------------------------------------------------------------------

interface WorkflowsRailContentProps {
  allRuns: WorkflowRun[];
}

function WorkflowsRailContent({ allRuns }: WorkflowsRailContentProps) {
  const { totalRuns, successRate, successRateDelta, avgDurationMs } =
    useMemo(() => computeMetrics(allRuns), [allRuns]);

  const metrics = useMemo(
    () => [
      {
        label: "Total Runs",
        value: totalRuns.toLocaleString(),
        icon: <Activity aria-hidden="true" className="size-3.5" />,
      },
      {
        label: "Success Rate",
        value: `${successRate}%`,
        delta: successRateDelta !== 0 ? successRateDelta : undefined,
        tone: "positive" as const,
        icon: <CheckCircle2 aria-hidden="true" className="size-3.5" />,
      },
      {
        label: "Avg Duration",
        value: formatDuration(avgDurationMs),
        icon: <Clock aria-hidden="true" className="size-3.5" />,
      },
    ],
    [totalRuns, successRate, successRateDelta, avgDurationMs],
  );

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-2">
      {/* Metrics panel */}
      <MetricsPanel metrics={metrics} orientation="stack" />

      {/* Resource Intensity gauge
          TODO v1.6: replace 68% placeholder with real telemetry endpoint.
          OQ-5: /workflows/metrics endpoint not shipped. Using fixed placeholder. */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <ResourceIntensityGauge value={68} />
        <p className="mt-2 text-[10px] text-muted-foreground/60">
          Placeholder — telemetry endpoint coming in v1.6
        </p>
      </div>

      {/* Automated Discovery card */}
      <AutomatedDiscoveryCard />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner page (requires ContextRailProvider in scope)
// ---------------------------------------------------------------------------

function WorkflowsPageInner() {
  const workflowHook = useWorkflowRuns();
  const { activeRuns, recentRuns, isLoading, error, refetch, applyEvent, notifySSEError } =
    workflowHook;
  useContextRailToggle();

  // All runs (active + recent) for metrics computation
  const allRuns = useMemo(
    () => [...activeRuns, ...recentRuns],
    [activeRuns, recentRuns],
  );

  // Stage Tracker manifest §2.4: close all pool connections on route leave.
  useEffect(() => {
    return () => {
      ssePool.closeAll();
    };
  }, []);

  // Rail sections
  const railSections: RailSection[] = useMemo(
    () => [
      {
        id: "metrics",
        title: "Metrics",
        variant: "metrics" as const,
        content: <WorkflowsRailContent allRuns={allRuns} />,
      },
    ],
    [allRuns],
  );

  return (
    <div className="flex min-h-0 flex-1 gap-0">
      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isLoading
                ? "Loading…"
                : activeRuns.length > 0
                  ? `${activeRuns.length} active run${activeRuns.length === 1 ? "" : "s"}`
                  : "No active runs"}
            </p>
          </div>

          {/* CTAs: "New Initiation" (page-level) + InitiationWizardDialog (top bar) */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Page-level "New Initiation" CTA per Stitch §4.6 */}
            <button
              type="button"
              onClick={() => void refetch()}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-xs font-medium sm:h-8 sm:min-h-0",
                "border border-input bg-background text-foreground",
                "transition-colors hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
              aria-label="Refresh workflow list"
            >
              Refresh
            </button>

            {/* "New Initiation" primary page-level CTA */}
            <InitiationWizardDialog />
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <span className="font-medium">Failed to load workflows:</span>
            <span>{error}</span>
          </div>
        )}

        {/* SSE bridges — one per active run (RunSSEPoolBridge is per-run) */}
        {!isLoading &&
          activeRuns.map((run) => (
            <RunSSEPoolBridge
              key={run.id}
              runId={run.id}
              isActive
              applyEvent={applyEvent}
              notifySSEError={notifySSEError}
            />
          ))}

        {/* Active Workflows section */}
        <section aria-labelledby="active-workflows-heading">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2
              id="active-workflows-heading"
              className="text-base font-semibold tracking-tight"
            >
              Active Workflows
            </h2>
            {activeRuns.length > 0 && (
              <span
                aria-label={`${activeRuns.length} active`}
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5",
                  "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
                  "text-[11px] font-medium",
                )}
              >
                {activeRuns.length} active
              </span>
            )}
          </div>
          <ActiveWorkflowsSection
            activeRuns={activeRuns}
            isLoading={isLoading}
          />
        </section>

        {/* Historical Workflows section */}
        <section aria-labelledby="historical-workflows-heading">
          <h2
            id="historical-workflows-heading"
            className="mb-3 text-base font-semibold tracking-tight"
          >
            Historical Workflows
          </h2>
          <HistoricalWorkflowsSection
            recentRuns={recentRuns}
            isLoading={isLoading}
          />
        </section>
      </div>

      {/* Right ContextRail — inline at xl, controlled by toggle below xl */}
      <ContextRail
        title="Metrics"
        sections={railSections}
        collapsible
        width={320}
        className="sticky top-0 self-start max-h-screen"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export — wraps inner page with ContextRailProvider
// ---------------------------------------------------------------------------

export default function WorkflowsPage() {
  return (
    <ContextRailProvider defaultOpen={false}>
      <WorkflowsPageInner />
    </ContextRailProvider>
  );
}
