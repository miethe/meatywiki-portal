"use client";

/**
 * /workflows/ops — Workflow OS Screen C: Operations Dashboard (P2-4-07)
 *
 * Aesthetic: industrial monitoring terminal — near-dark slate ground, amber
 * telemetry accents, mono-spaced stat numerals, tight uniform grid.
 * Designed to feel like a real-time ops console sitting inside the Portal shell.
 *
 * Sections:
 *   1. Filter bar  — template / status dropdowns + date-range input + reset
 *   2. Metric strip — success rate, p95 latency, queue depth, 7-day total
 *   3. In-progress queue — run cards with progress arc + live badge
 *   4. Completed runs table — last 20 runs, checkbox selection, bulk actions
 *
 * API:
 *   GET  /api/workflows/dashboard          → WorkflowDashboardResponse
 *   POST /api/workflows/runs/bulk-action   → BulkActionResult
 *
 * Live: 30-second poll while in_progress_queue is non-empty.
 */

import {
  useState,
  useMemo,
  useCallback,
  useTransition,
  useId,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  RotateCcw,
  XCircle,
  CheckCircle2,
  Clock,
  Gauge,
  Layers,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowDashboard } from "@/hooks/useWorkflowDashboard";
import { WorkflowStatusBadge } from "@/components/ui/workflow-status-badge";
import type { WorkflowRun, WorkflowRunStatus } from "@/types/artifact";
import type { AvailableFilters } from "@/lib/api/workflow-dashboard";

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMPLATE_LABELS: Record<string, string> = {
  source_ingest_v1: "Source Ingest",
  research_synthesis_v1: "Research Synthesis",
  lint_scope_v1: "Lint Scope",
  compile_v1: "Full Compile",
};

const STATUS_LABELS: Record<WorkflowRunStatus, string> = {
  pending: "Queued",
  running: "Running",
  paused: "Paused",
  complete: "Complete",
  failed: "Failed",
  abandoned: "Abandoned",
};

const STAGE_NAMES: Record<number, string> = {
  0: "Init",
  1: "Ingest",
  2: "Map",
  3: "Extract",
  4: "Compile",
  5: "Lint",
};

const STAGE_COUNT = 6;

// ─── Utility helpers ──────────────────────────────────────────────────────────

function fmt(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}m ${sec}s`;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const delta = Date.now() - new Date(iso).getTime();
  const s = Math.floor(delta / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationMs(run: WorkflowRun): number | null {
  if (!run.started_at || !run.completed_at) return null;
  return new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
}

// ─── Filter state ─────────────────────────────────────────────────────────────

interface FilterState {
  templateId: string;
  status: string;
  createdAfter: string;
}

const EMPTY_FILTERS: FilterState = { templateId: "", status: "", createdAfter: "" };

function applyFilters(runs: WorkflowRun[], filters: FilterState): WorkflowRun[] {
  return runs.filter((r) => {
    if (filters.templateId && r.template_id !== filters.templateId) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.createdAfter) {
      const cutoff = new Date(filters.createdAfter).getTime();
      const ts = r.created_at ?? r.started_at;
      if (!ts || new Date(ts).getTime() < cutoff) return false;
    }
    return true;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// ── Progress arc SVG ──

interface ProgressArcProps {
  stage: number | null | undefined;
  totalStages?: number;
  status: WorkflowRunStatus;
  size?: number;
}

function ProgressArc({
  stage,
  totalStages = STAGE_COUNT,
  status,
  size = 48,
}: ProgressArcProps) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const progress = stage != null ? Math.min((stage + 1) / totalStages, 1) : 0;
  const dash = circ * progress;

  const arcColour =
    status === "complete"
      ? "#10b981" // emerald-500
      : status === "failed"
        ? "#f43f5e" // rose-500
        : status === "running"
          ? "#f59e0b" // amber-500
          : "#64748b"; // slate-500

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Stage ${(stage ?? 0) + 1} of ${totalStages}`}
      className="shrink-0 -rotate-90"
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        className="text-slate-700"
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={arcColour}
        strokeWidth={3}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />
    </svg>
  );
}

// ── Stat chip ──

interface StatChipProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  tone?: "neutral" | "success" | "warn" | "danger";
  loading?: boolean;
}

function StatChip({ icon, label, value, subValue, tone = "neutral", loading }: StatChipProps) {
  const toneClasses = {
    neutral: "text-slate-200",
    success: "text-emerald-400",
    warn: "text-amber-400",
    danger: "text-rose-400",
  }[tone];

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-slate-700/60 bg-slate-800/70 p-4",
        "backdrop-blur-sm",
      )}
    >
      <div className="flex items-center gap-2 text-slate-400">
        <span className="size-3.5 shrink-0">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest">
          {label}
        </span>
      </div>
      {loading ? (
        <div className="h-7 w-16 animate-pulse rounded bg-slate-700" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className={cn("font-mono text-2xl font-bold tabular-nums leading-none", toneClasses)}>
            {value}
          </span>
          {subValue && (
            <span className="text-[11px] text-slate-500">{subValue}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Queue card ──

interface QueueCardProps {
  run: WorkflowRun;
}

function QueueCard({ run }: QueueCardProps) {
  const label = TEMPLATE_LABELS[run.template_id] ?? run.template_id;
  const stageName = run.current_stage != null ? STAGE_NAMES[run.current_stage] ?? `Step ${run.current_stage + 1}` : "Pending";
  const elapsed = run.started_at
    ? fmt(Date.now() - new Date(run.started_at).getTime())
    : "—";

  return (
    <article
      aria-label={`Queue: ${label}`}
      className={cn(
        "flex items-start gap-4 rounded-lg border border-slate-700/60 bg-slate-800/50 p-4",
        "transition-colors hover:border-slate-600 hover:bg-slate-800",
      )}
    >
      {/* Arc */}
      <ProgressArc
        stage={run.current_stage}
        status={run.status}
        size={52}
      />

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">{label}</p>
            <p className="mt-0.5 font-mono text-[10px] text-slate-500">
              {run.id.slice(-8)}
            </p>
          </div>
          <WorkflowStatusBadge status={run.status} className="shrink-0" />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-x-3 text-[11px]">
          <div>
            <span className="block text-slate-500">Stage</span>
            <span className="font-medium text-slate-300">{stageName}</span>
          </div>
          <div>
            <span className="block text-slate-500">Elapsed</span>
            <span className="font-mono font-medium text-slate-300">{elapsed}</span>
          </div>
          <div>
            <span className="block text-slate-500">Workspace</span>
            <span className="font-medium capitalize text-slate-300">{run.workspace}</span>
          </div>
        </div>
      </div>

      {/* Link */}
      <Link
        href={`/workflows/${run.id}`}
        className={cn(
          "shrink-0 self-start rounded p-1 text-slate-500 transition-colors",
          "hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
        )}
        aria-label={`View run ${run.id}`}
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

// ── Filter bar ──

interface FilterBarProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  availableFilters: AvailableFilters | undefined;
  onReset: () => void;
}

function FilterBar({ filters, onChange, availableFilters, onReset }: FilterBarProps) {
  const hasActive = Boolean(filters.templateId || filters.status || filters.createdAfter);
  const labelId = useId();

  const inputBase = cn(
    "h-8 rounded border border-slate-700 bg-slate-800/80 px-2.5 text-xs text-slate-200",
    "placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
    "transition-colors hover:border-slate-600",
  );

  return (
    <div
      role="search"
      aria-label="Filter workflow runs"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/40 p-3",
      )}
    >
      <SlidersHorizontal className="size-3.5 shrink-0 text-slate-500" aria-hidden="true" />

      {/* Template */}
      <label className="sr-only" htmlFor={`${labelId}-template`}>Template</label>
      <select
        id={`${labelId}-template`}
        value={filters.templateId}
        onChange={(e) => onChange({ ...filters, templateId: e.target.value })}
        className={cn(inputBase, "cursor-pointer")}
        aria-label="Filter by template"
      >
        <option value="">All templates</option>
        {(availableFilters?.templates ?? []).map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>

      {/* Status */}
      <label className="sr-only" htmlFor={`${labelId}-status`}>Status</label>
      <select
        id={`${labelId}-status`}
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
        className={cn(inputBase, "cursor-pointer")}
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        {(availableFilters?.statuses ?? (["pending","running","paused","complete","failed","abandoned"] as WorkflowRunStatus[])).map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>

      {/* Date after */}
      <label className="sr-only" htmlFor={`${labelId}-date`}>Created after</label>
      <input
        id={`${labelId}-date`}
        type="date"
        value={filters.createdAfter}
        onChange={(e) => onChange({ ...filters, createdAfter: e.target.value })}
        className={cn(inputBase, "w-[150px] cursor-pointer")}
        aria-label="Show runs created after date"
      />

      {/* Reset */}
      {hasActive && (
        <button
          type="button"
          onClick={onReset}
          className={cn(
            "inline-flex items-center gap-1 rounded px-2 h-8 text-xs font-medium",
            "text-slate-400 hover:text-rose-400 transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
          )}
          aria-label="Reset all filters"
        >
          <X className="size-3" aria-hidden="true" />
          Reset
        </button>
      )}
    </div>
  );
}

// ── Bulk action bar ──

interface BulkActionBarProps {
  selectedIds: Set<string>;
  pendingRunIds: Set<string>;
  onCancel: () => void;
  onRetry: () => void;
  onClear: () => void;
}

function BulkActionBar({
  selectedIds,
  pendingRunIds,
  onCancel,
  onRetry,
  onClear,
}: BulkActionBarProps) {
  const count = selectedIds.size;
  const busy = [...selectedIds].some((id) => pendingRunIds.has(id));

  if (count === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5",
        "text-sm",
      )}
    >
      <span className="font-semibold text-amber-400 tabular-nums">
        {count} selected
      </span>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onRetry}
          className={cn(
            "inline-flex items-center gap-1.5 rounded px-3 h-8 text-xs font-medium",
            "border border-slate-600 bg-slate-800 text-slate-200",
            "hover:border-amber-500/60 hover:text-amber-400 transition-colors",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
          )}
          aria-label={`Retry ${count} selected run${count === 1 ? "" : "s"}`}
        >
          {busy ? (
            <RefreshCw className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="size-3" aria-hidden="true" />
          )}
          Retry
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className={cn(
            "inline-flex items-center gap-1.5 rounded px-3 h-8 text-xs font-medium",
            "border border-rose-500/40 bg-rose-500/10 text-rose-400",
            "hover:border-rose-500/70 hover:bg-rose-500/20 transition-colors",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60",
          )}
          aria-label={`Cancel ${count} selected run${count === 1 ? "" : "s"}`}
        >
          {busy ? (
            <RefreshCw className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <XCircle className="size-3" aria-hidden="true" />
          )}
          Cancel
        </button>

        <button
          type="button"
          onClick={onClear}
          className={cn(
            "rounded p-1 text-slate-500 hover:text-slate-300 transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
          )}
          aria-label="Clear selection"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ── Completed runs table ──

interface CompletedRunsTableProps {
  runs: WorkflowRun[];
  selectedIds: Set<string>;
  pendingRunIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  isLoading: boolean;
}

function CompletedRunsTable({
  runs,
  selectedIds,
  pendingRunIds,
  onToggleRow,
  onToggleAll,
  isLoading,
}: CompletedRunsTableProps) {
  const allChecked = runs.length > 0 && runs.every((r) => selectedIds.has(r.id));
  const someChecked = runs.some((r) => selectedIds.has(r.id));
  const checkboxId = useId();

  if (isLoading && runs.length === 0) {
    return (
      <div className="flex flex-col gap-2" aria-label="Loading runs" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-11 animate-pulse rounded border border-slate-700/40 bg-slate-800/50"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (!isLoading && runs.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-700 py-12 text-center"
      >
        <CheckCircle2 className="size-8 text-slate-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-slate-400">No completed runs match your filters</p>
          <p className="mt-0.5 text-xs text-slate-600">Try adjusting the filter bar above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700/60">
      <table
        className="w-full min-w-[620px] border-collapse"
        aria-label="Recent completed workflow runs"
      >
        <thead>
          <tr className="border-b border-slate-700/60 bg-slate-800/80">
            <th scope="col" className="w-10 py-2.5 pl-4 text-left">
              <input
                id={checkboxId}
                type="checkbox"
                aria-label={allChecked ? "Deselect all runs" : "Select all runs"}
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked && !allChecked;
                }}
                onChange={(e) => onToggleAll(e.target.checked)}
                className={cn(
                  "size-3.5 cursor-pointer rounded border-slate-600 bg-slate-700",
                  "accent-amber-500 focus:ring-amber-500/60",
                )}
              />
            </th>
            {["Run", "Template", "Status", "Duration", "Completed"].map((col) => (
              <th
                key={col}
                scope="col"
                className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.slice(0, 20).map((run) => {
            const isPending = pendingRunIds.has(run.id);
            const isSelected = selectedIds.has(run.id);
            const dur = durationMs(run);

            return (
              <tr
                key={run.id}
                className={cn(
                  "border-b border-slate-700/40 last:border-0 transition-colors",
                  isSelected
                    ? "bg-amber-500/5"
                    : "hover:bg-slate-800/50",
                )}
              >
                <td className="w-10 py-2.5 pl-4">
                  <input
                    type="checkbox"
                    aria-label={`Select run ${run.id}`}
                    checked={isSelected}
                    disabled={isPending}
                    onChange={() => onToggleRow(run.id)}
                    className={cn(
                      "size-3.5 cursor-pointer rounded border-slate-600 bg-slate-700",
                      "accent-amber-500 focus:ring-amber-500/60",
                      "disabled:cursor-not-allowed disabled:opacity-40",
                    )}
                  />
                </td>

                {/* Run ID */}
                <td className="px-3 py-2.5">
                  <Link
                    href={`/workflows/${run.id}`}
                    className={cn(
                      "font-mono text-[11px] text-slate-300 hover:text-amber-400 transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 rounded-sm",
                    )}
                  >
                    {run.id.slice(-10)}
                  </Link>
                  <p className="mt-0.5 text-[10px] text-slate-600">
                    {relativeTime(run.started_at)}
                  </p>
                </td>

                {/* Template */}
                <td className="px-3 py-2.5">
                  <span className="text-xs font-medium text-slate-300">
                    {TEMPLATE_LABELS[run.template_id] ?? run.template_id}
                  </span>
                  <p className="mt-0.5 text-[10px] capitalize text-slate-600">
                    {run.workspace}
                  </p>
                </td>

                {/* Status */}
                <td className="px-3 py-2.5">
                  {isPending ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                      <RefreshCw className="size-3 animate-spin" aria-hidden="true" />
                      Processing…
                    </span>
                  ) : (
                    <WorkflowStatusBadge status={run.status} />
                  )}
                </td>

                {/* Duration */}
                <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-slate-400">
                  {fmt(dur)}
                </td>

                {/* Completed */}
                <td className="px-3 py-2.5 text-xs text-slate-500">
                  {shortDate(run.completed_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Action result banner ─────────────────────────────────────────────────────

interface ActionResultBannerProps {
  processed: number;
  failed: number;
  onDismiss: () => void;
}

function ActionResultBanner({ processed, failed, onDismiss }: ActionResultBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
        failed > 0
          ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
          : "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
      )}
    >
      {failed > 0 ? (
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span>
        {processed > 0 && (
          <span className="font-medium">{processed} run{processed === 1 ? "" : "s"} processed</span>
        )}
        {processed > 0 && failed > 0 && <span className="mx-1 text-slate-500">·</span>}
        {failed > 0 && (
          <span>{failed} failed</span>
        )}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-auto rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
        aria-label="Dismiss"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkflowOpsDashboard() {
  const {
    data,
    isLoading,
    error,
    pendingRunIds,
    lastActionResult,
    refetch,
    bulkAction,
    clearActionResult,
  } = useWorkflowDashboard();

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Filter completed runs client-side
  const filteredCompleted = useMemo(
    () => applyFilters(data?.recent_completed ?? [], filters),
    [data?.recent_completed, filters],
  );

  const handleFilterChange = useCallback((f: FilterState) => {
    startTransition(() => setFilters(f));
    setSelectedIds(new Set()); // clear selection on filter change
  }, []);

  const handleResetFilters = useCallback(() => {
    startTransition(() => setFilters(EMPTY_FILTERS));
    setSelectedIds(new Set());
  }, []);

  const handleToggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(filteredCompleted.map((r) => r.id)) : new Set());
  }, [filteredCompleted]);

  const handleCancel = useCallback(async () => {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    await bulkAction("cancel", ids);
  }, [selectedIds, bulkAction]);

  const handleRetry = useCallback(async () => {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    await bulkAction("retry", ids);
  }, [selectedIds, bulkAction]);

  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Metrics
  const m = data?.metrics;
  const successTone =
    !m ? "neutral"
    : m.success_rate >= 90 ? "success"
    : m.success_rate >= 70 ? "warn"
    : "danger";

  return (
    // Dark panel — sits inside the standard shell which has its own bg.
    // We use a near-black surface override scoped to this page.
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#0d1117] text-slate-200">
      {/* ── Topbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-slate-700/60 bg-[#0d1117]/95 px-6 py-4 backdrop-blur-md">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href="/workflows"
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 rounded-sm"
            >
              Workflows
            </Link>
            <span className="text-slate-700" aria-hidden="true">/</span>
            <span className="text-[11px] font-medium text-slate-300">Ops Dashboard</span>
          </div>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-50">
            Operations
          </h1>
        </div>

        {/* Right: queue depth indicator + refresh */}
        <div className="ml-auto flex items-center gap-3">
          {data && data.in_progress_queue.length > 0 && (
            <span
              aria-live="polite"
              aria-atomic="true"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10",
                "px-2.5 py-0.5 text-[11px] font-semibold text-amber-400",
              )}
            >
              <span className="size-1.5 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />
              {data.in_progress_queue.length} running
            </span>
          )}

          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isLoading}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 h-8 text-xs font-medium text-slate-300",
              "hover:border-slate-600 hover:text-slate-100 transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
            )}
            aria-label="Refresh dashboard data"
          >
            <RefreshCw
              className={cn("size-3", isLoading && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-6 px-6 py-6">
        {/* ── Error banner ───────────────────────────────────────── */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-400"
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span className="font-medium">Error:</span>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void refetch()}
              className="ml-auto text-xs underline underline-offset-2 hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Action result banner ───────────────────────────────── */}
        {lastActionResult && (
          <ActionResultBanner
            processed={lastActionResult.processed.length}
            failed={lastActionResult.failed.length}
            onDismiss={clearActionResult}
          />
        )}

        {/* ── Metrics strip ──────────────────────────────────────── */}
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="sr-only">Key metrics</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatChip
              icon={<CheckCircle2 className="size-3.5" />}
              label="Success Rate"
              value={m ? `${m.success_rate.toFixed(1)}%` : "—"}
              tone={successTone}
              loading={isLoading && !m}
            />
            <StatChip
              icon={<Gauge className="size-3.5" />}
              label="p95 Latency"
              value={m ? fmt(m.p95_latency_ms) : "—"}
              tone="neutral"
              loading={isLoading && !m}
            />
            <StatChip
              icon={<Layers className="size-3.5" />}
              label="Queue Depth"
              value={m ? String(m.queue_depth) : "—"}
              tone={m && m.queue_depth > 10 ? "warn" : "neutral"}
              loading={isLoading && !m}
            />
            <StatChip
              icon={<Clock className="size-3.5" />}
              label="7-Day Runs"
              value={m ? String(m.total_runs_7d) : "—"}
              subValue={m && m.failed_runs_7d > 0 ? `${m.failed_runs_7d} failed` : undefined}
              tone={m && m.failed_runs_7d > 0 ? "warn" : "neutral"}
              loading={isLoading && !m}
            />
          </div>
        </section>

        {/* ── In-progress queue ──────────────────────────────────── */}
        <section aria-labelledby="queue-heading">
          <div className="mb-3 flex items-center gap-2">
            <h2
              id="queue-heading"
              className="text-sm font-semibold uppercase tracking-widest text-slate-400"
            >
              In Progress
            </h2>
            {data && data.in_progress_queue.length > 0 && (
              <span
                aria-label={`${data.in_progress_queue.length} in-progress`}
                className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400"
              >
                {data.in_progress_queue.length}
              </span>
            )}
          </div>

          {isLoading && !data ? (
            <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading queue">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-[120px] animate-pulse rounded-lg border border-slate-700/40 bg-slate-800/50"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : data?.in_progress_queue.length === 0 ? (
            <div
              role="status"
              className="flex flex-col items-center gap-2.5 rounded-lg border border-dashed border-slate-700 py-10 text-center"
            >
              <div
                className="flex size-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800"
                aria-hidden="true"
              >
                <CheckCircle2 className="size-5 text-emerald-500/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">Queue is clear</p>
                <p className="mt-0.5 text-xs text-slate-600">No workflows currently running.</p>
              </div>
            </div>
          ) : (
            <div
              role="list"
              aria-label="In-progress workflow runs"
              className="grid gap-3 sm:grid-cols-2"
            >
              {data!.in_progress_queue.map((run) => (
                <div key={run.id} role="listitem">
                  <QueueCard run={run} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Completed runs ─────────────────────────────────────── */}
        <section aria-labelledby="completed-heading">
          <div className="mb-3 flex items-center gap-2">
            <h2
              id="completed-heading"
              className="text-sm font-semibold uppercase tracking-widest text-slate-400"
            >
              Recent Completed
            </h2>
            {filteredCompleted.length > 0 && (
              <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {Math.min(filteredCompleted.length, 20)} shown
              </span>
            )}
          </div>

          {/* Filter bar */}
          <div className="mb-3">
            <FilterBar
              filters={filters}
              onChange={handleFilterChange}
              availableFilters={data?.available_filters}
              onReset={handleResetFilters}
            />
          </div>

          {/* Bulk action bar */}
          <div className="mb-3">
            <BulkActionBar
              selectedIds={selectedIds}
              pendingRunIds={pendingRunIds}
              onCancel={() => void handleCancel()}
              onRetry={() => void handleRetry()}
              onClear={handleClearSelection}
            />
          </div>

          {/* Table */}
          <CompletedRunsTable
            runs={filteredCompleted}
            selectedIds={selectedIds}
            pendingRunIds={pendingRunIds}
            onToggleRow={handleToggleRow}
            onToggleAll={handleToggleAll}
            isLoading={isLoading}
          />
        </section>
      </div>
    </div>
  );
}
