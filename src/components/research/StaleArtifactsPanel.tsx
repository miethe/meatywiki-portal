"use client";

/**
 * StaleArtifactsPanel — Research workspace Stale Artifacts section.
 *
 * Wires GET /api/artifacts/research/freshness-status into a paginated list
 * of artifacts that haven't been synthesised recently.
 *
 * Features:
 *   - Configurable threshold_days input (default 30), debounced 400ms.
 *   - Freshness score 0–100 visualised as a filled bar (aria-labelled).
 *   - Last synthesis date displayed as a relative time string.
 *   - Source artifact count per row.
 *   - Cursor Prev / Next pagination with page indicator.
 *   - Loading skeleton rows, empty state, error state.
 *
 * WCAG 2.1 AA:
 *   - All interactive controls have labels.
 *   - Score bar uses role="meter" with aria-valuenow/min/max.
 *   - Pagination buttons are disabled + aria-disabled when unavailable.
 *   - Colour conveys information supported by text/icon alternatives.
 *
 * P7-01: Research workspace — Stale Artifacts panel.
 * Endpoint: GET /api/artifacts/research/freshness-status
 */

import React, { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Database, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/components/ui/type-badge";
import { useFreshnessStatus, useDebounce } from "@/hooks/useFreshnessStatus";
import type { FreshnessItem } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 400;
const DEFAULT_THRESHOLD = 30;
const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format an ISO 8601 date string as a human-readable relative time.
 * Falls back to "Never synthesised" when date is null.
 */
function formatRelativeDate(isoDate: string | null): string {
  if (!isoDate) return "Never synthesised";

  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

/**
 * Choose a colour class for the freshness score bar based on score value.
 * 0–29 = red (critical), 30–59 = amber (warning), 60–100 = green (healthy).
 */
function scoreColour(score: number): string {
  if (score < 30) return "bg-rose-500 dark:bg-rose-600";
  if (score < 60) return "bg-amber-400 dark:bg-amber-500";
  return "bg-emerald-500 dark:bg-emerald-600";
}

function scoreTrackColour(score: number): string {
  if (score < 30) return "bg-rose-100 dark:bg-rose-900/30";
  if (score < 60) return "bg-amber-100 dark:bg-amber-900/30";
  return "bg-emerald-100 dark:bg-emerald-900/30";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-muted", className)}
    />
  );
}

function SkeletonRow() {
  return (
    <li
      aria-hidden="true"
      className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3"
    >
      <div className="flex items-center gap-2">
        <Shimmer className="h-4 w-16 rounded-full" />
        <Shimmer className="h-4 flex-1" />
      </div>
      <Shimmer className="h-2 w-full rounded-full" />
      <div className="flex gap-4">
        <Shimmer className="h-3 w-24" />
        <Shimmer className="h-3 w-20" />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// FreshnessScoreBar
// ---------------------------------------------------------------------------

interface FreshnessScoreBarProps {
  score: number;
  className?: string;
}

function FreshnessScoreBar({ score, className }: FreshnessScoreBarProps) {
  const clamped = Math.min(100, Math.max(0, score));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="meter"
        aria-label={`Freshness score: ${clamped} out of 100`}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          "relative h-1.5 w-full overflow-hidden rounded-full",
          scoreTrackColour(clamped),
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
            scoreColour(clamped),
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "shrink-0 text-[11px] font-semibold tabular-nums",
          clamped < 30
            ? "text-rose-600 dark:text-rose-400"
            : clamped < 60
            ? "text-amber-600 dark:text-amber-400"
            : "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {clamped}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArtifactRow
// ---------------------------------------------------------------------------

function ArtifactRow({ item }: { item: FreshnessItem }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 transition-shadow hover:shadow-sm">
      {/* Title row */}
      <div className="flex min-w-0 items-center gap-2">
        {item.subtype && <TypeBadge type={item.subtype} />}
        <Link
          href={`/artifact/${item.id}`}
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-medium text-foreground leading-snug",
            "hover:underline underline-offset-2",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
          )}
        >
          {item.title}
        </Link>
      </div>

      {/* Freshness score bar */}
      <FreshnessScoreBar score={item.freshness_score} />

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {/* Last synthesis date */}
        <span className="flex items-center gap-1">
          <Clock aria-hidden="true" className="size-3 shrink-0" />
          <span>
            <span className="sr-only">Last synthesised: </span>
            {formatRelativeDate(item.last_synthesis_date)}
          </span>
        </span>

        {/* Source artifact count */}
        <span className="flex items-center gap-1">
          <Database aria-hidden="true" className="size-3 shrink-0" />
          <span>
            <span className="sr-only">Source artifacts: </span>
            {item.source_artifact_count}{" "}
            {item.source_artifact_count === 1 ? "source" : "sources"}
          </span>
        </span>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// ThresholdInput
// ---------------------------------------------------------------------------

interface ThresholdInputProps {
  value: number;
  onChange: (v: number) => void;
}

function ThresholdInput({ value, onChange }: ThresholdInputProps) {
  const inputId = "stale-threshold-days";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = parseInt(e.target.value, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 3650) {
      onChange(parsed);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={inputId}
        className="text-xs text-muted-foreground whitespace-nowrap"
      >
        Stale after
      </label>
      <input
        id={inputId}
        type="number"
        min={1}
        max={3650}
        value={value}
        onChange={handleChange}
        aria-label="Staleness threshold in days"
        className={cn(
          "h-6 w-14 rounded border bg-background px-1.5 text-center text-xs font-medium",
          "text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-1",
        )}
      />
      <span className="text-xs text-muted-foreground">days</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination controls
// ---------------------------------------------------------------------------

interface PaginationControlsProps {
  hasPrev: boolean;
  hasNext: boolean;
  pageIndex: number;
  onPrev: () => void;
  onNext: () => void;
  isLoading: boolean;
}

function PaginationControls({
  hasPrev,
  hasNext,
  pageIndex,
  onPrev,
  onNext,
  isLoading,
}: PaginationControlsProps) {
  if (!hasPrev && !hasNext) return null;

  return (
    <div
      role="navigation"
      aria-label="Stale artifacts pagination"
      className="flex items-center justify-between gap-2 pt-1"
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasPrev || isLoading}
        aria-disabled={!hasPrev || isLoading}
        aria-label="Previous page"
        className={cn(
          "flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs font-medium",
          "text-foreground transition-colors",
          "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        <ChevronLeft aria-hidden="true" className="size-3.5" />
        Prev
      </button>

      <span
        aria-live="polite"
        aria-atomic="true"
        className="text-[11px] text-muted-foreground"
      >
        Page {pageIndex + 1}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext || isLoading}
        aria-disabled={!hasNext || isLoading}
        aria-label="Next page"
        className={cn(
          "flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs font-medium",
          "text-foreground transition-colors",
          "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        Next
        <ChevronRight aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface StaleArtifactsPanelProps {
  /** Override default threshold (used in tests). */
  initialThreshold?: number;
  className?: string;
}

export function StaleArtifactsPanel({
  initialThreshold = DEFAULT_THRESHOLD,
  className,
}: StaleArtifactsPanelProps) {
  const [thresholdInput, setThresholdInput] = useState<number>(initialThreshold);
  const debouncedThreshold = useDebounce(thresholdInput, DEBOUNCE_MS);

  const {
    items,
    isLoading,
    isError,
    error,
    hasNext,
    hasPrev,
    fetchNext,
    fetchPrev,
    pageIndex,
  } = useFreshnessStatus(debouncedThreshold, PAGE_SIZE);

  const isEmpty = !isLoading && !isError && items.length === 0;

  return (
    <section
      aria-labelledby="stale-artifacts-heading"
      className={cn("flex flex-col gap-3", className)}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <AlertTriangle
            aria-hidden="true"
            className="size-4 text-amber-500 dark:text-amber-400"
          />
          <h2
            id="stale-artifacts-heading"
            className="text-sm font-semibold text-foreground"
          >
            Stale Artifacts
          </h2>
          {isLoading && (
            <span className="sr-only" role="status" aria-live="polite">
              Loading stale artifacts…
            </span>
          )}
        </div>

        <ThresholdInput value={thresholdInput} onChange={setThresholdInput} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* List                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <ul
        role="list"
        aria-label="Stale artifacts"
        aria-busy={isLoading}
        className="flex flex-col gap-2"
      >
        {/* Loading state — 4 skeleton rows */}
        {isLoading &&
          Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} />)}

        {/* Error state */}
        {isError && !isLoading && (
          <li
            role="alert"
            className={cn(
              "flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3",
              "dark:border-rose-900/40 dark:bg-rose-950/30",
            )}
          >
            <AlertTriangle
              aria-hidden="true"
              className="size-4 shrink-0 text-rose-600 dark:text-rose-400"
            />
            <p className="text-sm text-rose-700 dark:text-rose-300">
              {error?.message ?? "Failed to load freshness data."}
            </p>
          </li>
        )}

        {/* Empty state */}
        {isEmpty && (
          <li className="rounded-lg border border-dashed px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              No stale artifacts found within the last{" "}
              <strong className="font-medium">{debouncedThreshold}</strong> days.
            </p>
          </li>
        )}

        {/* Items */}
        {!isLoading &&
          !isError &&
          items.map((item) => <ArtifactRow key={item.id} item={item} />)}
      </ul>

      {/* ------------------------------------------------------------------ */}
      {/* Pagination                                                           */}
      {/* ------------------------------------------------------------------ */}
      {!isError && (
        <PaginationControls
          hasPrev={hasPrev}
          hasNext={hasNext}
          pageIndex={pageIndex}
          onPrev={fetchPrev}
          onNext={fetchNext}
          isLoading={isLoading}
        />
      )}
    </section>
  );
}
