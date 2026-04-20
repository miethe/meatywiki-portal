"use client";

/**
 * BlogWorkspaceScreen — lists blog posts with status facets and view toggle.
 *
 * Filters: draft | compiled | published | archived (multi-select pill facets).
 * View toggle: grid / list (persisted to localStorage).
 * Pagination: cursor-based Load More.
 *
 * P1.5-3-03: Blog workspace screens
 * Stitch reference: blog-workspace.html (ID: 201421e9905c4255ad32da8c2304b69c)
 */

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { LayoutGrid, List, Plus, AlertCircle, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { BlogPostCard } from "@/components/blog/blog-post-card";
import { BlogPostCardSkeletonGrid } from "@/components/blog/blog-post-card-skeleton";
import {
  useBlogPosts,
  DEFAULT_BLOG_FILTERS,
  type BlogFilters,
} from "@/hooks/useBlogPosts";
import type { BlogPostStatus } from "@/lib/api/blog";

// ---------------------------------------------------------------------------
// View mode persistence
// ---------------------------------------------------------------------------

type ViewMode = "grid" | "list";
const VIEW_MODE_KEY = "meatywiki-blog-view";

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "grid";
  try {
    const stored = window.localStorage.getItem(VIEW_MODE_KEY);
    if (stored === "list" || stored === "grid") return stored;
  } catch {
    // localStorage unavailable
  }
  return "grid";
}

// ---------------------------------------------------------------------------
// Status facets
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: BlogPostStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "compiled", label: "Compiled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

function StatusFacets({
  selected,
  onChange,
}: {
  selected: BlogPostStatus[];
  onChange: (next: BlogPostStatus[]) => void;
}) {
  function toggle(status: BlogPostStatus) {
    if (selected.includes(status)) {
      onChange(selected.filter((s) => s !== status));
    } else {
      onChange([...selected, status]);
    }
  }

  return (
    <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
      {STATUS_OPTIONS.map(({ value, label }) => {
        const active = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(value)}
            className={cn(
              "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View toggle
// ---------------------------------------------------------------------------

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
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
        <PenLine aria-hidden="true" className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          {hasFilters ? "No matching posts" : "No blog posts yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasFilters
            ? "Try adjusting or clearing the active filters."
            : "Create your first blog post to get started."}
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
          Failed to load blog posts
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

export default function BlogPostsPage() {
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
      // ignore
    }
  }, []);

  const [filters, setFilters] = useState<BlogFilters>({
    ...DEFAULT_BLOG_FILTERS,
  });

  const {
    posts,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
    total,
  } = useBlogPosts(filters);

  const hasActiveFilters = filters.statuses.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blog Posts</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${total} post${total !== 1 ? "s" : ""}`}
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

      {/* Status facets */}
      <StatusFacets
        selected={filters.statuses}
        onChange={(statuses) => setFilters((f) => ({ ...f, statuses }))}
      />

      {/* Post grid / list */}
      <section aria-label="Blog posts" aria-busy={isLoading}>
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
                <BlogPostCardSkeletonGrid
                  count={viewMode === "grid" ? 9 : 5}
                  variant={viewMode}
                />
              )}

              {!isLoading &&
                posts.map((post) => (
                  <li key={post.artifact_id}>
                    <BlogPostCard post={post} variant={viewMode} />
                  </li>
                ))}

              {isFetchingNextPage && (
                <BlogPostCardSkeletonGrid
                  count={viewMode === "grid" ? 3 : 2}
                  variant={viewMode}
                />
              )}
            </ul>

            {!isLoading && posts.length === 0 && (
              <EmptyState hasFilters={hasActiveFilters} />
            )}

            {hasNextPage && !isLoading && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  aria-label="Load more blog posts"
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
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
