"use client";

/**
 * Research Pages screen — facet-filtered Library view (taxonomy-redesign P5-03).
 *
 * Replaces the previous useResearchArtifacts (workspace=research) with
 * useLibraryArtifacts + facet="research" pre-set. This aligns Research as a
 * filtered view over the unified Library surface rather than a separate
 * workspace, consistent with the taxonomy-redesign spec.
 *
 * Changes from pre-P5-03:
 *   - Import: useResearchArtifacts → useLibraryArtifacts (from @/components/library)
 *   - filters.facet locked to "research"; lockedFacet="research" on LibraryFilterBar
 *   - hasActiveFilters omits separate facet check (facet is always locked)
 *   - Header: "Research-only view" badge callout so users distinguish from Library
 *   - Empty state text updated to reflect the research facet context
 *
 * URL shape: /research/pages — unchanged (bookmarks preserved).
 *
 * P4-01: original Research workspace structure + navigation.
 * P5-03: refactor to facet-filtered Library view.
 *
 * Stitch reference: "Research Home" (ID: 0cf6fb7b27d9459e8b5bebfea66915c5)
 */

import { useState, useCallback, useEffect } from "react";
import { LayoutGrid, List, AlertCircle, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArtifactCard } from "@/components/ui/artifact-card";
import { ArtifactCardSkeletonGrid } from "@/components/ui/artifact-card-skeleton";
import {
  LibraryFilterBar,
  useLensFilterUrlSync,
  useLibraryArtifacts,
  DEFAULT_LIBRARY_FILTERS,
  type LibraryFilters,
} from "@/components/library";

// ---------------------------------------------------------------------------
// View mode — persisted to localStorage (separate key from Library)
// ---------------------------------------------------------------------------

type ViewMode = "grid" | "list";
const VIEW_MODE_KEY = "meatywiki-research-view";

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "grid";
  try {
    const stored = window.localStorage.getItem(VIEW_MODE_KEY);
    if (stored === "list" || stored === "grid") return stored;
  } catch {
    // localStorage unavailable — fall back to default
  }
  return "grid";
}

// ---------------------------------------------------------------------------
// Research-only view indicator — distinguishes from the Library screen
// ---------------------------------------------------------------------------

function ResearchViewBadge() {
  return (
    <span
      aria-label="Filtered to research facet only"
      className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
    >
      <FlaskConical aria-hidden="true" className="size-3.5" />
      Research-only view
    </span>
  );
}

// ---------------------------------------------------------------------------
// View toggle
// ---------------------------------------------------------------------------

interface ViewToggleProps {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}

function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div role="group" aria-label="View layout" className="flex rounded-md border">
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
            d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          {hasFilters ? "No matching research pages" : "No research pages yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasFilters
            ? "Try adjusting or clearing the active filters."
            : "Compile research notes into the research workspace to see them here."}
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
          Failed to load research pages
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
// Research filters — LibraryFilters with facet locked to "research"
// ---------------------------------------------------------------------------

const DEFAULT_RESEARCH_VIEW_FILTERS: LibraryFilters = {
  ...DEFAULT_LIBRARY_FILTERS,
  facet: "research",
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ResearchPagesPage() {
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

  // Filter state — facet locked to "research"; lens filters hydrated from URL
  const [filters, setFilters] = useState<LibraryFilters>(() => ({
    ...DEFAULT_RESEARCH_VIEW_FILTERS,
    ...(readFromUrl() ?? {}),
    // Always re-apply the locked facet even if URL params tried to override it
    facet: "research",
  }));

  const handleFiltersChange = useCallback(
    (next: Partial<LibraryFilters>) => {
      setFilters((prev) => {
        const updated = {
          ...prev,
          ...next,
          // Prevent the facet from being changed by filter bar interactions
          facet: "research" as const,
        };
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

  // facet is always "research" (locked), so exclude it from "has active filters" check
  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.statuses.length > 0 ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    filters.lensFidelity.length > 0 ||
    filters.lensFreshness.length > 0 ||
    filters.lensVerification.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Research Pages</h1>
            <ResearchViewBadge />
          </div>
          <p className="text-sm text-muted-foreground">
            Research notes and compiled artifacts
          </p>
        </div>

        <ViewToggle
          view={mounted ? viewMode : "grid"}
          onChange={handleViewChange}
        />
      </div>

      {/* Filter bar — facet locked to "research" (chip row hidden, lock indicator shown) */}
      <LibraryFilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        resultCount={isLoading ? undefined : total}
        lockedFacet="research"
      />

      {/* Artifact list / grid */}
      <section aria-label="Research artifacts" aria-busy={isLoading}>
        {isError && error ? (
          <ErrorState
            error={error}
            onRetry={() => setFilters((f) => ({ ...f }))}
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
              {isLoading && (
                <ArtifactCardSkeletonGrid
                  count={viewMode === "grid" ? 9 : 5}
                  variant={viewMode}
                />
              )}

              {!isLoading &&
                artifacts.map((artifact) => (
                  <li key={artifact.id}>
                    <ArtifactCard artifact={artifact} variant={viewMode} />
                  </li>
                ))}

              {isFetchingNextPage && (
                <ArtifactCardSkeletonGrid
                  count={viewMode === "grid" ? 3 : 2}
                  variant={viewMode}
                />
              )}
            </ul>

            {!isLoading && artifacts.length === 0 && (
              <EmptyState hasFilters={hasActiveFilters} />
            )}

            {hasNextPage && !isLoading && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  aria-label="Load more research pages"
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
