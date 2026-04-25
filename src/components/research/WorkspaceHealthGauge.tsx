"use client";

/**
 * WorkspaceHealthGauge — live SVG arc gauge for the ContextRail.
 *
 * Wires GET /api/research/workspace-health to populate:
 *   - Circle gauge with total_artifacts as primary value.
 *   - by_status breakdown (draft/active/stale/archived) as legend.
 *   - freshness_distribution (current/stale/outdated) as status chips.
 *   - contradiction_count and review_queue_depth as inline counters.
 *
 * Loading: existing skeleton (animate-pulse).
 * Error: "No data" message with a retry button (calls refetch()).
 *
 * WCAG 2.1 AA:
 *   - Section has aria-labelledby pointing to heading.
 *   - SVG gauge has aria-label with human-readable total.
 *   - Status chips have text labels; colour is never sole differentiator.
 *   - Retry button has descriptive aria-label.
 *
 * Portal v1.7 Phase 4 (P4-07).
 */

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceHealth } from "@/hooks/useWorkspaceHealth";
import type { WorkspaceHealthSummary } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// SVG arc helpers
// ---------------------------------------------------------------------------

const GAUGE_R = 36;
const GAUGE_CX = 44;
const GAUGE_CY = 44;
const CIRCUMFERENCE = 2 * Math.PI * GAUGE_R; // ≈ 226.2

/**
 * Compute the SVG strokeDashoffset for a given ratio [0, 1].
 * A full circle is offset 0; empty circle is offset == circumference.
 */
function arcOffset(ratio: number): number {
  return CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, ratio)));
}

// ---------------------------------------------------------------------------
// Loading skeleton (unchanged from P6-03)
// ---------------------------------------------------------------------------

function GaugeSkeleton() {
  return (
    <div
      aria-hidden="true"
      aria-busy="true"
      aria-label="Workspace health gauge loading"
      className="relative flex size-24 items-center justify-center"
    >
      <svg
        viewBox="0 0 88 88"
        className="absolute inset-0 size-full animate-pulse"
        aria-hidden="true"
      >
        <circle
          cx={GAUGE_CX}
          cy={GAUGE_CY}
          r={GAUGE_R}
          fill="none"
          strokeWidth="8"
          className="stroke-muted"
        />
        <circle
          cx={GAUGE_CX}
          cy={GAUGE_CY}
          r={GAUGE_R}
          fill="none"
          strokeWidth="8"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={23}
          strokeLinecap="round"
          transform={`rotate(-90 ${GAUGE_CX} ${GAUGE_CY})`}
          className="stroke-muted-foreground/30"
        />
      </svg>
      <div className="flex flex-col items-center gap-1">
        <div className="h-5 w-10 animate-pulse rounded bg-muted" />
        <div className="h-3 w-8 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatusLegendProps {
  by_status: WorkspaceHealthSummary["by_status"];
}

function StatusLegend({ by_status }: StatusLegendProps) {
  const entries: { label: string; value: number; dotClass: string }[] = [
    { label: "Active", value: by_status.active, dotClass: "bg-emerald-500" },
    { label: "Draft", value: by_status.draft, dotClass: "bg-sky-400" },
    { label: "Stale", value: by_status.stale, dotClass: "bg-amber-400" },
    { label: "Archived", value: by_status.archived, dotClass: "bg-muted-foreground/40" },
  ];

  return (
    <ul className="flex w-full flex-col gap-0.5" aria-label="Artifact status breakdown">
      {entries.map(({ label, value, dotClass }) => (
        <li key={label} className="flex items-center gap-1.5 text-[10px]">
          <span
            aria-hidden="true"
            className={cn("size-2 shrink-0 rounded-full", dotClass)}
          />
          <span className="text-muted-foreground">{label}</span>
          <span className="ml-auto tabular-nums text-foreground/80">{value}</span>
        </li>
      ))}
    </ul>
  );
}

interface FreshnessChipsProps {
  freshness_distribution: WorkspaceHealthSummary["freshness_distribution"];
}

function FreshnessChips({ freshness_distribution }: FreshnessChipsProps) {
  const chips: { label: string; value: number; chipClass: string }[] = [
    {
      label: "Current",
      value: freshness_distribution.current,
      chipClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    {
      label: "Stale",
      value: freshness_distribution.stale,
      chipClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    },
    {
      label: "Outdated",
      value: freshness_distribution.outdated,
      chipClass: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    },
  ];

  return (
    <div
      className="flex w-full flex-wrap gap-1"
      role="list"
      aria-label="Freshness distribution"
    >
      {chips.map(({ label, value, chipClass }) => (
        <span
          key={label}
          role="listitem"
          className={cn(
            "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
            chipClass,
          )}
        >
          {label}
          <span className="tabular-nums opacity-80">{value}</span>
        </span>
      ))}
    </div>
  );
}

interface CounterRowProps {
  contradiction_count: number;
  review_queue_depth: number;
}

function CounterRow({ contradiction_count, review_queue_depth }: CounterRowProps) {
  return (
    <div className="flex w-full justify-between text-[10px]">
      <div className="flex flex-col items-center gap-0.5">
        <span
          className={cn(
            "text-base font-bold tabular-nums leading-none",
            contradiction_count > 0 ? "text-rose-500" : "text-foreground/70",
          )}
          aria-label={`${contradiction_count} contradictions`}
        >
          {contradiction_count}
        </span>
        <span className="text-muted-foreground">Contradictions</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span
          className={cn(
            "text-base font-bold tabular-nums leading-none",
            review_queue_depth > 0 ? "text-amber-500" : "text-foreground/70",
          )}
          aria-label={`${review_queue_depth} in review queue`}
        >
          {review_queue_depth}
        </span>
        <span className="text-muted-foreground">Review Queue</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live gauge
// ---------------------------------------------------------------------------

interface LiveGaugeProps {
  health: WorkspaceHealthSummary;
}

function LiveGauge({ health }: LiveGaugeProps) {
  // The arc represents the share of non-archived artifacts as a proxy for
  // active coverage. Fall back to 1.0 when total is 0 (shows full circle).
  const activeRatio =
    health.total_artifacts > 0
      ? (health.by_status.active + health.by_status.draft) / health.total_artifacts
      : 1;

  const offset = arcOffset(activeRatio);
  const pct = Math.round(activeRatio * 100);

  return (
    <div
      className="relative flex size-24 items-center justify-center"
      aria-label={`Workspace health: ${health.total_artifacts} total artifacts, ${pct}% active or draft`}
    >
      <svg
        viewBox="0 0 88 88"
        className="absolute inset-0 size-full"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={GAUGE_CX}
          cy={GAUGE_CY}
          r={GAUGE_R}
          fill="none"
          strokeWidth="8"
          className="stroke-muted"
        />
        {/* Progress arc */}
        <circle
          cx={GAUGE_CX}
          cy={GAUGE_CY}
          r={GAUGE_R}
          fill="none"
          strokeWidth="8"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${GAUGE_CX} ${GAUGE_CY})`}
          className="stroke-emerald-500 transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      {/* Center label */}
      <div className="flex flex-col items-center">
        <span className="text-lg font-bold tabular-nums leading-none">
          {health.total_artifacts}
        </span>
        <span className="mt-0.5 text-[10px] text-muted-foreground">artifacts</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceHealthGauge
// ---------------------------------------------------------------------------

export interface WorkspaceHealthGaugeProps {
  className?: string;
}

/**
 * Circular gauge for research workspace health, wired to
 * GET /api/research/workspace-health via useWorkspaceHealth().
 *
 * Replaces the P6-03 skeleton placeholder (P4-07).
 */
export function WorkspaceHealthGauge({ className }: WorkspaceHealthGaugeProps) {
  const { health, isLoading, isError, refetch } = useWorkspaceHealth();

  return (
    <section
      aria-labelledby="workspace-health-heading"
      className={cn("flex flex-col items-center gap-3", className)}
    >
      {/* Header */}
      <div className="flex w-full items-center justify-between">
        <h2
          id="workspace-health-heading"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Workspace Health
        </h2>
      </div>

      {/* Gauge */}
      {isLoading && <GaugeSkeleton />}

      {isError && (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 py-2 text-center"
        >
          <span className="text-xs text-muted-foreground">No data</span>
          <button
            type="button"
            onClick={() => refetch()}
            aria-label="Retry loading workspace health"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-medium",
              "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "transition-colors",
            )}
          >
            <RefreshCw aria-hidden="true" className="size-3" />
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && health && (
        <>
          <LiveGauge health={health} />
          <StatusLegend by_status={health.by_status} />
          <FreshnessChips freshness_distribution={health.freshness_distribution} />
          <CounterRow
            contradiction_count={health.contradiction_count}
            review_queue_depth={health.review_queue_depth}
          />
        </>
      )}
    </section>
  );
}
