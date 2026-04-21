"use client";

/**
 * Blog Posts screen — filtered Library view scoped to facet='blog'.
 *
 * Taxonomy-redesign P5-04: Refactors the Blog screen to use the shared Library
 * card layout, filter bar, and pagination hook. The `facet` filter is locked to
 * "blog" via `lockedFacet="blog"` on LibraryFilterBar and the initial filter
 * state — users cannot change it. The existing blog sub-nav (Posts | Outline
 * Builder) is preserved via the surrounding BlogLayout.
 *
 * Visual distinction: an orange "Blog writing" facet callout appears below the
 * page header, consistent with FacetBadge blog colours (orange-100/orange-800).
 *
 * Lens filter URL sync is preserved from the Library screen pattern.
 *
 * Stitch reference: blog-workspace.html (ID: 201421e9905c4255ad32da8c2304b69c)
 */

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { LayoutGrid, List, Plus, PenLine, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ArtifactCard,
  LibraryFilterBar,
  useLensFilterUrlSync,
  useLibraryArtifacts,
  DEFAULT_LIBRARY_FILTERS,
  type LibraryFilters,
} from "@/components/library";
import { ArtifactCardSkeletonGrid } from "@/components/ui/artifact-card-skeleton";

// ---------------------------------------------------------------------------
// View mode — persisted to localStorage
// ---------------------------------------------------------------------------

type ViewMode = "grid" | "list";
const VIEW_MODE_KEY = "meatywiki-blog-view";

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "grid";
  try {
    const stored = window.localStorage.getItem(VIEW_MODE_KEY);
    if (stored === "list" || stored === "grid") return stored;
  } catch {
    // localStorage unavailable (private browsing, etc.)
  }
  return "grid";
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
// Blog facet callout — visual header indicator (P5-04)
// ---------------------------------------------------------------------------

function BlogFacetCallout() {
  return (
    <div
      aria-label="Blog writing facet — filtered view"
      className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 dark:border-orange-900/50 dark:bg-orange-950/30"
    >
      <PenLine
        aria-hidden="true"
        className="size-4 shrink-0 text-orange-600 dark:text-orange-400"
      />
      <p className="text-xs font-medium text-orange-800 dark:text-orange-300">
        Blog writing
      </p>
      <span
        aria-hidden="true"
        className="ml-1 rounded-sm bg-orange-100 px-1.5 py-0.5 text-[11px] font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
      >
        Filtered view
      </span>
      <p className="ml-auto text-[11px] text-orange-600/80 dark:text-orange-400/70">
        Showing artifacts in the Blog facet only
      </p>
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
        <PenLine aria-hidden="true" className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          {hasFilters ? "No matching blog artifacts" : "No blog artifacts yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasFilters
            ? "Try adjusting or clearing the active filters."
            : "Compile some blog notes to start building your writing workspace."}
        </p>
      </div>
      {!hasFilters && (
        <Link
          href="/blog/posts/new"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          New post
        </Link>
      )}
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
          Failed to load blog artifacts
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
// Page
// ---------------------------------------------------------------------------

/** Blog Posts page — Library filtered to facet='blog' (P5-04). */
export default function BlogPostsPage() {
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
      // ignore localStorage errors
    }
  }, []);

  // URL sync for lens filters
  const { readFromUrl, syncToUrl } = useLensFilterUrlSync();

  // Filter state — facet locked to "blog"; initialise lens filters from URL
  const [filters, setFilters] = useState<LibraryFilters>(() => ({
    ...DEFAULT_LIBRARY_FILTERS,
    facet: "blog",
    ...(readFromUrl() ?? {}),
  }));

  const handleFiltersChange = useCallback(
    (next: Partial<LibraryFilters>) => {
      setFilters((prev) => {
        const updated = {
          ...prev,
          ...next,
          // Keep facet locked — never allow overriding the blog facet
          facet: "blog" as const,
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
          <h1 className="text-2xl font-semibold tracking-tight">Blog Posts</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${total} artifact${total !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ViewToggle view={mounted ? viewMode : "grid"} onChange={handleViewChange} />
          <Link
            href="/blog/posts/new"
            aria-label="Create new blog post"
            className={cn(
              "inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-sm font-medium sm:h-8 sm:min-h-0",
              "transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            <Plus aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">New post</span>
          </Link>
        </div>
      </div>

      {/* Blog facet callout — visual distinction from Library (P5-04) */}
      <BlogFacetCallout />

      {/* Filter bar — facet row hidden via lockedFacet="blog" */}
      <LibraryFilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        resultCount={isLoading ? undefined : total}
        lockedFacet="blog"
      />

      {/* Artifact list / grid */}
      <section aria-label="Blog artifacts" aria-busy={isLoading}>
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
                  aria-label="Load more blog artifacts"
                  className={cn(
                    "inline-flex h-8 items-center gap-2 rounded-md border px-4 text-sm font-medium text-foreground",
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
