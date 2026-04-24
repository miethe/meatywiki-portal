/**
 * WorkspaceHealthGauge — circular skeleton gauge for the ContextRail.
 *
 * Renders an SVG circle skeleton animating with `animate-pulse` until
 * the Workspace Health endpoint ships.
 *
 * P6-03: Research Home editorial scaffold (APIs deferred per OQ-2).
 *
 * TODO: wire GET /api/research/workspace-health to populate the gauge
 * with a real score (0–100) and delta value.
 */

import { cn } from "@/lib/utils";

export interface WorkspaceHealthGaugeProps {
  className?: string;
}

/**
 * Circular skeleton gauge for workspace health (planned feature).
 * Replace with real gauge when GET /api/research/workspace-health ships.
 */
export function WorkspaceHealthGauge({ className }: WorkspaceHealthGaugeProps) {
  return (
    <section
      aria-labelledby="workspace-health-heading"
      className={cn("flex flex-col items-center gap-3", className)}
    >
      <div className="flex w-full items-center justify-between">
        <h2
          id="workspace-health-heading"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Workspace Health
        </h2>
        <span
          className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          role="note"
          aria-label="Planned feature"
        >
          Planned
        </span>
      </div>

      {/*
       * TODO: Replace skeleton circle with a real SVG arc gauge driven by
       * GET /api/research/workspace-health.
       * Shape: { score: number; delta: number; label: string }
       * Score 94%, delta +1.2% — design reference from Stitch §4.3.
       */}

      {/* Circular skeleton gauge */}
      <div
        aria-hidden="true"
        aria-busy="true"
        aria-label="Workspace health gauge loading"
        className="relative flex size-24 items-center justify-center"
      >
        {/* Outer circle track */}
        <svg
          viewBox="0 0 88 88"
          className="absolute inset-0 size-full animate-pulse"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="44"
            cy="44"
            r="36"
            fill="none"
            strokeWidth="8"
            className="stroke-muted"
          />
          {/* Progress arc placeholder — fixed partial arc */}
          <circle
            cx="44"
            cy="44"
            r="36"
            fill="none"
            strokeWidth="8"
            strokeDasharray="226 226"
            strokeDashoffset="23"
            strokeLinecap="round"
            transform="rotate(-90 44 44)"
            className="stroke-muted-foreground/30"
          />
        </svg>
        {/* Center text skeleton */}
        <div className="flex flex-col items-center gap-1">
          <div className="h-5 w-10 animate-pulse rounded bg-muted" />
          <div className="h-3 w-8 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* Sub-label */}
      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
    </section>
  );
}
