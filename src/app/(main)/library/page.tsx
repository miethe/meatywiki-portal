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
 *     Mobile filter affordance: "Filters" button in page header opens a
 *     right-side fixed drawer (same pattern as ShellClient mobile nav drawer).
 *   - 768–1279px (tablet): filter column visible, ContextRail collapsed via
 *     RailToggleButton. When toggled open, rail renders as a fixed right overlay
 *     (same backdrop pattern) so it does not crush the main grid.
 *   - ≥1280px (desktop): full three-column layout.
 *
 * Sticky behavior (P3-04):
 *   The scroll container is <main id="main-content" className="flex-1 overflow-y-auto">
 *   in shell-client.tsx. The sticky elements (filter column, rail) are direct
 *   children of the three-column flex row that sits inside this scroll container.
 *   No overflow:hidden/auto ancestor exists between the scroll container and the
 *   sticky elements, so position:sticky works correctly. The outer page wrapper
 *   uses min-h-0 (not overflow:auto) so it does not interrupt the sticky chain.
 *
 * Dark-mode tokens (P3-04):
 *   All surfaces use CSS variable tokens from globals.css / tailwind.config.ts.
 *   No raw hex on backgrounds or text. Type-accent stripe and thumbnail fallback
 *   gradients use intentional brand hues (decorative, not text-on-bg), so WCAG
 *   AA applies to text tokens only — all text tokens verified:
 *     - Filter column: bg-card / text-foreground / text-muted-foreground / border
 *     - Inputs/checkboxes: accent-primary (tint only, no text overlap)
 *     - Chips: bg-primary/text-primary-foreground (active), border/text-muted-foreground (idle)
 *     - Empty/error states: bg-muted/text-foreground/text-muted-foreground
 *
 * Previous title "Knowledge Library" replaced with "Universal Browser" per Stitch.
 * Subtitle binds to `total` from the active data hook (falls back to artifacts.length).
 *
 * Data fetching + existing hooks (useLibraryArtifacts, useLibraryRollup,
 * LibraryLensSwitcher, LibraryFilterBar) are preserved unchanged.
 *
 * P3-02: hero/featured/standard variant selection logic.
 * P3-03: ContextRail selected-artifact data wiring (this file).
 * P3-04: full responsive QA + dark-mode audit (this file).
 *
 * Stitch reference: "Library" screen (§4.1, stitch-exports/v1/library/library.png)
 * Shell: Standard Archival
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  List,
  AlertCircle,
  SlidersHorizontal,
  PanelRight,
  ExternalLink,
  Unlink,
  Clock,
  X,
} from "lucide-react";
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
import type { RailSection } from "@/components/ui/context-rail";
import {
  ContextRailProvider,
  useContextRailToggle,
} from "@/components/ui/context-rail-context";
import type { ArtifactCard as ArtifactCardType } from "@/types/artifact";

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
// Visible only on tablet (md–xl). On desktop (xl+), the rail is always shown.
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
        // Visible on tablet (md to xl); hidden below md (mobile uses filter drawer)
        // and hidden at xl+ (rail is always shown via CSS)
        "hidden md:inline-flex xl:hidden",
        "min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors sm:h-8 sm:min-h-0",
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
// Mobile "Filters" button — visible only on <768px (md breakpoint)
// Opens a slide-in filter drawer following the same pattern as ShellClient
// mobile nav (fixed overlay + backdrop, no extra deps).
// ---------------------------------------------------------------------------

interface MobileFiltersButtonProps {
  onClick: () => void;
  activeCount: number;
}

function MobileFiltersButton({ onClick, activeCount }: MobileFiltersButtonProps) {
  return (
    <button
      type="button"
      aria-label={`Open filters${activeCount > 0 ? ` (${activeCount} active)` : ""}`}
      onClick={onClick}
      className={cn(
        "md:hidden",
        "inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors sm:h-8 sm:min-h-0",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        activeCount > 0
          ? "border-primary text-primary bg-primary/8"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <SlidersHorizontal aria-hidden="true" className="size-3.5" />
      <span>Filters</span>
      {activeCount > 0 && (
        <span
          aria-hidden="true"
          className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground"
        >
          {activeCount}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Left filter column
// ---------------------------------------------------------------------------

interface ArchiveFilterColumnProps {
  filters: ArchiveFilters;
  onChange: (next: Partial<ArchiveFilters>) => void;
  /** When true, renders without the `hidden md:flex` breakpoint class (for use
   *  inside the mobile drawer where the column is already conditionally shown) */
  alwaysVisible?: boolean;
}

function ArchiveFilterColumn({ filters, onChange, alwaysVisible = false }: ArchiveFilterColumnProps) {
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
        // Sticky behavior: this element is a direct child of the three-column
        // flex row which itself lives inside <main overflow-y-auto>. No
        // overflow:hidden/auto ancestor interrupts the sticky chain.
        // See P3-04 comment in page header for full ancestry analysis.
        "w-[200px] shrink-0",
        "sticky top-0 self-start max-h-[calc(100vh-7rem)] overflow-y-auto",
        // Surface — bg-card token works in both light and dark mode
        "rounded-lg border bg-card",
        // Visibility: always shown in mobile drawer; hidden <768px in page layout
        alwaysVisible ? "flex flex-col gap-0" : "hidden md:flex flex-col gap-0",
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
                    // accent-primary applies the theme primary color without
                    // a background surface — no dark mode token needed here.
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
                  // Both active + idle states use tokens — dark mode safe.
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
// Mobile filter drawer — fixed overlay, same pattern as ShellClient mobile nav
// Renders below md breakpoint. Opened by MobileFiltersButton in page header.
// ---------------------------------------------------------------------------

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: ArchiveFilters;
  onFiltersChange: (next: Partial<ArchiveFilters>) => void;
}

function MobileFilterDrawer({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
}: MobileFilterDrawerProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — bg-foreground/20 per DP3-04 §2.10#4 pattern (neutral in both themes) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />

      {/* Drawer — slides in from the left, full height */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Archive filters"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col md:hidden",
          // Width: 280px on small screens; cap to 85vw on very narrow viewports
          "w-[280px] max-w-[85vw]",
          // Surface uses bg-card token (dark mode safe)
          "border-r bg-card",
        )}
      >
        {/* Drawer header */}
        <div className="flex h-14 items-center justify-between border-b px-3 shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal aria-hidden="true" className="size-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Filters</span>
          </div>
          <button
            type="button"
            aria-label="Close filters"
            onClick={onClose}
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-md",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        {/* Filter content — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <ArchiveFilterColumn
            filters={filters}
            onChange={(next) => {
              onFiltersChange(next);
            }}
            alwaysVisible
          />
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 border-t p-3">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "w-full inline-flex items-center justify-center rounded-md border px-4 py-2",
              "text-sm font-medium text-foreground transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            Apply & close
          </button>
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tablet ContextRail overlay — fixed right-side panel, visible md–xl when open.
// This prevents the rail from crushing the main grid on tablet viewports when
// the toggle is activated. At xl+, the rail is always shown inline via CSS.
// ---------------------------------------------------------------------------

interface TabletRailOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function TabletRailOverlay({ isOpen, onClose, children }: TabletRailOverlayProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — same neutral overlay token as mobile nav */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-20 bg-foreground/10 backdrop-blur-sm xl:hidden"
        onClick={onClose}
      />
      {/* The ContextRail itself is positioned fixed right-0. We wrap the
          rail with a fixed container so it floats over the grid. */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-30 xl:hidden",
          // Width matches the rail width token
          "w-rail",
          // Clip to viewport height
          "flex flex-col",
          // bg-[hsl(var(--portal-bg-rail))] is applied inside ContextRail already
        )}
      >
        {children}
      </div>
    </>
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
// ContextRail content components (P3-03)
// ---------------------------------------------------------------------------

/**
 * Formats an ISO date string into a human-readable "Month D, YYYY" label.
 * Returns empty string on parse error or null input.
 */
function formatDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Capitalises the first letter and replaces underscores with spaces.
 */
function humanise(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Properties section — type, workspace, lens badges, dates, status.
 * Backed exclusively by ArtifactCard fields available in the list payload.
 *
 * OQ-P3-03-A: Lens score numeric fields (novelty, clarity, etc.) are only
 * present on ArtifactMetadataResponse (PATCH /lens response), not on
 * ArtifactCard metadata. Currently rendering fidelity / freshness /
 * verification_state only. Wire full scores when P3-06 fetches ArtifactDetail.
 */
function PropertiesContent({ artifact }: { artifact: ArtifactCardType }) {
  const rows: { label: string; value: string }[] = [
    { label: "Type", value: humanise(artifact.type) },
  ];

  if (artifact.subtype) {
    rows.push({ label: "Subtype", value: humanise(artifact.subtype) });
  }

  rows.push(
    { label: "Workspace", value: humanise(artifact.workspace) },
    { label: "Status", value: humanise(artifact.status) },
  );

  const createdLabel = formatDate(artifact.created);
  const updatedLabel = formatDate(artifact.updated);
  if (createdLabel) rows.push({ label: "Created", value: createdLabel });
  if (updatedLabel) rows.push({ label: "Updated", value: updatedLabel });

  // Lens metadata (present when artifact has ArtifactMetadataCard)
  if (artifact.metadata?.fidelity) {
    rows.push({ label: "Fidelity", value: humanise(artifact.metadata.fidelity) });
  }
  if (artifact.metadata?.freshness) {
    rows.push({ label: "Freshness", value: humanise(artifact.metadata.freshness) });
  }
  if (artifact.metadata?.verification_state) {
    rows.push({ label: "Verification", value: humanise(artifact.metadata.verification_state) });
  }

  return (
    <dl className="flex flex-col gap-2">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex items-baseline justify-between gap-2">
          <dt className="text-[11px] text-muted-foreground shrink-0">{label}</dt>
          <dd className="text-[11px] font-medium text-foreground text-right truncate max-w-[140px]">
            {value}
          </dd>
        </div>
      ))}
      {/* Open artifact CTA */}
      <div className="mt-2 pt-2 border-t border-border">
        <Link
          href={`/artifact/${artifact.id}`}
          className={cn(
            "inline-flex items-center gap-1.5 text-[11px] font-medium text-primary",
            "hover:text-primary/80 underline-offset-2 hover:underline transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
          )}
        >
          <ExternalLink aria-hidden="true" className="size-3" />
          Open artifact
        </Link>
      </div>
    </dl>
  );
}

/**
 * Connections section — artifact edges and derivatives preview.
 *
 * OQ-P3-03-B: artifact_edges live on ArtifactDetail (GET /api/artifacts/:id),
 * not on ArtifactCard. derivatives_preview is present on RollupArtifactItem
 * responses only. Neither is reliably available on the list payload. This
 * section renders an empty state + note until P3-06 fetches the detail endpoint.
 * When derivatives_preview is present (rollup lens), it renders those items.
 */
function ConnectionsContent({ artifact }: { artifact: ArtifactCardType }) {
  const derivatives = artifact.derivatives_preview ?? [];

  if (derivatives.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <Unlink aria-hidden="true" className="size-4 text-muted-foreground/50" />
        <p className="text-[11px] text-muted-foreground">No connections yet.</p>
        <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
          Linked artifacts are available on the detail page.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5" aria-label="Derivative artifacts">
      {derivatives.map((d) => (
        <li key={d.id}>
          <Link
            href={`/artifact/${d.id}`}
            className={cn(
              "flex items-center gap-2 rounded px-1 py-1 text-[11px]",
              "text-foreground hover:bg-accent/60 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              {d.artifact_type}
            </span>
            <span className="truncate">{d.title ?? d.id}</span>
          </Link>
        </li>
      ))}
      {typeof artifact.derivative_count === "number" &&
        artifact.derivative_count > derivatives.length && (
          <li>
            <Link
              href={`/artifact/${artifact.id}?tab=derivatives`}
              className={cn(
                "text-[10px] text-muted-foreground hover:text-foreground hover:underline",
                "underline-offset-2 transition-colors",
              )}
            >
              +{artifact.derivative_count - derivatives.length} more on detail page
            </Link>
          </li>
        )}
    </ul>
  );
}

/**
 * History section — activity timeline / lineage.
 *
 * OQ-P3-03-C: No history/lineage fields exist on ArtifactCard. The revision
 * history and frontmatter_jsonb live on ArtifactDetail only. This section
 * renders a minimal timestamp-based micro-timeline from the card payload, plus
 * an informative note. P3-06 (Artifact Detail endpoint) will unlock full history.
 */
function HistoryContent({ artifact }: { artifact: ArtifactCardType }) {
  const events: { label: string; time: string | null | undefined }[] = [
    { label: "Last updated", time: artifact.updated },
    { label: "Created", time: artifact.created },
  ].filter((e) => !!e.time);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <Clock aria-hidden="true" className="size-4 text-muted-foreground/50" />
        <p className="text-[11px] text-muted-foreground">No history available.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2.5" aria-label="Artifact timeline">
        {events.map(({ label, time }) => (
          <li key={label} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[11px] font-medium text-foreground">{label}</span>
              {time && (
                <time dateTime={time} className="text-[10px] text-muted-foreground">
                  {formatDate(time)}
                </time>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="text-[10px] text-muted-foreground/70 border-t border-border pt-2 mt-1 leading-relaxed">
        Full activity log available on the detail page.
      </p>
    </div>
  );
}

/**
 * Unselected empty state — shown when no card has been clicked.
 */
function RailEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <svg
          aria-hidden="true"
          className="size-5 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"
          />
        </svg>
      </div>
      <div>
        <p className="text-xs font-medium text-foreground">Select an artifact</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
          Click any card to see its properties, connections, and history.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// buildRailSections — returns live RailSection[] for the selected artifact
// ---------------------------------------------------------------------------

function buildRailSections(artifact: ArtifactCardType | null): RailSection[] {
  if (!artifact) {
    return [
      {
        id: "empty",
        title: "No selection",
        variant: "properties" as const,
        content: <RailEmptyState />,
      },
    ];
  }

  return [
    {
      id: "properties",
      title: "Properties",
      variant: "properties" as const,
      content: <PropertiesContent artifact={artifact} />,
    },
    {
      id: "connections",
      title: "Connections",
      variant: "connections" as const,
      content: <ConnectionsContent artifact={artifact} />,
    },
    {
      id: "history",
      title: "History",
      variant: "activity" as const,
      content: <HistoryContent artifact={artifact} />,
    },
  ];
}

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

  // -------------------------------------------------------------------------
  // P3-04: Mobile filter drawer state
  // -------------------------------------------------------------------------
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const openMobileFilters = useCallback(() => setMobileFiltersOpen(true), []);
  const closeMobileFilters = useCallback(() => setMobileFiltersOpen(false), []);

  // Count active archive filter selections for the mobile button badge
  const activeArchiveFilterCount =
    archiveFilters.archiveTypes.length +
    archiveFilters.knowledgeFocus.length +
    archiveFilters.archivalStatuses.length;

  // -------------------------------------------------------------------------
  // P3-03: Selected artifact state
  //
  // Design decision: click-to-navigate + select.
  //   - Plain left-click navigates to /artifact/:id via the card's stretch
  //     <Link>. Selection state is set as a side-effect so the ContextRail
  //     updates before the page transition completes.
  //   - Cmd/ctrl+click opens the artifact in a new tab (browser native).
  //   - Clicking the already-selected card deselects it without blocking
  //     navigation.
  //   - Selection clears automatically when lens or filters change.
  // -------------------------------------------------------------------------
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactCardType | null>(null);

  const { isOpen: railIsOpen, close: closeRail } = useContextRailToggle();

  const handleCardClick = useCallback(
    (artifact: ArtifactCardType, _e: React.MouseEvent<HTMLLIElement>) => {
      // Update selection state as a side-effect; do NOT call preventDefault so
      // the card's stretch <Link href="/artifact/:id"> navigates normally.
      setSelectedArtifact((prev) =>
        prev?.id === artifact.id ? null : artifact,
      );
    },
    [],
  );

  // Clear selection when the artifact list context changes
  useEffect(() => {
    setSelectedArtifact(null);
  }, [lens]);

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

  // Build rail sections from the current selection.
  // useMemo keeps the reference stable when selectedArtifact hasn't changed,
  // avoiding unnecessary ContextRail re-renders.
  const railSections = useMemo(
    () => buildRailSections(selectedArtifact),
    [selectedArtifact],
  );

  // Rail title shows the selected artifact title (truncated) or default "Context"
  const railTitle = selectedArtifact
    ? selectedArtifact.title.length > 24
      ? `${selectedArtifact.title.slice(0, 22)}…`
      : selectedArtifact.title
    : "Context";

  // Build the ContextRail element once for reuse in both inline (xl) and
  // overlay (tablet) render paths.
  const railElement = (
    <ContextRail
      title={railTitle}
      sections={railSections}
      collapsible
      width={320}
      className="sticky top-0 self-start max-h-[calc(100vh-7rem)] overflow-hidden"
    />
  );

  return (
    // Full-height flex column — fills the shell's <main> area.
    // NOTE: intentionally uses min-h-0 rather than overflow:auto so that
    // position:sticky on the filter column and ContextRail can propagate up
    // to the <main overflow-y-auto> scroll container without interruption.
    <div className="flex flex-col gap-4 min-h-0">

      {/* Mobile filter drawer — fixed overlay, <768px only */}
      <MobileFilterDrawer
        isOpen={mobileFiltersOpen}
        onClose={closeMobileFilters}
        filters={archiveFilters}
        onFiltersChange={handleArchiveFilterChange}
      />

      {/* Tablet ContextRail overlay — fixed right panel, md–xl only */}
      <TabletRailOverlay isOpen={railIsOpen} onClose={closeRail}>
        {railElement}
      </TabletRailOverlay>

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
          {/* Mobile filters button — visible <768px only */}
          <MobileFiltersButton
            onClick={openMobileFilters}
            activeCount={activeArchiveFilterCount}
          />
          {/* ContextRail toggle — visible on tablet (md–xl only) */}
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

        {/* Left filter column — 200px fixed, sticky, hidden <768px.
            Sticky chain: this is a direct flex child of the row below, which
            itself is a flex child of the page wrapper (min-h-0, no overflow).
            The scroll container is <main overflow-y-auto> in shell-client.tsx.
            No overflow:hidden/auto between sticky element and scroll container. */}
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
                    For P3-01/P3-03, all cards render as standard to preserve
                    existing behavior.
                    P3-03: <li> wrapper captures plain-click → select; cmd/ctrl
                    click passes through to the underlying ArtifactCard <Link>. */}
                {!isLoading &&
                  artifacts.map((artifact) => {
                    const isSelected = selectedArtifact?.id === artifact.id;
                    return (
                      <li
                        key={artifact.id}
                        onClick={(e) => handleCardClick(artifact, e)}
                        aria-current={isSelected ? "true" : undefined}
                        title={
                          isSelected
                            ? "Click to deselect"
                            : "Click to preview • Cmd+click to open"
                        }
                        className={cn(
                          "cursor-pointer rounded-md transition-all",
                          isSelected &&
                            "ring-2 ring-primary ring-offset-2 ring-offset-background",
                        )}
                      >
                        <ArtifactCard
                          artifact={artifact}
                          variant={viewMode}
                          displayVariant="standard"
                          typeAccent
                          activeRun={artifact.active_run ?? undefined}
                        />
                      </li>
                    );
                  })}

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

        {/* Right ContextRail — inline at xl (≥1280px), overlay on tablet (md–xl).
            The inline instance is hidden below xl via ContextRail's own CSS
            (hidden xl:block); the overlay is rendered via TabletRailOverlay above. */}
        {railElement}
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
