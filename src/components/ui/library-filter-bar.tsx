"use client";

/**
 * LibraryFilterBar — type/status/facet/date/sort controls + Lens Filter Bar.
 *
 * Design: compact horizontal bar with multi-select chips for type and status, a sort
 * dropdown, a facet filter row, date range inputs, and an expandable Lens Filter
 * section (P4-09). Lens filters (fidelity, freshness, verification) are hidden behind
 * a "Lens" toggle button and expand below the primary filter row.
 *
 * Taxonomy-redesign P5-02 additions:
 *   - Facet filter chips: Library / Research / Blog / Projects
 *   - Date range: dateFrom / dateTo inputs
 *   - lockedFacet prop: when set, the facet filter row is hidden and the facet is
 *     pre-applied. Used by filtered-view screens (P5-03/04/05).
 *
 * All state is lifted to the parent page so filter changes flow through the React
 * Query key and trigger an immediate refetch.
 *
 * URL synchronisation is handled at the page level via useLensFilterUrlSync (see below)
 * so that filter state survives reload and can be shared via URL.
 *
 * Accessibility: every interactive control has an accessible label; chip buttons use
 * aria-pressed. The lens section uses aria-expanded on the toggle button.
 *
 * Note: Tags filter omitted — backend does not support tag query param in v1.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ArtifactSortField, SortOrder } from "@/lib/api/artifacts";
import type {
  ArtifactFacet,
  ArtifactStatus,
  LensFidelity,
  LensFreshness,
  LensVerificationState,
} from "@/types/artifact";
import type { LibraryFilters } from "@/hooks/useLibraryArtifacts";

// ---------------------------------------------------------------------------
// Known values for filter dropdowns
// ---------------------------------------------------------------------------

export const KNOWN_ARTIFACT_TYPES = [
  { value: "raw_note", label: "Note" },
  { value: "concept", label: "Concept" },
  { value: "entity", label: "Entity" },
  { value: "topic", label: "Topic" },
  { value: "synthesis", label: "Synthesis" },
  { value: "evidence", label: "Evidence" },
  { value: "glossary", label: "Glossary" },
] as const;

export const KNOWN_STATUSES: { value: ArtifactStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
  { value: "stale", label: "Stale" },
];

const SORT_OPTIONS: { value: ArtifactSortField; label: string }[] = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Date created" },
  { value: "title", label: "Title (A–Z)" },
];

/** Facet filter options (taxonomy-redesign P5-02) */
const FACET_OPTIONS: { value: ArtifactFacet; label: string }[] = [
  { value: "library", label: "Library" },
  { value: "research", label: "Research" },
  { value: "blog", label: "Blog" },
  { value: "projects", label: "Projects" },
];

// ---------------------------------------------------------------------------
// Lens filter option sets (P4-09)
// ---------------------------------------------------------------------------

const LENS_FIDELITY_OPTIONS: { value: LensFidelity; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const LENS_FRESHNESS_OPTIONS: { value: LensFreshness; label: string }[] = [
  { value: "current", label: "Current" },
  { value: "stale", label: "Stale" },
  { value: "outdated", label: "Outdated" },
];

const LENS_VERIFICATION_OPTIONS: { value: LensVerificationState; label: string }[] = [
  { value: "verified", label: "Verified" },
  { value: "disputed", label: "Disputed" },
  { value: "unverified", label: "Unverified" },
];

// ---------------------------------------------------------------------------
// Shared multi-select chip component
// ---------------------------------------------------------------------------

interface MultiSelectChipsProps {
  label: string;
  options: readonly { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

function MultiSelectChips({
  label,
  options,
  selected,
  onChange,
  className,
}: MultiSelectChipsProps) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {options.map(({ value, label: optLabel }) => {
        const isActive = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isActive}
            aria-label={`Filter by ${label}: ${optLabel}`}
            onClick={() => toggle(value)}
            className={cn(
              "inline-flex h-6 min-h-[44px] items-center rounded-sm px-2 text-[11px] font-medium transition-colors sm:min-h-0",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {optLabel}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          aria-label={`Clear ${label} filter`}
          onClick={() => onChange([])}
          className="ml-0.5 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-5"
        >
          <svg aria-hidden="true" className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort select
// ---------------------------------------------------------------------------

interface SortSelectProps {
  sort: ArtifactSortField;
  order: SortOrder;
  onChange: (sort: ArtifactSortField, order: SortOrder) => void;
}

function SortSelect({ sort, order, onChange }: SortSelectProps) {
  // Encode sort+order into a single select value for simplicity
  const value = `${sort}:${order}`;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [newSort, newOrder] = e.target.value.split(":") as [
      ArtifactSortField,
      SortOrder,
    ];
    onChange(newSort, newOrder);
  }

  return (
    <div className="flex items-center gap-1.5">
      <label
        htmlFor="library-sort"
        className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
      >
        Sort
      </label>
      <select
        id="library-sort"
        value={value}
        onChange={handleChange}
        aria-label="Sort artifacts"
        className={cn(
          "min-h-[44px] rounded-sm border border-input bg-background px-2 text-[11px] text-foreground sm:h-6 sm:min-h-0",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "cursor-pointer",
        )}
      >
        {SORT_OPTIONS.map(({ value: sv, label }) => (
          <optgroup key={sv} label={label}>
            <option value={`${sv}:desc`}>{label} ↓</option>
            <option value={`${sv}:asc`}>{label} ↑</option>
          </optgroup>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date range inputs (taxonomy-redesign P5-02)
// ---------------------------------------------------------------------------

interface DateRangeInputsProps {
  dateFrom?: string;
  dateTo?: string;
  onChange: (dateFrom: string | undefined, dateTo: string | undefined) => void;
}

function DateRangeInputs({ dateFrom, dateTo, onChange }: DateRangeInputsProps) {
  return (
    <div
      role="group"
      aria-label="Date range filter"
      className="flex flex-wrap items-center gap-1.5"
    >
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Date
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <label htmlFor="filter-date-from" className="sr-only">
          From date
        </label>
        <input
          id="filter-date-from"
          type="date"
          value={dateFrom ?? ""}
          max={dateTo ?? undefined}
          onChange={(e) =>
            onChange(e.target.value || undefined, dateTo)
          }
          aria-label="Filter from date"
          className={cn(
            "min-h-[44px] rounded-sm border border-input bg-background px-2 text-[11px] text-foreground sm:h-6 sm:min-h-0",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        />
        <span aria-hidden="true" className="text-[11px] text-muted-foreground">
          –
        </span>
        <label htmlFor="filter-date-to" className="sr-only">
          To date
        </label>
        <input
          id="filter-date-to"
          type="date"
          value={dateTo ?? ""}
          min={dateFrom ?? undefined}
          onChange={(e) =>
            onChange(dateFrom, e.target.value || undefined)
          }
          aria-label="Filter to date"
          className={cn(
            "min-h-[44px] rounded-sm border border-input bg-background px-2 text-[11px] text-foreground sm:h-6 sm:min-h-0",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        />
      </div>
      {(dateFrom || dateTo) && (
        <button
          type="button"
          aria-label="Clear date range filter"
          onClick={() => onChange(undefined, undefined)}
          className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-5"
        >
          <svg
            aria-hidden="true"
            className="size-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active filter summary badge
// ---------------------------------------------------------------------------

function ActiveFilterCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      aria-label={`${count} active filter${count === 1 ? "" : "s"}`}
      className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
    >
      {count}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main filter bar (P4-09: extended with collapsible Lens Filter section)
// Taxonomy-redesign P5-02: facet filter + date range + lockedFacet support
// ---------------------------------------------------------------------------

interface LibraryFilterBarProps {
  filters: LibraryFilters;
  onFiltersChange: (next: Partial<LibraryFilters>) => void;
  /** Total artifacts loaded (for result count display) */
  resultCount?: number;
  /**
   * When set, hides the facet filter row and pre-applies this facet.
   * Used by filtered-view screens (P5-03/04/05) so the facet is locked
   * and not user-editable. The label prop is shown as a locked indicator.
   */
  lockedFacet?: ArtifactFacet;
  className?: string;
}

export function LibraryFilterBar({
  filters,
  onFiltersChange,
  resultCount,
  lockedFacet,
  className,
}: LibraryFilterBarProps) {
  const {
    types,
    statuses,
    sort,
    order,
    facet,
    dateFrom,
    dateTo,
    lensFidelity = [],
    lensFreshness = [],
    lensVerification = [],
  } = filters;

  // Lens panel collapsed by default; open when any lens filter is active
  const hasActiveLensFilters =
    lensFidelity.length > 0 || lensFreshness.length > 0 || lensVerification.length > 0;
  const [lensOpen, setLensOpen] = useState(hasActiveLensFilters);

  const activeDateCount = (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
  const activeFacetCount = !lockedFacet && facet ? 1 : 0;
  const activeFilterCount =
    types.length +
    statuses.length +
    activeFacetCount +
    activeDateCount +
    lensFidelity.length +
    lensFreshness.length +
    lensVerification.length;

  function clearAll() {
    onFiltersChange({
      types: [],
      statuses: [],
      facet: lockedFacet, // keep locked facet if set
      dateFrom: undefined,
      dateTo: undefined,
      lensFidelity: [],
      lensFreshness: [],
      lensVerification: [],
    });
  }

  return (
    <div
      role="search"
      aria-label="Library filters"
      className={cn("rounded-md border bg-card/50", className)}
    >
      {/* Primary filter row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        {/* Type filter */}
        <MultiSelectChips
          label="Type"
          options={KNOWN_ARTIFACT_TYPES}
          selected={types}
          onChange={(next) => onFiltersChange({ types: next })}
        />

        {/* Divider */}
        <div aria-hidden="true" className="hidden h-4 w-px bg-border sm:block" />

        {/* Status filter */}
        <MultiSelectChips
          label="Status"
          options={KNOWN_STATUSES}
          selected={statuses}
          onChange={(next) =>
            onFiltersChange({ statuses: next as ArtifactStatus[] })
          }
        />

        {/* Divider */}
        <div aria-hidden="true" className="hidden h-4 w-px bg-border sm:block" />

        {/* Facet filter — hidden when lockedFacet is set (filtered-view screens) */}
        {!lockedFacet && (
          <MultiSelectChips
            label="Facet"
            options={FACET_OPTIONS}
            selected={facet ? [facet] : []}
            onChange={(next) => {
              // Single-select for facet: take last selected value
              const last = next[next.length - 1] as ArtifactFacet | undefined;
              onFiltersChange({ facet: last });
            }}
          />
        )}

        {/* Locked facet indicator — shown when facet is pre-applied */}
        {lockedFacet && (
          <span
            aria-label={`Filtered to ${lockedFacet} facet`}
            className="inline-flex h-6 items-center gap-1 rounded-sm bg-primary/10 px-2 text-[11px] font-medium text-primary"
          >
            <svg
              aria-hidden="true"
              className="size-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            {FACET_OPTIONS.find((o) => o.value === lockedFacet)?.label ?? lockedFacet}
          </span>
        )}

        {/* Divider */}
        <div aria-hidden="true" className="hidden h-4 w-px bg-border sm:block" />

        {/* Sort */}
        <SortSelect
          sort={sort}
          order={order}
          onChange={(s, o) => onFiltersChange({ sort: s, order: o })}
        />

        {/* TAG FILTER SLOT — not implemented in v1 (backend no tag query param).
            Add <MultiSelectChips label="Tags" ... /> here when backend supports
            ?tags=foo&tags=bar query params on GET /api/artifacts. */}

        {/* Lens toggle button (P4-09) */}
        <button
          type="button"
          aria-label={lensOpen ? "Collapse lens filters" : "Expand lens filters"}
          aria-expanded={lensOpen}
          aria-controls="lens-filter-panel"
          onClick={() => setLensOpen((prev) => !prev)}
          className={cn(
            "ml-auto inline-flex h-6 min-h-[44px] items-center gap-1 rounded-sm px-2.5 text-[11px] font-medium transition-colors sm:ml-0 sm:min-h-0",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            lensOpen || hasActiveLensFilters
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <svg
            aria-hidden="true"
            className="size-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
            />
          </svg>
          Lens
          {hasActiveLensFilters && (
            <ActiveFilterCount
              count={lensFidelity.length + lensFreshness.length + lensVerification.length}
            />
          )}
        </button>

        {/* Spacer + active filter count + clear all */}
        <div className="flex items-center gap-2 sm:ml-auto">
          {resultCount !== undefined && (
            <span
              className="text-[11px] text-muted-foreground"
              aria-live="polite"
              aria-atomic="true"
            >
              {resultCount} {resultCount === 1 ? "artifact" : "artifacts"}
            </span>
          )}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className={cn(
                "min-h-[44px] text-[11px] text-muted-foreground underline-offset-2 hover:underline sm:min-h-0",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Date range row — always visible when not hidden by lockedFacet context */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-3 py-2">
        <DateRangeInputs
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={(from, to) =>
            onFiltersChange({ dateFrom: from, dateTo: to })
          }
        />
      </div>

      {/* Lens filter panel (P4-09) — collapsible */}
      {lensOpen && (
        <div
          id="lens-filter-panel"
          role="group"
          aria-label="Lens filters"
          className="flex flex-wrap items-start gap-x-4 gap-y-2 border-t px-3 py-2"
        >
          {/* Fidelity */}
          <MultiSelectChips
            label="Fidelity"
            options={LENS_FIDELITY_OPTIONS}
            selected={lensFidelity}
            onChange={(next) =>
              onFiltersChange({ lensFidelity: next as LensFidelity[] })
            }
          />

          {/* Divider */}
          <div aria-hidden="true" className="hidden h-4 w-px bg-border sm:block" />

          {/* Freshness */}
          <MultiSelectChips
            label="Freshness"
            options={LENS_FRESHNESS_OPTIONS}
            selected={lensFreshness}
            onChange={(next) =>
              onFiltersChange({ lensFreshness: next as LensFreshness[] })
            }
          />

          {/* Divider */}
          <div aria-hidden="true" className="hidden h-4 w-px bg-border sm:block" />

          {/* Verification */}
          <MultiSelectChips
            label="Verification"
            options={LENS_VERIFICATION_OPTIONS}
            selected={lensVerification}
            onChange={(next) =>
              onFiltersChange({ lensVerification: next as LensVerificationState[] })
            }
          />

          {/* Clear lens filters only */}
          {hasActiveLensFilters && (
            <button
              type="button"
              onClick={() =>
                onFiltersChange({ lensFidelity: [], lensFreshness: [], lensVerification: [] })
              }
              className={cn(
                "ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:underline",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
            >
              Clear lens filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// URL sync hook for lens filters (P4-09)
// ---------------------------------------------------------------------------

/**
 * useLensFilterUrlSync — bidirectional sync between LibraryFilters/ResearchFilters
 * and URL query params.
 *
 * Usage: call from the page component that owns filter state. The hook returns
 * a ``filtersFromUrl`` snapshot to initialise state and a ``syncToUrl``
 * callback to push state changes to the URL.
 *
 * URL param names mirror backend API param names:
 *   lens_fidelity, lens_freshness, lens_verification
 *
 * The hook is intentionally side-effect-free — it does not subscribe to router
 * events. Pages should call syncToUrl whenever filters change.
 */
export function useLensFilterUrlSync() {
  /**
   * Read lens filter values from the current window.location.search.
   * Returns null when running server-side (no window object).
   */
  function readFromUrl(): Pick<
    LibraryFilters,
    "lensFidelity" | "lensFreshness" | "lensVerification"
  > | null {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return {
      lensFidelity: (params.getAll("lens_fidelity") as LensFidelity[]).filter(
        (v): v is LensFidelity => ["high", "medium", "low"].includes(v),
      ),
      lensFreshness: (params.getAll("lens_freshness") as LensFreshness[]).filter(
        (v): v is LensFreshness => ["current", "stale", "outdated"].includes(v),
      ),
      lensVerification: (
        params.getAll("lens_verification") as LensVerificationState[]
      ).filter((v): v is LensVerificationState =>
        ["verified", "disputed", "unverified"].includes(v),
      ),
    };
  }

  /**
   * Push the given lens filter values to the URL without triggering a
   * navigation (uses history.replaceState).  Also preserves all non-lens
   * query params already present in the URL.
   */
  function syncToUrl(
    filters: Pick<LibraryFilters, "lensFidelity" | "lensFreshness" | "lensVerification">,
  ): void {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    // Replace lens params — delete then re-append
    params.delete("lens_fidelity");
    params.delete("lens_freshness");
    params.delete("lens_verification");

    for (const v of filters.lensFidelity) params.append("lens_fidelity", v);
    for (const v of filters.lensFreshness) params.append("lens_freshness", v);
    for (const v of filters.lensVerification) params.append("lens_verification", v);

    const qs = params.toString();
    const newUrl = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;

    window.history.replaceState(null, "", newUrl);
  }

  return { readFromUrl, syncToUrl };
}
