"use client";

/**
 * /cost-report — LLM Cost Telemetry page (P4-FE-011).
 *
 * Displays aggregate token usage and cost data from the portal backend:
 *   - Summary totals (total tokens, total USD)
 *   - Stage breakdown — proportional bar chart (classify/extract/compile/query)
 *   - Top 20 artifacts by token usage — sortable table linked to /artifact/{id}
 *   - Period selector: 7d / 30d / all-time
 *
 * States: Loading (skeleton), Error (retry), Empty (no data yet).
 *
 * Data: useCostReport (TanStack Query) → GET /api/cost-report?period_days=N.
 *
 * Shell: Standard Archival (single-column, no ContextRail — telemetry data
 * doesn't benefit from a metrics rail repeating the page content).
 *
 * Task: P4-FE-011
 */

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Coins,
  Cpu,
  RefreshCw,
  AlertCircle,
  BarChart3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useCostReport } from "@/hooks/useCostReport";
import { cn } from "@/lib/utils";
import { COST_REPORT_PERIODS } from "@/lib/api/cost";
import type { CostReportPeriod, CostStageRow, CostReportArtifactRow } from "@/lib/api/cost";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatUsd(usd: number | null): string {
  if (usd === null) return "—";
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function formatUsdCents(cents: number | null): string {
  if (cents === null) return "—";
  return formatUsd(cents / 100);
}

/** Human-readable stage labels. */
const STAGE_LABELS: Record<string, string> = {
  classify: "Classify",
  extract: "Extract",
  compile: "Compile",
  query: "Query",
  lint: "Lint",
  profile: "Profile",
};

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.charAt(0).toUpperCase() + stage.slice(1);
}

/** Colour per stage — consistent across bar chart. */
const STAGE_COLOURS: Record<string, string> = {
  classify: "bg-violet-500 dark:bg-violet-400",
  extract: "bg-sky-500 dark:bg-sky-400",
  compile: "bg-amber-500 dark:bg-amber-400",
  query: "bg-emerald-500 dark:bg-emerald-400",
  lint: "bg-rose-500 dark:bg-rose-400",
  profile: "bg-orange-500 dark:bg-orange-400",
};

function stageColour(stage: string): string {
  return STAGE_COLOURS[stage] ?? "bg-muted-foreground/50";
}

// ---------------------------------------------------------------------------
// Skeleton primitives
// ---------------------------------------------------------------------------

function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-muted", className)}
      style={style}
    />
  );
}

// ---------------------------------------------------------------------------
// Period selector
// ---------------------------------------------------------------------------

interface PeriodSelectorProps {
  value: CostReportPeriod;
  onChange: (p: CostReportPeriod) => void;
}

function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <fieldset aria-label="Report period">
      <legend className="sr-only">Report period</legend>
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {COST_REPORT_PERIODS.map(({ label, value: v }) => (
          <label
            key={v}
            className={cn(
              "cursor-pointer select-none rounded-md px-3 py-1 text-xs font-medium transition-colors",
              "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
              value === v
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name="cost-period"
              value={String(v)}
              checked={value === v}
              onChange={() => onChange(v)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}

function SummaryCard({ icon, label, value, sub }: SummaryCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-sm",
        "transition-shadow hover:shadow-md",
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex size-7 items-center justify-center rounded-md bg-muted">
          {icon}
        </span>
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-sm">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage breakdown bar chart
// ---------------------------------------------------------------------------

interface StageBreakdownProps {
  rows: CostStageRow[];
}

function StageBreakdown({ rows }: StageBreakdownProps) {
  const maxTokens = useMemo(
    () => Math.max(1, ...rows.map((r) => r.tokens)),
    [rows],
  );

  if (rows.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No stage data available.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="list" aria-label="Token usage by stage">
      {rows.map((row) => {
        const pct = Math.round((row.tokens / maxTokens) * 100);
        const colour = stageColour(row.stage);

        return (
          <div key={row.stage} role="listitem" className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <span
                  aria-hidden="true"
                  className={cn("inline-block h-2 w-2 shrink-0 rounded-full", colour)}
                />
                {stageLabel(row.stage)}
              </span>
              <span className="flex items-center gap-3 tabular-nums text-muted-foreground">
                <span>{formatTokens(row.tokens)} tok</span>
                <span className="w-12 text-right">{formatUsdCents(row.usd_cents)}</span>
              </span>
            </div>
            <div
              role="meter"
              aria-valuenow={row.tokens}
              aria-valuemin={0}
              aria-valuemax={maxTokens}
              aria-label={`${stageLabel(row.stage)}: ${formatTokens(row.tokens)} tokens`}
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                aria-hidden="true"
                className={cn("h-full rounded-full transition-all duration-500", colour)}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StageBreakdownSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="flex justify-between">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-2 w-full" style={{ width: `${75 - i * 15}%` }} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artifact table sort
// ---------------------------------------------------------------------------

type ArtifactSortField = "tokens" | "usd" | "title";
type SortDir = "asc" | "desc";

interface ArtifactSortState {
  field: ArtifactSortField;
  dir: SortDir;
}

function sortArtifacts(
  rows: CostReportArtifactRow[],
  sort: ArtifactSortState,
): CostReportArtifactRow[] {
  return [...rows].sort((a, b) => {
    let diff = 0;
    if (sort.field === "tokens") diff = a.total_tokens - b.total_tokens;
    else if (sort.field === "usd") {
      diff = (a.total_usd ?? -Infinity) - (b.total_usd ?? -Infinity);
    } else {
      diff = a.title.localeCompare(b.title);
    }
    return sort.dir === "asc" ? diff : -diff;
  });
}

// ---------------------------------------------------------------------------
// Artifact table header cell
// ---------------------------------------------------------------------------

interface SortHeaderProps {
  label: string;
  field: ArtifactSortField;
  sort: ArtifactSortState;
  onSort: (f: ArtifactSortField) => void;
  align?: "left" | "right";
}

function SortHeader({ label, field, sort, onSort, align = "left" }: SortHeaderProps) {
  const isActive = sort.field === field;
  const Icon = isActive
    ? sort.dir === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <th
      scope="col"
      className={cn(
        "py-2 text-[10px] font-semibold uppercase tracking-wider",
        align === "right" ? "pr-4 text-right" : "pl-4 text-left",
      )}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        aria-label={`Sort by ${label} ${isActive && sort.dir === "asc" ? "descending" : "ascending"}`}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "hover:text-foreground",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon aria-hidden="true" className="size-3" />
      </button>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Artifact table
// ---------------------------------------------------------------------------

interface ArtifactTableProps {
  rows: CostReportArtifactRow[];
}

function ArtifactTable({ rows }: ArtifactTableProps) {
  const [sort, setSort] = useState<ArtifactSortState>({
    field: "tokens",
    dir: "desc",
  });

  const sorted = useMemo(() => sortArtifacts(rows, sort), [rows, sort]);

  const handleSort = useCallback(
    (field: ArtifactSortField) => {
      setSort((prev) => ({
        field,
        dir: prev.field === field && prev.dir === "desc" ? "asc" : "desc",
      }));
    },
    [],
  );

  if (rows.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center"
      >
        <BarChart3 aria-hidden="true" className="size-8 text-muted-foreground/30" />
        <p className="text-sm font-medium text-foreground">No artifact data yet</p>
        <p className="text-xs text-muted-foreground">
          Token usage per artifact will appear after compilations run.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full min-w-[480px] border-collapse text-left"
        aria-label="Top artifacts by token cost"
      >
        <thead>
          <tr className="border-b border-border">
            <SortHeader label="Artifact" field="title" sort={sort} onSort={handleSort} />
            <th
              scope="col"
              className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              ID
            </th>
            <SortHeader label="Tokens" field="tokens" sort={sort} onSort={handleSort} align="right" />
            <SortHeader label="Cost" field="usd" sort={sort} onSort={handleSort} align="right" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => (
            <ArtifactRow key={row.artifact_id} row={row} rank={idx + 1} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ArtifactRowProps {
  row: CostReportArtifactRow;
  rank: number;
}

function ArtifactRow({ row, rank }: ArtifactRowProps) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-2.5 pl-4 pr-2">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
              rank <= 3
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-muted text-muted-foreground",
            )}
          >
            {rank}
          </span>
          <Link
            href={`/artifact/${row.artifact_id}`}
            className={cn(
              "max-w-[240px] truncate text-xs font-medium text-foreground",
              "hover:text-primary hover:underline underline-offset-2 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
            )}
            title={row.title}
          >
            {row.title || "(Untitled)"}
          </Link>
        </div>
      </td>
      <td className="px-2 py-2.5">
        <span className="font-mono text-[10px] text-muted-foreground/60">
          …{row.artifact_id.slice(-6)}
        </span>
      </td>
      <td className="px-2 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
        {formatTokens(row.total_tokens)}
      </td>
      <td className="py-2.5 pl-2 pr-4 text-right text-xs tabular-nums text-muted-foreground">
        {formatUsd(row.total_usd)}
      </td>
    </tr>
  );
}

function ArtifactTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex items-center gap-4 px-4 py-2.5"
        >
          <Skeleton className="size-5 rounded-full shrink-0" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-16 ml-auto" />
          <Skeleton className="h-3.5 w-12" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CostReportPage() {
  const [period, setPeriod] = useState<CostReportPeriod>(30);
  const { data, isLoading, isError, error, refetch } = useCostReport(period);

  const isEmpty = !isLoading && !isError && data && data.total_tokens === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl flex-1 flex-col gap-6 p-6">
        {/* ------------------------------------------------------------------ */}
        {/* Page header                                                         */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cost Report</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              LLM token usage and estimated spend for your vault compilations.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Period selector */}
            <PeriodSelector value={period} onChange={setPeriod} />

            {/* Refresh */}
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isLoading}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-xs font-medium sm:h-8 sm:min-h-0",
                "border border-input bg-background text-foreground",
                "transition-colors hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              aria-label="Refresh cost report"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn("size-3.5", isLoading && "animate-spin")}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Error state                                                         */}
        {/* ------------------------------------------------------------------ */}
        {isError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
          >
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-destructive"
            />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-destructive">
                Unable to load cost data
              </p>
              <p className="text-xs text-muted-foreground">
                {error?.message ?? "An unexpected error occurred."}
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                className={cn(
                  "mt-1 self-start text-xs font-medium text-destructive",
                  "hover:underline underline-offset-2 transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
                )}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Empty state                                                         */}
        {/* ------------------------------------------------------------------ */}
        {isEmpty && (
          <div
            role="status"
            className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center"
          >
            <Cpu aria-hidden="true" className="size-10 text-muted-foreground/30" />
            <div>
              <p className="text-base font-medium text-foreground">
                No cost data available
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Run some compilations first — token usage will appear here.
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Summary totals                                                      */}
        {/* ------------------------------------------------------------------ */}
        {!isEmpty && (
          <section aria-labelledby="cost-summary-heading">
            <h2 id="cost-summary-heading" className="sr-only">
              Summary
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isLoading ? (
                <>
                  <SummaryCardSkeleton />
                  <SummaryCardSkeleton />
                </>
              ) : data ? (
                <>
                  <SummaryCard
                    icon={<Cpu aria-hidden="true" className="size-4 text-muted-foreground" />}
                    label="Total tokens"
                    value={formatTokens(data.total_tokens)}
                    sub={`Over last ${data.period_days} day${data.period_days === 1 ? "" : "s"}`}
                  />
                  <SummaryCard
                    icon={<Coins aria-hidden="true" className="size-4 text-muted-foreground" />}
                    label="Estimated cost"
                    value={formatUsd(data.total_usd)}
                    sub={
                      data.total_usd === null
                        ? "Configure pricing to see USD estimates"
                        : `Over last ${data.period_days} day${data.period_days === 1 ? "" : "s"}`
                    }
                  />
                </>
              ) : null}
            </div>
          </section>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Stage breakdown                                                     */}
        {/* ------------------------------------------------------------------ */}
        {!isEmpty && (
          <section aria-labelledby="stage-breakdown-heading">
            <div
              className={cn(
                "rounded-xl border border-border bg-card p-5 shadow-sm",
              )}
            >
              <div className="mb-4 flex items-center gap-2">
                <BarChart3
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <h2
                  id="stage-breakdown-heading"
                  className="text-sm font-semibold tracking-tight"
                >
                  Token Usage by Stage
                </h2>
              </div>
              {isLoading ? (
                <StageBreakdownSkeleton />
              ) : data ? (
                <StageBreakdown rows={data.by_stage} />
              ) : null}
            </div>
          </section>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Top artifacts table                                                 */}
        {/* ------------------------------------------------------------------ */}
        {!isEmpty && (
          <section aria-labelledby="top-artifacts-heading">
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                <h2
                  id="top-artifacts-heading"
                  className="text-sm font-semibold tracking-tight"
                >
                  Top Artifacts by Token Cost
                </h2>
                {data && (
                  <span
                    aria-label={`${data.top_artifacts.length} artifacts`}
                    className={cn(
                      "ml-auto inline-flex items-center rounded-full px-2 py-0.5",
                      "bg-muted text-muted-foreground",
                      "text-[11px] font-medium",
                    )}
                  >
                    {data.top_artifacts.length} shown
                  </span>
                )}
              </div>
              <div className="p-0">
                {isLoading ? (
                  <div className="p-4">
                    <ArtifactTableSkeleton />
                  </div>
                ) : data ? (
                  <ArtifactTable rows={data.top_artifacts} />
                ) : null}
              </div>
            </div>
          </section>
        )}

        {/* Bottom spacer */}
        <div className="h-6" aria-hidden="true" />
      </div>
    </div>
  );
}
