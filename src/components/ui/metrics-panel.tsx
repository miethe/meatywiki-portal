"use client";

/**
 * MetricsPanel — Card-wrapped metrics display with optional deltas.
 *
 * Extraction-ready: zero portal-domain imports. All props are primitives.
 *
 * Orientations:
 *   stack — vertical list of metric rows (default)
 *   grid  — 2-column grid (expands to 3 at wider breakpoints)
 *
 * Delta rendering:
 *   positive delta → emerald (green) with arrow-up icon
 *   negative delta → rose (red) with arrow-down icon
 *   `tone` prop overrides the semantic default when the caller wants to
 *   invert the meaning (e.g. a drop in error rate is positive).
 */

import * as React from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Metric {
  label: string;
  value: string | number;
  /** +/- percentage. Renders with arrow + colored tone. */
  delta?: number;
  icon?: React.ReactNode;
  /** Overrides automatic positive/negative coloring from delta sign. */
  tone?: "neutral" | "positive" | "negative";
}

export interface MetricsPanelProps {
  metrics: Metric[];
  /** Default: 'stack' */
  orientation?: "stack" | "grid";
  className?: string;
}

function resolveTone(
  delta: number | undefined,
  tone: Metric["tone"],
): "neutral" | "positive" | "negative" {
  if (tone && tone !== "neutral") return tone;
  if (delta === undefined || delta === 0) return "neutral";
  return delta > 0 ? "positive" : "negative";
}

const TONE_CLASSES: Record<"neutral" | "positive" | "negative", string> = {
  neutral: "text-muted-foreground",
  positive:
    "text-emerald-600 dark:text-emerald-400",
  negative:
    "text-rose-600 dark:text-rose-400",
};

interface DeltaIndicatorProps {
  delta: number;
  tone: "neutral" | "positive" | "negative";
}

function DeltaIndicator({ delta, tone }: DeltaIndicatorProps) {
  const toneClass = TONE_CLASSES[tone];
  const Icon =
    delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const sign = delta > 0 ? "+" : "";

  return (
    <span
      aria-label={`${sign}${delta}%`}
      className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium", toneClass)}
    >
      <Icon aria-hidden="true" className="size-3 shrink-0" />
      {sign}{Math.abs(delta)}%
    </span>
  );
}

interface MetricRowProps {
  metric: Metric;
}

function MetricRow({ metric }: MetricRowProps) {
  const { label, value, delta, icon, tone } = metric;
  const resolvedTone = resolveTone(delta, tone);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {icon && (
          <span
            aria-hidden="true"
            className="shrink-0 text-muted-foreground"
          >
            {icon}
          </span>
        )}
        <span className="truncate text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-base font-semibold tabular-nums leading-tight">
          {value}
        </span>
        {delta !== undefined && (
          <DeltaIndicator delta={delta} tone={resolvedTone} />
        )}
      </div>
    </div>
  );
}

export function MetricsPanel({
  metrics,
  orientation = "stack",
  className,
}: MetricsPanelProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div
        className={cn(
          "p-4",
          orientation === "stack"
            ? "flex flex-col gap-4"
            : "grid grid-cols-2 gap-4 sm:grid-cols-3",
        )}
      >
        {metrics.map((metric, index) =>
          orientation === "stack" ? (
            <React.Fragment key={index}>
              <MetricRow metric={metric} />
              {index < metrics.length - 1 && (
                <hr className="border-border" aria-hidden="true" />
              )}
            </React.Fragment>
          ) : (
            <div
              key={index}
              className="flex flex-col gap-1 rounded-md bg-muted/40 p-3"
            >
              {metric.icon && (
                <span
                  aria-hidden="true"
                  className="mb-1 text-muted-foreground"
                >
                  {metric.icon}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{metric.label}</span>
              <span className="text-lg font-semibold tabular-nums leading-tight">
                {metric.value}
              </span>
              {metric.delta !== undefined && (
                <DeltaIndicator
                  delta={metric.delta}
                  tone={resolveTone(metric.delta, metric.tone)}
                />
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
