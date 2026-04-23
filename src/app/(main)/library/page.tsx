"use client";

/**
 * Library screen — Universal Browser
 *
 * P3-01 (portal-v1.5-stitch-reskin): Three-column layout per design spec §4.1.
 *   - Left inner filter column (200px, sticky): Archive Filters (Type, Focus,
 *     Freshness, Status). Filter UI is wired to local state; real filter logic
 *     re-uses existing LibraryFilters shape and passes overrides to the query.
 *   - Main content area: 2-col CSS Grid, gap-4, grid-auto-flow dense.
 *     ArtifactCard rendering stubs over existing artifacts (variants land P3-02).
 *   - Right ContextRail (320px): auto-hides below 1280px; toggle button inline
 *     in page header (top-bar slot wired in later phases).
 *
 * Responsive scaffolding:
 *   - <768px (mobile): filter column hidden, ContextRail hidden (sidebar only).
 *   - 768–1279px (tablet): filter column visible, ContextRail collapsed (toggle).
 *   - ≥1280px (desktop): full three-column layout.
 *
 * Previous title "Knowledge Library" replaced with "Universal Browser" per Stitch.
 * Subtitle binds to `total` from the active data hook (falls back to artifacts.length).
 *
 * Data fetching + existing hooks (useLibraryArtifacts, useLibraryRollup,
 * LibraryLensSwitcher, LibraryFilterBar) are preserved unchanged.
 *
 * P3-02: hero/featured/standard variant selection logic.
 * P3-03: ContextRail selected-artifact data wiring.
 * P3-04: full responsive QA + dark-mode audit.
 *
 * Stitch reference: "Library" screen (§4.1, stitch-exports/v1/library/library.png)
 * Shell: Standard Archival
 */

import { useState, useCallback, useEffect } from "react";
import { LayoutGrid, List, AlertCircle, SlidersHorizontal, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArtifactCard } from "@/components/ui/artifact-card";
import { ArtifactCardSkeletonGrid } from "@/components/ui/artifact-card-skeleton";
import {
  LibraryFilterBar,
  useLensFilterUrlSync,
  useLibraryLensUrlSync,
  KNOWN_ARTIFACT_TYPES,
  KNOWN_STATUSES,
} from "@/components/ui/library-filter-bar";
import {
  LibraryLensSwitcher,
  type LibraryLens,
} from "@/components/ui/library-lens-switcher";
import {
  useLibraryArtifacts,
  DEFAULT_LIBRARY_FILTERS,
  type LibraryFilters,
} from "@/hooks/useLibraryArtifacts";
import { useLibraryRollup } from "@/hooks/useLibraryRollup";
import { ContextRail } from "@/components/ui/context-rail";
import {
  ContextRailProvider,
  useContextRailToggle,
} from "@/components/ui/context-rail-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "grid" | "list";
const VIEW_MODE_KEY = "meatywiki-library-view";

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
// Archive filter state (P3-01 stub — real filter logic wired in P3-04)
// ---------------------------------------------------------------------------

interface ArchiveFilters {
  /** Archive Type — maps to artifact types (multi-select) */
  archiveTypes: string[];
  /** Knowledge Focus — free-text tags (multi-select chips) */
  knowledgeFocus: string[];
  /** Freshness range: 0 = oldest, 100 = newest */
  freshness: [number, number];
  /** Archival status multi-select */
  archivalStatuses: string[];
}

const DEFAULT_ARCHIVE_FILTERS: ArchiveFilters = {
  archiveTypes: [],
  knowledgeFocus: [],
  freshness: [0, 100],
  archivalStatuses: [],
};

// Known knowledge focus tags (stub — future: derive from API)
const KNOWLEDGE_FOCUS_OPTIONS = [
  "Philosophy",
  "Mathematics",
  "Computer Science",
  "Biology",
  "History",
  "Economics",
  "Literature",
  "Physics",
];

// ---------------------------------------------------------------------------
// Lens → type mapping for grouped lenses
// ---------------------------------------------------------------------------

const GROUPED_LENS_TYPES: Partial<Record<LibraryLens, string>> = {
  concepts: "concept",
  entities: "entity",
  syntheses: "synthesis",
  evidence: "evidence",
  contradictions: "contradiction",
  glossary: "glossary",
};

function isRollupLens(lens: LibraryLens): boolean {
  return lens === "default" || lens === "orphans";
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
// ContextRail toggle button (inline in header for pages that own a rail)
// ---------------------------------------------------------------------------

function RailToggleButton() {
  const { toggle, isOpen } = useContextRailToggle();
  return (
    <button
      type="button"
      aria-label={isOpen ? "Hide context rail" : "Show context rail"}
      aria-pressed={isOpen}
      onClick={toggle}
      className={cn(
        "inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors xl:hidden sm:h-8 sm:min-h-0",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        isOpen
          ? "bg-accent text-accent-foreground border-accent"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <PanelRight aria-hidden="true" className="size-3.5" />
      <span className="hidden sm:inline">Context</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Left filter column
// ---------------------------------------------------------------------------

interface ArchiveFilterColumnProps {
  filters: ArchiveFilters;
  onChange: (next: Partial<ArchiveFilters>) => void;
}

function ArchiveFilterColumn({ filters, onChange }: ArchiveFilterColumnProps) {
  const [freshMin, freshMax] = filters.freshness;

  function toggleArchiveType(value: string) {
    const next = filters.archiveTypes.includes(value)
      ? filters.archiveTypes.filter((t) => t !== value)
      : [...filters.archiveTypes, value];
    onChange({ archiveTypes: next });
  }

  function toggleFocus(value: string) {
    const next = filters.knowledgeFocus.includes(value)
      ? filters.knowledgeFocus.filter((f) => f !== value)
      : [...filters.knowledgeFocus, value];
    onChange({ knowledgeFocus: next });
  }

  function toggleStatus(value: string) {
    const next = filters.archivalStatuses.includes(value)
      ? filters.archivalStatuses.filter((s) => s !== value)
      : [...filters.archivalStatuses, value];
    onChange({ archivalStatuses: next });
  }

  return (
    <aside
      aria-label="Archive filters"
      className={cn(
        // Fixed width, sticky scroll
        "w-[200px] shrink-0",
        "sticky top-0 self-start max-h-[calc(100vh-7rem)] overflow-y-auto",
        // Surface
        "rounded-lg border bg-card",
        // Hide entirely on mobile (<768px / md) — responsive scaffolding P3-01
        "hidden md:flex flex-col gap-0",
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b">
        <SlidersHorizontal aria-hidden="true" className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Archive Filters
        </span>
      </div>

      <div className="flex flex-col gap-4 p-3">

        {/* Archive Type */}
        <fieldset>
          <legend className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Archive Type
          </legend>
          <div className="flex flex-col gap-1">
            {KNOWN_ARTIFACT_TYPES.map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={filters.archiveTypes.includes(value)}
                  onChange={() => toggleArchiveType(value)}
                  className={cn(
                    "size-3.5 rounded border-input accent-primary",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                />
                <span className={cn(
                  "text-xs transition-colors",
                  filters.archiveTypes.includes(value)
                    ? "text-foreground font-medium"
                    : "text-muted-foreground group-hover:text-foreground",
                )}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Knowledge Focus */}
        <fieldset>
          <legend className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Knowledge Focus
          </legend>
          <div className="flex flex-wrap gap-1">
            {KNOWLEDGE_FOCUS_OPTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={filters.knowledgeFocus.includes(tag)}
                onClick={() => toggleFocus(tag)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  filters.knowledgeFocus.includes(tag)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Freshness */}
        <fieldset>
          <legend className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Freshness
          </legend>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Older</span>
              <span>Newer</span>
            </div>
            {/* Min bound */}
            <label className="sr-only" htmlFor="freshness-min">
              Freshness minimum
            </label>
            <input
              id="freshness-min"
              type="range"
              min={0}
              max={100}
              value={freshMin}
              onChange={(e) =>
                onChange({ freshness: [Number(e.target.value), freshMax] })
              }
              className="w-full accent-primary cursor-pointer"
              aria-label="Freshness minimum"
            />
            {/* Max bound */}
            <label className="sr-only" htmlFor="freshness-max">
              Freshness maximum
            </label>
            <input
              id="freshness-max"
              type="range"
              min={0}
              max={100}
              value={freshMax}
              onChange={(e) =>
                onChange({ freshness: [freshMin, Number(e.target.value)] })
              }
              className="w-full accent-primary cursor-pointer"
              aria-label="Freshness maximum"
            />
            <p className="text-[10px] text-muted-foreground text-center">
              {freshMin}% – {freshMax}%
            </p>
          </div>
        </fieldset>

        {/* Archival Status */}
        <fieldset>
          <legend className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Archival Status
          </legend>
          <div className="flex flex-col gap-1">
            {KNOWN_STATUSES.map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={filters.archivalStatuses.includes(value)}
                  onChange={() => toggleStatus(value)}
                  className={cn(
                    "size-3.5 rounded border-input accent-primary",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                />
                <span className={cn(
                  "text-xs transition-colors",
                  filters.archivalStatuses.includes(value)
                    ? "text-foreground font-medium"
                    : "text-muted-foreground group-hover:text-foreground",
                )}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Clear all */}
        {(filters.archiveTypes.length > 0 ||
          filters.knowledgeFocus.length > 0 ||
          filters.archivalStatuses.length > 0) && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_ARCHIVE_FILTERS)}
            className={cn(
              "text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
            )}
          >
            Clear all
          </button>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-16 text-center col-span-full"
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
          {hasFilters ? "No matching artifacts" : "The archive is empty. Capture something."}
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
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 py-12 text-center col-span-full"
    >
      <AlertCircle aria-hidden="true" className="size-8 text-destructive" />
      <div>
        <p className="text-sm font-medium text-foreground">Failed to load artifacts</p>
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
// ContextRail stub content (P3-03 wires real selected-artifact data)
// ---------------------------------------------------------------------------

const LIBRARY_RAIL_SECTIONS = [
  {
    id: "properties",
    title: "Properties",
    variant: "properties" as const,
    content: (
      <p className="text-xs text-muted-foreground px-4 py-2">
        Select an artifact to view its properties.
      </p>
    ),
  },
  {
    id: "connections",
    title: "Connections",
    variant: "connections" as const,
    content: (
      <p className="text-xs text-muted-foreground px-4 py-2">
        Linked artifacts and synthesis references will appear here.
      </p>
    ),
  },
  {
    id: "history",
    title: "History",
    variant: "activity" as const,
    content: (
      <p className="text-xs text-muted-foreground px-4 py-2">
        Activity timeline and lineage will appear here.
      </p>
    ),
  },
];

// ---------------------------------------------------------------------------
// Inner page (requires ContextRailProvider in scope)
// ---------------------------------------------------------------------------

function LibraryPageInner() {
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
  // URL sync for library lens switcher (library-source-rollup-v1 FE-06)
  const { readLensFromUrl, syncLensToUrl } = useLibraryLensUrlSync();

  // Lens state — initialise from URL on mount
  const [lens, setLens] = useState<LibraryLens>(() => {
    if (typeof window === "undefined") return "default";
    return readLensFromUrl() ?? "default";
  });

  const handleLensChange = useCallback(
    (next: LibraryLens) => {
      setLens(next);
      syncLensToUrl(next);
    },
    [syncLensToUrl],
  );

  // Library query filter state — initialise lens filters from URL on mount
  const [filters, setFilters] = useState<LibraryFilters>(() => ({
    ...DEFAULT_LIBRARY_FILTERS,
    ...(readFromUrl() ?? {}),
  }));

  const handleFiltersChange = useCallback(
    (next: Partial<LibraryFilters>) => {
      setFilters((prev) => {
        const updated = { ...prev, ...next };
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

  // Archive filter state (P3-01 stub — types/statuses fed back to query in P3-04)
  const [archiveFilters, setArchiveFilters] = useState<ArchiveFilters>(
    DEFAULT_ARCHIVE_FILTERS,
  );

  const handleArchiveFilterChange = useCallback(
    (next: Partial<ArchiveFilters>) => {
      setArchiveFilters((prev) => ({ ...prev, ...next }));
      // Propagate type/status selections to the library query filters (stub wiring)
      if (next.archiveTypes !== undefined) {
        handleFiltersChange({ types: next.archiveTypes });
      }
      if (next.archivalStatuses !== undefined) {
        handleFiltersChange({
          statuses: next.archivalStatuses as LibraryFilters["statuses"],
        });
      }
    },
    [handleFiltersChange],
  );

  // Data fetching — source depends on active lens
  const rollupResult = useLibraryRollup({
    filters,
    rollupLens: lens === "orphans" ? "orphans" : undefined,
  });

  const groupedLensType = GROUPED_LENS_TYPES[lens];
  const groupedFilters: LibraryFilters = groupedLensType
    ? { ...filters, types: [groupedLensType] }
    : filters;
  const flatResult = useLibraryArtifacts(groupedFilters);

  const {
    artifacts,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
    total,
  } = isRollupLens(lens) ? rollupResult : flatResult;

  // Artifact count for subtitle — prefer facet total, fall back to loaded count
  const artifactCount = total ?? artifacts.length;

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.statuses.length > 0 ||
    !!filters.facet ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    filters.lensFidelity.length > 0 ||
    filters.lensFreshness.length > 0 ||
    filters.lensVerification.length > 0 ||
    archiveFilters.archiveTypes.length > 0 ||
    archiveFilters.knowledgeFocus.length > 0 ||
    archiveFilters.archivalStatuses.length > 0;

  return (
    // Full-height flex column — fills the shell's <main> area
    <div className="flex flex-col gap-4 h-full">

      {/* ------------------------------------------------------------------ */}
      {/* Page header row                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Universal Browser
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading
              ? "Loading artifacts…"
              : `Refining ${artifactCount.toLocaleString()} curated artifact${artifactCount !== 1 ? "s" : ""}…`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* ContextRail toggle — only visible below xl (≥1280px rail is always shown) */}
          <RailToggleButton />
          <ViewToggle
            view={mounted ? viewMode : "grid"}
            onChange={handleViewChange}
          />
        </div>
      </div>

      {/* Lens switcher (library-source-rollup-v1 FE-06) */}
      <LibraryLensSwitcher lens={lens} onLensChange={handleLensChange} />

      {/* Filter bar — top strip for sort/search/lens filters */}
      <LibraryFilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        resultCount={isLoading ? undefined : total}
        hiddenFilterSections={
          !isRollupLens(lens) && !!groupedLensType ? ["type"] : undefined
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* Three-column body: filter col | main grid | context rail            */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 min-h-0 gap-4 items-start">

        {/* Left filter column — 200px fixed, sticky, hidden <768px */}
        <ArchiveFilterColumn
          filters={archiveFilters}
          onChange={handleArchiveFilterChange}
        />

        {/* Main content area — 2-col CSS grid, masonry-friendly */}
        <section
          aria-label="Library artifacts"
          aria-busy={isLoading}
          className="flex-1 min-w-0"
        >
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
                  "grid gap-4",
                  viewMode === "grid"
                    ? // 2-col masonry-style grid; dense packing fills gaps
                      "grid-cols-1 sm:grid-cols-2 [grid-auto-flow:dense]"
                    : "grid-cols-1",
                )}
              >
                {/* Skeleton on initial load */}
                {isLoading && (
                  <ArtifactCardSkeletonGrid
                    count={viewMode === "grid" ? 6 : 5}
                    variant={viewMode}
                  />
                )}

                {/* Artifact cards
                    P3-02 will introduce hero/featured/standard variant selection.
                    For P3-01, all cards render as standard to preserve existing behavior. */}
                {!isLoading &&
                  artifacts.map((artifact) => (
                    <li key={artifact.id}>
                      <ArtifactCard
                        artifact={artifact}
                        variant={viewMode}
                        displayVariant="standard"
                        typeAccent
                        activeRun={artifact.active_run ?? undefined}
                      />
                    </li>
                  ))}

                {/* Skeleton appended during next-page fetch */}
                {isFetchingNextPage && (
                  <ArtifactCardSkeletonGrid
                    count={viewMode === "grid" ? 2 : 2}
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

        {/* Right ContextRail — 320px, auto-hides <1280px via xl:block CSS */}
        <ContextRail
          title="Context"
          sections={LIBRARY_RAIL_SECTIONS}
          collapsible
          width={320}
          // Pull out of normal flow so it doesn't push the grid; sticky to viewport
          className="sticky top-0 self-start max-h-[calc(100vh-7rem)] overflow-hidden"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export — wraps inner page with ContextRailProvider
// ---------------------------------------------------------------------------

export default function LibraryPage() {
  return (
    <ContextRailProvider defaultOpen={false}>
      <LibraryPageInner />
    </ContextRailProvider>
  );
}
