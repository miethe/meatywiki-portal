"use client";

/**
 * Projects screen — filtered Library view (taxonomy-redesign P5-05).
 *
 * Renders the Library card + filter layout with `facet='projects'` pre-applied
 * via `lockedFacet`. The facet is locked (not user-editable); all other filters
 * (type, status, date range, lens) remain available.
 *
 * Visual distinction: amber "Project planning" facet badge in the page header,
 * mirroring the locked-facet indicator already rendered inside LibraryFilterBar.
 *
 * Pattern mirrors the Research (P5-03) and Blog (P5-04) filtered views.
 *
 * URL: /projects — no sub-routes in v1. URL shape kept minimal (YAGNI).
 *
 * Stitch reference: "Projects" workspace (taxonomy-redesign design-pass phase 5).
 */

import { useState, useCallback, useEffect } from "react";
import { LayoutGrid, List, AlertCircle, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ArtifactCard,
  LibraryFilterBar,
  useLensFilterUrlSync,
  useLibraryArtifacts,
  DEFAULT_LIBRARY_FILTERS,
} from "@/components/library";
import { ArtifactCardSkeletonGrid } from "@/components/ui/artifact-card-skeleton";
import type { LibraryFilters } from "@/components/library";

// ---------------------------------------------------------------------------
// The locked facet for this screen
// ---------------------------------------------------------------------------

const PROJECTS_FACET = "projects" as const;

// ---------------------------------------------------------------------------
// View mode — persisted to localStorage (separate key from Library)
// ---------------------------------------------------------------------------

type ViewMode = "grid" | "list";
const VIEW_MODE_KEY = "meatywiki-projects-view";

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
// View toggle — identical shape to Library/Blog screens
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
// Empty state — projects-specific copy
// ---------------------------------------------------------------------------

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30">
        <FolderKanban aria-hidden="true" className="size-6 text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          {hasFilters ? "No matching project artifacts" : "No project artifacts yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasFilters
            ? "Try adjusting or clearing the active filters."
            : "Project artifacts compiled into the workspace will appear here."}
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
        <p className="text-sm font-medium text-foreground">Failed to load project artifacts</p>
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
// Projects facet badge — "Project planning" visual indicator in the header
// ---------------------------------------------------------------------------

function ProjectsFacetBadge() {
  return (
    <span
      aria-label="Filtered to projects facet: Project planning"
      className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
    >
      <FolderKanban aria-hidden="true" className="size-3.5" />
      Project planning
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ProjectsPage() {
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

  // URL sync for lens filters — same hook as Library/Research/Blog screens
  const { readFromUrl, syncToUrl } = useLensFilterUrlSync();

  // Filter state — facet locked to "projects"; all other filters user-editable
  const [filters, setFilters] = useState<LibraryFilters>(() => ({
    ...DEFAULT_LIBRARY_FILTERS,
    facet: PROJECTS_FACET,
    ...(readFromUrl() ?? {}),
  }));

  const handleFiltersChange = useCallback(
    (next: Partial<LibraryFilters>) => {
      setFilters((prev) => {
        // Enforce the locked facet — never let a partial update override it
        const updated: LibraryFilters = { ...prev, ...next, facet: PROJECTS_FACET };
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

  // Data fetching — facet="projects" is baked into filters state
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
    !!filters.dateFrom ||
    !!filters.dateTo ||
    filters.lensFidelity.length > 0 ||
    filters.lensFreshness.length > 0 ||
    filters.lensVerification.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            {/* Visual badge indicating "Project planning" facet — P5-05 requirement */}
            <ProjectsFacetBadge />
          </div>
          <p className="text-sm text-muted-foreground">
            Project planning artifacts — filtered Library view
          </p>
        </div>

        <ViewToggle
          view={mounted ? viewMode : "grid"}
          onChange={handleViewChange}
        />
      </div>

      {/* Filter bar — facet row hidden (lockedFacet="projects"), rest user-editable */}
      <LibraryFilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        resultCount={isLoading ? undefined : total}
        lockedFacet={PROJECTS_FACET}
      />

      {/* Artifact list / grid */}
      <section aria-label="Project artifacts" aria-busy={isLoading}>
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
                    <ArtifactCard artifact={artifact} variant={viewMode} />
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
                  aria-label="Load more project artifacts"
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
