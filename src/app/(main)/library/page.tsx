"use client";

/**
 * Library screen — primary knowledge surface (taxonomy-redesign P5-02).
 *
 * P3-05 foundation extended with:
 *   - Title updated to "Knowledge Library" (primary surface per design spec)
 *   - Facet filter in filter bar (library/research/blog/projects)
 *   - Date range filter (dateFrom/dateTo — reserved, no backend param yet)
 *   - FacetBadge on ArtifactCard for blog/projects workspace artifacts
 *   - research_origin styling hook on ArtifactCard for P5-06 extension
 *
 * Design: artifact card list with title, type badge, facet badge (blog/projects),
 * preview text, created/updated dates, action buttons. Filter bar: type, facet,
 * date range, search. Sorting: newest, alphabetical, relevance. Cursor pagination.
 *
 * Stitch reference: "Library" screen (ID: 5e22feb4105d40d79251c135df4a4b5a)
 * Shell: Standard Archival
 * Lens badges: compact, on each card
 *
 * TAG FILTER: Not implemented — backend does not support ?tags= in v1.
 */

import { useState, useCallback, useEffect } from "react";
import { LayoutGrid, List, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArtifactCard } from "@/components/ui/artifact-card";
import { ArtifactCardSkeletonGrid } from "@/components/ui/artifact-card-skeleton";
import { LibraryFilterBar, useLensFilterUrlSync } from "@/components/ui/library-filter-bar";
import {
  useLibraryArtifacts,
  DEFAULT_LIBRARY_FILTERS,
  type LibraryFilters,
} from "@/hooks/useLibraryArtifacts";

// ---------------------------------------------------------------------------
// View mode — persisted to localStorage
// ---------------------------------------------------------------------------

type ViewMode = "grid" | "list";
const VIEW_MODE_KEY = "meatywiki-library-view";

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "grid";
  try {
    const stored = window.localStorage.getItem(VIEW_MODE_KEY);
    if (stored === "list" || stored === "grid") return stored;
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall back to default
  }
  return "grid";
}

// ---------------------------------------------------------------------------
// View toggle component
// ---------------------------------------------------------------------------

interface ViewToggleProps {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}

function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="View layout"
      className="flex rounded-md border"
    >
      <button
        type="button"
        aria-label="List view"
        aria-pressed={view === "list"}
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex min-h-[44px] items-center gap-1.5 rounded-l-md border-r px-3 text-xs font-medium transition-colors sm:h-8 sm:min-h-0",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          view === "list"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
      >
        <List aria-hidden="true" className="size-3.5" />
        <span className="hidden sm:inline">List</span>
      </button>
      <button
        type="button"
        aria-label="Grid view"
        aria-pressed={view === "grid"}
        onClick={() => onChange("grid")}
        className={cn(
          "inline-flex min-h-[44px] items-center gap-1.5 rounded-r-md px-3 text-xs font-medium transition-colors sm:h-8 sm:min-h-0",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          view === "grid"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
      >
        <LayoutGrid aria-hidden="true" className="size-3.5" />
        <span className="hidden sm:inline">Grid</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <svg
          aria-hidden="true"
          className="size-6 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-3-3v6m-7 5h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          {hasFilters ? "No matching artifacts" : "Library is empty"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasFilters
            ? "Try adjusting or clearing the active filters."
            : "Compile some notes to start building your knowledge library."}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 py-12 text-center"
    >
      <AlertCircle aria-hidden="true" className="size-8 text-destructive" />
      <div>
        <p className="text-sm font-medium text-foreground">
          Failed to load artifacts
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
// Main page component
// ---------------------------------------------------------------------------

export default function LibraryPage() {
  // View mode — initialised after mount to avoid SSR/hydration mismatch
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setViewMode(getInitialViewMode());
    setMounted(true);
  }, []);

  const handleViewChange = useCallback((next: ViewMode) => {
    setViewMode(next);
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, next);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // URL sync for lens filters (P4-09)
  const { readFromUrl, syncToUrl } = useLensFilterUrlSync();

  // Filter state — initialise lens filters from URL on mount
  const [filters, setFilters] = useState<LibraryFilters>(() => ({
    ...DEFAULT_LIBRARY_FILTERS,
    ...(readFromUrl() ?? {}),
  }));

  const handleFiltersChange = useCallback(
    (next: Partial<LibraryFilters>) => {
      setFilters((prev) => {
        const updated = { ...prev, ...next };
        // Push lens filter changes to the URL so state survives reload
        syncToUrl({
          lensFidelity: updated.lensFidelity,
          lensFreshness: updated.lensFreshness,
          lensVerification: updated.lensVerification,
        });
        return updated;
      });
    },
    [syncToUrl],
  );

  // Data fetching
  const {
    artifacts,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
    total,
  } = useLibraryArtifacts(filters);

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.statuses.length > 0 ||
    !!filters.facet ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    filters.lensFidelity.length > 0 ||
    filters.lensFreshness.length > 0 ||
    filters.lensVerification.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Library</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            All compiled knowledge artifacts across workspaces
          </p>
        </div>

        <ViewToggle
          view={mounted ? viewMode : "grid"}
          onChange={handleViewChange}
        />
      </div>

      {/* Filter bar */}
      <LibraryFilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        resultCount={isLoading ? undefined : total}
      />

      {/* Artifact list / grid */}
      <section aria-label="Library artifacts" aria-busy={isLoading}>
        {isError && error ? (
          <ErrorState
            error={error}
            onRetry={() =>
              setFilters((f) => ({ ...f })) /* force re-query key change */
            }
          />
        ) : (
          <>
            <ul
              role="list"
              className={cn(
                "grid gap-3",
                viewMode === "grid"
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  : "grid-cols-1",
              )}
            >
              {/* Skeleton on initial load */}
              {isLoading && (
                <ArtifactCardSkeletonGrid
                  count={viewMode === "grid" ? 9 : 5}
                  variant={viewMode}
                />
              )}

              {/* Artifact cards */}
              {!isLoading &&
                artifacts.map((artifact) => (
                  <li key={artifact.id}>
                    <ArtifactCard
                      artifact={artifact}
                      variant={viewMode}
                      activeRun={artifact.active_run ?? undefined}
                    />
                  </li>
                ))}

              {/* Skeleton appended during next-page fetch */}
              {isFetchingNextPage && (
                <ArtifactCardSkeletonGrid
                  count={viewMode === "grid" ? 3 : 2}
                  variant={viewMode}
                />
              )}
            </ul>

            {/* Empty state */}
            {!isLoading && artifacts.length === 0 && (
              <EmptyState hasFilters={hasActiveFilters} />
            )}

            {/* Load more */}
            {hasNextPage && !isLoading && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  aria-label="Load more artifacts"
                  className={cn(
                    "inline-flex min-h-[44px] items-center gap-2 rounded-md border px-4 text-sm font-medium text-foreground sm:h-8 sm:min-h-0",
                    "transition-colors hover:bg-accent hover:text-accent-foreground",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  {isFetchingNextPage ? (
                    <>
                      <svg
                        aria-hidden="true"
                        className="size-3.5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
