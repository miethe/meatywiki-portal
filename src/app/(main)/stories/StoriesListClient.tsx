"use client";

/**
 * StoriesListClient — interactive dense table for the op-story catalog.
 *
 * Features:
 *   - Dense accessible HTML table (semantic <table>, <th scope="col">, <td>)
 *   - Quick lifecycle-state status filter chips (keyboard-navigable, aria-pressed)
 *   - Additional filters: project, source_type, sensitivity, publication
 *   - Full-text search (q param)
 *   - Loading skeletons, error state (role="alert"), empty state
 *   - Per-row stale-sync badge when sync.synced_at > STALE_THRESHOLD_HOURS old
 *   - "Details hidden (held)" for non-public (sensitivity.level != "public") rows
 *   - TanStack Query for client-side filter-driven fetching; SSR initialData
 *     hydrates the empty-filter view with zero client round-trip
 *
 * Accessibility: WCAG 2.1 AA
 *   - Status conveyed by label text, not colour alone
 *   - aria-pressed on filter chips
 *   - aria-live="polite" on result count
 *   - aria-busy on table during background refetch
 *   - role="alert" on error state
 *   - Focus-visible rings on all interactive elements
 */

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  Clock,
  ExternalLink,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listStories } from "@/lib/api/stories";
import { storiesQueryKey } from "@/hooks/useStories";
import type {
  StoryListItem,
  StoriesEnvelope,
  StoryFilters,
  LifecycleState,
} from "@/types/stories";
import { StoryStatusBadge } from "@/components/ui/StoryStatusBadge";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Stories older than this are flagged as stale */
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// Quick lifecycle-state chips at the top of the filter bar
const QUICK_STATUS_OPTIONS: { value: LifecycleState | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "drafted", label: "Drafted" },
  { value: "pr_opened", label: "PR Opened" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const SOURCE_TYPE_OPTIONS = [
  { value: "", label: "Any source" },
  { value: "aar", label: "AAR" },
  { value: "retro", label: "Retro" },
  { value: "incident", label: "Incident" },
  { value: "note", label: "Note" },
  { value: "conversation", label: "Conversation" },
];

const SENSITIVITY_OPTIONS = [
  { value: "", label: "Any sensitivity" },
  { value: "public", label: "Public" },
  { value: "internal", label: "Internal" },
  { value: "blocked", label: "Blocked" },
];

const PUBLICATION_OPTIONS = [
  { value: "", label: "Any publication" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "unpublished", label: "Unpublished" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStale(syncedAt: string): boolean {
  return Date.now() - new Date(syncedAt).getTime() > STALE_THRESHOLD_MS;
}

function isEmptyFilters(f: StoryFilters): boolean {
  return (
    !f.status &&
    !f.project &&
    !f.source_type &&
    !f.sensitivity &&
    !f.publication &&
    !f.q &&
    !f.date_from &&
    !f.date_to
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StaleSyncBadge({ syncedAt }: { syncedAt: string }) {
  const date = new Date(syncedAt);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      aria-label={`Stale sync — last synced ${date.toLocaleString()}`}
      title={`Last synced: ${date.toLocaleString()}`}
    >
      <Clock aria-hidden="true" className="size-3 shrink-0" />
      Stale
    </span>
  );
}

function SensitivityBadge({ level }: { level: string }) {
  const colourMap: Record<string, string> = {
    public:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    internal:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    blocked: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  const colours = colourMap[level] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex rounded-sm px-1.5 py-0.5 text-[11px] font-medium",
        colours,
      )}
    >
      {level}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

interface FilterBarProps {
  filters: StoryFilters;
  search: string;
  onSearchChange: (v: string) => void;
  onFiltersChange: (patch: Partial<StoryFilters>) => void;
  onClearAll: () => void;
  isFetching: boolean;
}

function FilterBar({
  filters,
  search,
  onSearchChange,
  onFiltersChange,
  onClearAll,
  isFetching,
}: FilterBarProps) {
  const activeCount = [
    filters.status,
    filters.project,
    filters.source_type,
    filters.sensitivity,
    filters.publication,
    filters.q,
    filters.date_from,
    filters.date_to,
  ].filter(Boolean).length;

  return (
    <div
      role="search"
      aria-label="Story filters"
      className="flex flex-col gap-2 rounded-md border bg-card/50 p-3"
    >
      {/* Row 1: search + secondary selects */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search
            aria-hidden="true"
            className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="story-search"
            aria-label="Search stories"
            placeholder="Search…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearchChange("")}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground",
                "hover:bg-accent hover:text-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <X aria-hidden="true" className="size-3" />
            </button>
          )}
        </div>

        {/* Source type */}
        <div className="flex items-center gap-1">
          <label htmlFor="story-filter-source" className="sr-only">
            Source type
          </label>
          <select
            id="story-filter-source"
            value={filters.source_type ?? ""}
            onChange={(e) =>
              onFiltersChange({ source_type: e.target.value || undefined })
            }
            aria-label="Filter by source type"
            className={cn(
              "min-h-[28px] rounded-sm border border-input bg-background px-2 text-[11px] text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            {SOURCE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sensitivity */}
        <div className="flex items-center gap-1">
          <label htmlFor="story-filter-sensitivity" className="sr-only">
            Sensitivity
          </label>
          <select
            id="story-filter-sensitivity"
            value={filters.sensitivity ?? ""}
            onChange={(e) =>
              onFiltersChange({ sensitivity: e.target.value || undefined })
            }
            aria-label="Filter by sensitivity"
            className={cn(
              "min-h-[28px] rounded-sm border border-input bg-background px-2 text-[11px] text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            {SENSITIVITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Publication */}
        <div className="flex items-center gap-1">
          <label htmlFor="story-filter-publication" className="sr-only">
            Publication state
          </label>
          <select
            id="story-filter-publication"
            value={filters.publication ?? ""}
            onChange={(e) =>
              onFiltersChange({ publication: e.target.value || undefined })
            }
            aria-label="Filter by publication state"
            className={cn(
              "min-h-[28px] rounded-sm border border-input bg-background px-2 text-[11px] text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            {PUBLICATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Project */}
        <div className="flex items-center gap-1">
          <label htmlFor="story-filter-project" className="sr-only">
            Project
          </label>
          <Input
            id="story-filter-project"
            aria-label="Filter by project"
            placeholder="Project ID…"
            value={filters.project ?? ""}
            onChange={(e) =>
              onFiltersChange({ project: e.target.value || undefined })
            }
            className="h-7 w-28 text-[11px]"
          />
        </div>

        {/* Date range */}
        <div
          role="group"
          aria-label="Date range filter"
          className="flex items-center gap-1"
        >
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Date
          </span>
          <label htmlFor="story-filter-date-from" className="sr-only">
            From date
          </label>
          <input
            id="story-filter-date-from"
            type="date"
            value={filters.date_from ?? ""}
            max={filters.date_to ?? undefined}
            onChange={(e) =>
              onFiltersChange({ date_from: e.target.value || undefined })
            }
            aria-label="Filter from date"
            className={cn(
              "min-h-[28px] rounded-sm border border-input bg-background px-2 text-[11px] text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          />
          <span aria-hidden="true" className="text-[11px] text-muted-foreground">
            –
          </span>
          <label htmlFor="story-filter-date-to" className="sr-only">
            To date
          </label>
          <input
            id="story-filter-date-to"
            type="date"
            value={filters.date_to ?? ""}
            min={filters.date_from ?? undefined}
            onChange={(e) =>
              onFiltersChange({ date_to: e.target.value || undefined })
            }
            aria-label="Filter to date"
            className={cn(
              "min-h-[28px] rounded-sm border border-input bg-background px-2 text-[11px] text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          />
        </div>

        {/* Clear all */}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className={cn(
              "ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:underline",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            Clear all ({activeCount})
          </button>
        )}

        {/* Fetching spinner */}
        {isFetching && (
          <RefreshCw
            aria-label="Refreshing"
            className="size-3.5 animate-spin text-muted-foreground"
          />
        )}
      </div>

      {/* Row 2: quick status chips */}
      <div
        role="group"
        aria-label="Filter by status"
        className="flex flex-wrap items-center gap-1"
      >
        <span className="mr-1 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Status
        </span>
        {QUICK_STATUS_OPTIONS.map(({ value, label }) => {
          const active = (filters.status ?? "") === value;
          return (
            <button
              key={value || "all"}
              type="button"
              aria-pressed={active}
              aria-label={`Filter status: ${label}`}
              onClick={() =>
                onFiltersChange({ status: value || undefined })
              }
              className={cn(
                "inline-flex min-h-[28px] items-center rounded-sm px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b">
          <td className="px-3 py-2.5">
            <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
          </td>
          <td className="px-3 py-2.5">
            <div className="h-4 w-16 animate-pulse rounded-sm bg-muted" />
          </td>
          <td className="px-3 py-2.5">
            <div className="h-3.5 w-14 animate-pulse rounded bg-muted" />
          </td>
          <td className="px-3 py-2.5">
            <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
          </td>
          <td className="px-3 py-2.5">
            <div className="h-4 w-14 animate-pulse rounded-sm bg-muted" />
          </td>
          <td className="px-3 py-2.5">
            <div className="h-4 w-16 animate-pulse rounded-sm bg-muted" />
          </td>
          <td className="px-3 py-2.5">
            <div className="h-3.5 w-10 animate-pulse rounded bg-muted" />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  hasActiveFilters,
  onClearFilters,
}: {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <tr>
      <td colSpan={7}>
        <div
          role="status"
          className="flex flex-col items-center justify-center gap-3 py-16 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <BookOpen aria-hidden="true" className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {hasActiveFilters ? "No stories match these filters" : "No stories yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasActiveFilters
                ? "Try clearing filters to see all stories."
                : "Op stories will appear here once synced from the backend."}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className={cn(
                "inline-flex min-h-[36px] items-center gap-1.5 rounded-md border px-3 text-xs font-medium",
                "transition-colors hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
            >
              <X aria-hidden="true" className="size-3" />
              Clear filters
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 py-12 text-center"
    >
      <AlertCircle aria-hidden="true" className="size-8 text-destructive" />
      <div>
        <p className="text-sm font-medium text-foreground">
          Failed to load stories
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "inline-flex min-h-[44px] items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive sm:h-8 sm:min-h-0",
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
// Story table row
// ---------------------------------------------------------------------------

function StoryRow({ story }: { story: StoryListItem }) {
  const isHeld = story.sensitivity.level !== "public";
  const stale = isStale(story.sync.synced_at);

  const titleContent = isHeld ? (
    <span className="italic text-muted-foreground">details hidden (held)</span>
  ) : (
    story.title ?? (
      <span className="text-muted-foreground/60">{story.story_id.slice(0, 12)}&hellip;</span>
    )
  );

  return (
    <tr
      role="row"
      className={cn(
        "border-b transition-colors hover:bg-accent/30",
        "focus-within:bg-accent/20",
      )}
    >
      {/* Title — links to detail */}
      <td role="cell" className="px-3 py-2.5 max-w-[240px]">
        <Link
          href={`/stories/${encodeURIComponent(story.story_id)}`}
          className={cn(
            "line-clamp-2 text-xs font-medium text-foreground hover:text-primary hover:underline",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded",
          )}
          aria-label={
            isHeld
              ? `Story ${story.story_id} — details hidden (held)`
              : `Open story: ${story.title ?? story.story_id}`
          }
        >
          {titleContent}
        </Link>
        {isHeld && story.scrub.summary && (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
            {story.scrub.summary}
          </p>
        )}
      </td>

      {/* Lifecycle state */}
      <td role="cell" className="whitespace-nowrap px-3 py-2.5">
        <StoryStatusBadge lifecycleState={story.lifecycle_state} />
      </td>

      {/* Source type */}
      <td role="cell" className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
        {story.source_type}
      </td>

      {/* Date */}
      <td role="cell" className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
        {formatDate(story.date)}
      </td>

      {/* Sensitivity */}
      <td role="cell" className="whitespace-nowrap px-3 py-2.5">
        <SensitivityBadge level={story.sensitivity.level} />
      </td>

      {/* Publication */}
      <td role="cell" className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
        {story.publication.state}
        {story.publication.published_url && (
          <a
            href={story.publication.published_url}
            target="_blank"
            rel="noreferrer"
            aria-label={`View published story: ${story.title ?? story.story_id}`}
            className={cn(
              "ml-1 inline-flex items-center text-primary hover:underline",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
            )}
          >
            <ExternalLink aria-hidden="true" className="size-3" />
          </a>
        )}
      </td>

      {/* Sync — stale indicator */}
      <td role="cell" className="whitespace-nowrap px-3 py-2.5">
        {stale && <StaleSyncBadge syncedAt={story.sync.synced_at} />}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface StoriesListClientProps {
  initialData: StoriesEnvelope;
}

export function StoriesListClient({ initialData }: StoriesListClientProps) {
  // Filter state
  const [filters, setFilters] = useState<StoryFilters>({});
  // Local search draft (applied on change, no debounce for simplicity)
  const [search, setSearch] = useState("");

  // Merge search into filters for query
  const activeFilters = useMemo<StoryFilters>(
    () => ({ ...filters, q: search || undefined }),
    [filters, search],
  );

  const empty = isEmptyFilters(activeFilters);

  const { data, isLoading, isFetching, error, refetch } = useQuery<
    StoriesEnvelope,
    Error
  >({
    queryKey: storiesQueryKey(activeFilters),
    queryFn: () => listStories(activeFilters),
    // SSR data hydrates the empty-filter render with zero extra round-trip
    initialData: empty ? initialData : undefined,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: false,
  });

  // In TQ v5, status stays "success" (data present) even on background refetch
  // failure when initialData was provided. Use !data to detect a true hard error.
  const hardError = error && !data;

  const stories = useMemo(() => data?.data ?? [], [data]);

  const handleFiltersChange = useCallback(
    (patch: Partial<StoryFilters>) => {
      setFilters((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const handleClearAll = useCallback(() => {
    setFilters({});
    setSearch("");
  }, []);

  // Check if any story has a stale sync at the global level
  const anyStale = useMemo(
    () => stories.some((s) => isStale(s.sync.synced_at)),
    [stories],
  );

  const hasActiveFilters = !isEmptyFilters(activeFilters);

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Stories</h1>
            {anyStale && (
              <span
                className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                role="status"
                aria-label="Some stories have stale sync data"
              >
                <Clock aria-hidden="true" className="size-3" />
                Stale sync
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Op story catalog — lessons captured by the Agentic OS
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        search={search}
        onSearchChange={setSearch}
        onFiltersChange={handleFiltersChange}
        onClearAll={handleClearAll}
        isFetching={isFetching && !isLoading}
      />

      {/* Hard error (no data — initial fetch failed) */}
      {hardError && (
        <ErrorState error={error} onRetry={() => void refetch()} />
      )}

      {/* Table (shown unless hard error) */}
      {!hardError && (
        <div className="overflow-x-auto rounded-md border">
          <table
            aria-label="Stories"
            aria-busy={isLoading}
            className="w-full min-w-[640px] border-collapse text-left text-sm"
          >
            <thead className="border-b bg-muted/40">
              <tr role="row">
                <th
                  scope="col"
                  role="columnheader"
                  className="px-3 py-2.5 text-xs font-semibold text-foreground"
                >
                  Title
                </th>
                <th
                  scope="col"
                  role="columnheader"
                  className="px-3 py-2.5 text-xs font-semibold text-foreground"
                >
                  Status
                </th>
                <th
                  scope="col"
                  role="columnheader"
                  className="px-3 py-2.5 text-xs font-semibold text-foreground"
                >
                  Source
                </th>
                <th
                  scope="col"
                  role="columnheader"
                  className="px-3 py-2.5 text-xs font-semibold text-foreground"
                >
                  Date
                </th>
                <th
                  scope="col"
                  role="columnheader"
                  className="px-3 py-2.5 text-xs font-semibold text-foreground"
                >
                  Sensitivity
                </th>
                <th
                  scope="col"
                  role="columnheader"
                  className="px-3 py-2.5 text-xs font-semibold text-foreground"
                >
                  Publication
                </th>
                <th
                  scope="col"
                  role="columnheader"
                  className="px-3 py-2.5 text-xs font-semibold text-foreground"
                >
                  Sync
                </th>
              </tr>
            </thead>

            {isLoading ? (
              <TableSkeleton />
            ) : (
              <tbody>
                {stories.length === 0 ? (
                  <EmptyState
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={handleClearAll}
                  />
                ) : (
                  stories.map((story) => (
                    <StoryRow key={story.story_id} story={story} />
                  ))
                )}
              </tbody>
            )}
          </table>
        </div>
      )}

      {/* Result count */}
      {!isLoading && !hardError && (
        <p
          className="text-xs text-muted-foreground"
          aria-live="polite"
          aria-atomic="true"
        >
          {stories.length === 1 ? "1 story" : `${stories.length} stories`}
          {data?.cursor && " — more available"}
        </p>
      )}
    </>
  );
}
