"use client";

/**
 * ReviewQueue — Review Queue screen component (P4-05).
 *
 * Read-only skeleton list of artifacts flagged for review based on staleness,
 * lens freshness scoring, and contradiction detection. Full workflow deferred
 * to Portal v1.5 (DF-013).
 *
 * V1 gate types emitted by backend: freshness, contradiction.
 * Other gate types (coverage, completeness, relevance) are schema-present
 * but not yet emitted — this component renders them gracefully if they appear.
 *
 * Action buttons (Promote / Archive / Link) are stubbed in v1 — they render
 * as disabled with ARIA labels explaining the v1.5 target, satisfying
 * the accessibility requirement without misleading the user.
 *
 * DP4-02e (ADR-DPI-008 Option C):
 *   - Priority badge (HIGH / ROUTINE / CRITICAL) per row.
 *   - Artifact ID + confidence score metadata strip per row.
 *   - Filter/sort controls above the list (priority + updated-at).
 *   - Two-column layout deferred (ADR-DPI-002).
 *   - Per-row Stage Tracker (DP4-02a / ADR-DPI-001 gap fill — DP1-13 #9):
 *     StageTracker compact mounted in secondary column right of priority badge
 *     when artifact has an active (pending|running) workflow run. Null-safe:
 *     no tracker rendered when activeRun absent or terminal.
 *   - Right-rail context panel deferred (ADR-DPI-002 / DP4-02b).
 *
 * Stitch reference: "Review Queue" fefd2074… (partial — v1.5 scope)
 * WCAG 2.1 AA: all interactive elements have labels; colour + text, not colour-only.
 */

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ArchiveIcon,
  LinkIcon,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LensBadgeSet } from "@/components/workflow/lens-badge-set";
import { StageTracker } from "@/components/workflow/stage-tracker";
import { TypeBadge } from "@/components/ui/type-badge";
import {
  useReviewQueue,
  type ReviewItem,
  type ReviewGateType,
  type ReviewPriority,
  type ReviewSortField,
} from "@/hooks/useReviewQueue";
import type { SortOrder } from "@/lib/api/artifacts";

// ---------------------------------------------------------------------------
// Gate type badge
// ---------------------------------------------------------------------------

const GATE_LABELS: Record<string, string> = {
  freshness: "Freshness",
  contradiction: "Contradiction",
  coverage: "Coverage",
  completeness: "Completeness",
  relevance: "Relevance",
};

const GATE_COLOURS: Record<string, string> = {
  freshness:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  contradiction:
    "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  coverage:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  completeness: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  relevance:
    "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
};

interface GateBadgeProps {
  gateType: ReviewGateType;
}

function GateBadge({ gateType }: GateBadgeProps) {
  const label = GATE_LABELS[gateType] ?? gateType;
  const colour = GATE_COLOURS[gateType] ?? "bg-muted text-muted-foreground";

  return (
    <span
      aria-label={`Triggered by: ${label} gate`}
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        colour,
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Priority badge (ADR-DPI-008 Option C, DP4-02e)
// ---------------------------------------------------------------------------

const PRIORITY_STYLES: Record<ReviewPriority, string> = {
  CRITICAL:
    "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800/60",
  HIGH: "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/60",
  ROUTINE:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
};

interface PriorityBadgeProps {
  priority: ReviewPriority;
}

function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span
      aria-label={`Priority: ${priority}`}
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-bold leading-tight tracking-wide",
        PRIORITY_STYLES[priority],
      )}
    >
      {priority}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Metadata strip — artifact ID + confidence score (ADR-DPI-008 Option C)
// ---------------------------------------------------------------------------

interface MetadataStripProps {
  artifactId: string;
  confidenceScore: number | null;
}

function MetadataStrip({ artifactId, confidenceScore }: MetadataStripProps) {
  const shortId =
    artifactId.length > 12 ? `${artifactId.slice(0, 8)}…` : artifactId;
  const confidenceLabel =
    confidenceScore !== null
      ? `${Math.round(confidenceScore * 100)}%`
      : null;

  return (
    <div
      aria-label={`Artifact metadata: ID ${artifactId}${confidenceScore !== null ? `, confidence ${confidenceLabel}` : ""}`}
      className="flex items-center gap-3 text-[11px] text-muted-foreground"
    >
      <span title={artifactId} className="font-mono tracking-tight">
        {shortId}
      </span>
      {confidenceLabel && (
        <>
          <span aria-hidden="true" className="text-border">
            ·
          </span>
          <span
            aria-label={`Confidence score: ${confidenceLabel}`}
            className="tabular-nums"
          >
            Conf: {confidenceLabel}
          </span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter / sort controls (ADR-DPI-008 Option C, DP4-02e)
// ---------------------------------------------------------------------------

interface FilterSortBarProps {
  sort: ReviewSortField;
  order: SortOrder;
  priorityFilter: ReviewPriority | "ALL";
  gateFilter: ReviewGateType | "ALL";
  onSortChange: (field: ReviewSortField, order: SortOrder) => void;
  onPriorityChange: (p: ReviewPriority | "ALL") => void;
  onGateChange: (g: ReviewGateType | "ALL") => void;
}

const PRIORITY_OPTIONS: Array<{ value: ReviewPriority | "ALL"; label: string }> =
  [
    { value: "ALL", label: "All priorities" },
    { value: "CRITICAL", label: "Critical" },
    { value: "HIGH", label: "High" },
    { value: "ROUTINE", label: "Routine" },
  ];

const GATE_OPTIONS: Array<{ value: ReviewGateType | "ALL"; label: string }> = [
  { value: "ALL", label: "All gates" },
  { value: "freshness", label: "Freshness" },
  { value: "contradiction", label: "Contradiction" },
  { value: "coverage", label: "Coverage" },
  { value: "completeness", label: "Completeness" },
];

const SORT_OPTIONS: Array<{
  field: ReviewSortField;
  order: SortOrder;
  label: string;
}> = [
  { field: "priority", order: "asc", label: "Priority (high first)" },
  { field: "updated", order: "desc", label: "Newest first" },
  { field: "updated", order: "asc", label: "Oldest first" },
];

function FilterSortBar({
  sort,
  order,
  priorityFilter,
  gateFilter,
  onSortChange,
  onPriorityChange,
  onGateChange,
}: FilterSortBarProps) {
  const currentSortValue = `${sort}:${order}`;

  function handleSortChange(value: string) {
    const [field, ord] = value.split(":") as [ReviewSortField, SortOrder];
    onSortChange(field, ord);
  }

  return (
    <div
      role="group"
      aria-label="Filter and sort review queue"
      className="mb-4 flex flex-wrap items-center gap-2"
    >
      {/* Filter icon label */}
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Filter aria-hidden="true" className="size-3.5" />
        <span className="sr-only">Filter by</span>
      </span>

      {/* Priority filter */}
      <select
        aria-label="Filter by priority"
        value={priorityFilter}
        onChange={(e) =>
          onPriorityChange(e.target.value as ReviewPriority | "ALL")
        }
        className={cn(
          "h-7 rounded-md border bg-background px-2 text-xs text-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "cursor-pointer",
        )}
      >
        {PRIORITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Gate filter */}
      <select
        aria-label="Filter by gate type"
        value={gateFilter}
        onChange={(e) =>
          onGateChange(e.target.value as ReviewGateType | "ALL")
        }
        className={cn(
          "h-7 rounded-md border bg-background px-2 text-xs text-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "cursor-pointer",
        )}
      >
        {GATE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Sort control */}
      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowUpDown aria-hidden="true" className="size-3.5" />
        <span className="sr-only">Sort by</span>
      </span>
      <select
        aria-label="Sort review queue"
        value={currentSortValue}
        onChange={(e) => handleSortChange(e.target.value)}
        className={cn(
          "h-7 rounded-md border bg-background px-2 text-xs text-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "cursor-pointer",
        )}
      >
        {SORT_OPTIONS.map((opt) => (
          <option
            key={`${opt.field}:${opt.order}`}
            value={`${opt.field}:${opt.order}`}
          >
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Relative time formatter
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Row skeleton (loading state)
// ---------------------------------------------------------------------------

function ReviewQueueRowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex animate-pulse items-start gap-3 rounded-md border bg-card p-4"
    >
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex gap-1.5">
          <div className="h-4 w-16 rounded-sm bg-muted" />
          <div className="h-4 w-20 rounded-sm bg-muted" />
        </div>
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="mt-1 flex gap-1">
          <div className="h-4 w-14 rounded-sm bg-muted" />
          <div className="h-4 w-14 rounded-sm bg-muted" />
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <div className="h-7 w-16 rounded-md bg-muted" />
        <div className="h-7 w-16 rounded-md bg-muted" />
        <div className="h-7 w-12 rounded-md bg-muted" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action buttons — stubbed for v1
// ---------------------------------------------------------------------------

const STUB_TOOLTIP = "This action is available in Portal v1.5";

interface StubActionButtonProps {
  label: string;
  icon: React.ReactNode;
  ariaLabel: string;
}

function StubActionButton({ label, icon, ariaLabel }: StubActionButtonProps) {
  return (
    <button
      type="button"
      disabled
      aria-label={`${ariaLabel} — ${STUB_TOOLTIP}`}
      title={STUB_TOOLTIP}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium",
        "text-muted-foreground",
        "disabled:pointer-events-none disabled:opacity-40",
        "transition-colors",
      )}
    >
      <span aria-hidden="true" className="size-3.5">
        {icon}
      </span>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Review queue row
// ---------------------------------------------------------------------------

interface ReviewQueueRowProps {
  item: ReviewItem;
}

function ReviewQueueRow({ item }: ReviewQueueRowProps) {
  const { artifact, gateType, reviewedAt, priority, confidenceScore, activeRun } = item;
  const relativeTime = formatRelativeTime(reviewedAt);

  // Stage Tracker contract (DP4-02a / ADR-DPI-001 — DP1-13 #9):
  // Render compact tracker in the row only when an active (pending|running) run
  // is present. Terminal or absent runs → no tracker, no placeholder.
  const showStageTracker =
    activeRun != null &&
    (activeRun.status === "pending" || activeRun.status === "running");

  return (
    <li
      className="flex flex-col gap-3 rounded-md border bg-card p-4 transition-shadow hover:shadow-sm sm:flex-row sm:items-start"
      aria-label={artifact.title}
    >
      {/* Left: artifact info */}
      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        {/* Badge row — stack order: priority | type | gate (ADR-DPI-008 §6) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={priority} />
          <TypeBadge type={artifact.type} />
          <GateBadge gateType={gateType} />
        </div>

        {/* Title — links to artifact detail */}
        <Link
          href={`/artifact/${artifact.id}`}
          className={cn(
            "text-sm font-medium text-foreground leading-snug",
            "hover:underline underline-offset-2",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
          )}
        >
          {artifact.title}
        </Link>

        {/* Metadata strip — artifact ID + confidence score (DP4-02e) */}
        <MetadataStrip
          artifactId={artifact.id}
          confidenceScore={confidenceScore}
        />

        {/*
         * Stage Tracker compact (DP4-02a / ADR-DPI-001 — DP1-13 #9).
         * Rendered in the row secondary column (below metadata strip) only when
         * the artifact has an active pending|running workflow run.
         * Stage Tracker manifest §2.10: "Review Queue row secondary column".
         * Returns nothing when no active run — no layout break, no placeholder.
         */}
        {showStageTracker && activeRun && (
          <StageTracker
            runId={activeRun.id}
            templateId={activeRun.template_id}
            status={activeRun.status}
            currentStage={activeRun.current_stage}
            variant="compact"
            mode="sse"
            className="mt-0.5"
          />
        )}

        {/* Lens badges + timestamp footer */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <LensBadgeSet artifact={artifact} variant="compact" />
          {relativeTime && reviewedAt && (
            <time
              dateTime={reviewedAt}
              className="text-[11px] text-muted-foreground"
            >
              {relativeTime}
            </time>
          )}
        </div>
      </div>

      {/* Right: action buttons */}
      <div
        className="flex shrink-0 flex-wrap items-center gap-2"
        role="group"
        aria-label={`Actions for ${artifact.title}`}
      >
        <StubActionButton
          label="Promote"
          ariaLabel={`Promote ${artifact.title}`}
          icon={<CheckCircle2 aria-hidden="true" className="size-3.5" />}
        />
        <StubActionButton
          label="Archive"
          ariaLabel={`Archive ${artifact.title}`}
          icon={<ArchiveIcon aria-hidden="true" className="size-3.5" />}
        />
        <StubActionButton
          label="Link"
          ariaLabel={`Link ${artifact.title}`}
          icon={<LinkIcon aria-hidden="true" className="size-3.5" />}
        />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div
      role="status"
      aria-label="Review queue is empty"
      className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <CheckCircle2
          aria-hidden="true"
          className="size-6 text-muted-foreground"
        />
      </div>
      <div className="max-w-xs">
        <p className="text-sm font-medium text-foreground">
          No artifacts in review
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Artifacts appear here when the Freshness or Contradiction gate flags
          them for attention. Your vault is up to date.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

interface ErrorStateProps {
  error: Error;
  onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 py-12 text-center"
    >
      <AlertCircle aria-hidden="true" className="size-8 text-destructive" />
      <div>
        <p className="text-sm font-medium text-foreground">
          Failed to load review queue
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "inline-flex h-8 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive",
          "transition-colors hover:bg-destructive/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading state — skeleton rows
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <ul
      aria-label="Review queue loading"
      aria-busy="true"
      role="list"
      className="flex flex-col gap-3"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <ReviewQueueRowSkeleton key={i} />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * ReviewQueue renders the full Review Queue screen content.
 *
 * Handles loading / error / empty / populated states consistently with other
 * Research workspace pages.
 *
 * DP4-02e additions: filter/sort controls, priority badge, metadata strip.
 * Action buttons (Promote / Archive / Link) remain disabled stubs in v1.5.
 */
export function ReviewQueue() {
  const {
    items,
    isLoading,
    isError,
    error,
    refetch,
    filters,
    setSort,
    setPriorityFilter,
    setGateFilter,
  } = useReviewQueue();

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError && error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <section aria-label="Artifacts in review">
      {/* Count summary */}
      <p className="mb-3 text-xs text-muted-foreground">
        {items.length} artifact{items.length !== 1 ? "s" : ""} flagged for
        review
      </p>

      {/* Filter / sort controls — DP4-02e (ADR-DPI-008 Option C) */}
      <FilterSortBar
        sort={filters.sort}
        order={filters.order}
        priorityFilter={filters.priorityFilter}
        gateFilter={filters.gateFilter}
        onSortChange={setSort}
        onPriorityChange={setPriorityFilter}
        onGateChange={setGateFilter}
      />

      {/* V1 action scope note */}
      <p
        role="note"
        className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
      >
        Actions (Promote, Archive, Link) are available in Portal v1.5.
        Rows are read-only in this release.
      </p>

      <ul
        role="list"
        aria-label="Review queue"
        className="flex flex-col gap-3"
      >
        {items.map((item) => (
          <ReviewQueueRow key={item.artifact.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
