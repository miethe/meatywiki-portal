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
 * Type labels are normalized through the shared artifact-type presentation map.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getArtifactTypeLabel } from "@/lib/artifact-type-presentation";
import type { ArtifactSortField, SortOrder } from "@/lib/api/artifacts";
import type {
  ArtifactFacet,
  ArtifactStatus,
  LensFidelity,
  LensFreshness,
  LensVerificationState,
} from "@/types/artifact";
import type { LibraryFilters } from "@/hooks/useLibraryArtifacts";
import InfoTooltip from "@/components/ui/info-tooltip";
import { TOOLTIP_COPY } from "@/lib/copy/tooltips";

// ---------------------------------------------------------------------------
// Known values for filter dropdowns
// ---------------------------------------------------------------------------

export const KNOWN_ARTIFACT_TYPES = [
  "raw_note",
  "raw_url",
  "raw_upload",
  "raw_transcript",
  "raw_import",
  "source_summary",
  "concept",
  "entity",
  "topic_note",
  "synthesis",
  "evidence_matrix",
  "contradiction_matrix",
  "glossary_term",
  "blog_idea",
  "blog_outline",
  "blog_draft",
  "context_pack",
  "brief",
  "prd",
  "adr",
  "implementation_plan",
  "decision",
  "intent",
  "risk",
  "memory_item",
].map((value) => ({ value, label: getArtifactTypeLabel(value) })) as readonly {
  value: string;
  label: string;
}[];

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
  /** Optional InfoTooltip copy string to display next to the group label */
  tooltip?: string;
  className?: string;
}

function MultiSelectChips({
  label,
  options,
  selected,
  onChange,
  tooltip,
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
      <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {tooltip && (
          <InfoTooltip
            content={tooltip}
            side="top"
            align="start"
            icon="info"
            label={`About ${label.toLowerCase()}`}
          />
        )}
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
        <span className="text-[10px] text-muted-foreground">Active</span>
      )}
    </div>
  );
}

interface TagFilterInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

function normaliseTag(value: string): string {
  return value.trim().replace(/^#/, "");
}

function TagFilterInput({ tags, onChange }: TagFilterInputProps) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    const tag = normaliseTag(draft);
    if (!tag || tags.includes(tag)) {
      setDraft("");
      return;
    }
    onChange([...tags, tag]);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label
        htmlFor="library-tag-filter"
        className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
      >
        Tags
      </label>
      <input
        id="library-tag-filter"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addDraft();
          }
        }}
        placeholder="Add tag"
        className={cn(
          "h-6 min-h-[44px] w-28 rounded-sm border border-input bg-background px-2 text-[11px] text-foreground sm:min-h-0",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      />
      <button
        type="button"
        onClick={addDraft}
        className={cn(
          "h-6 min-h-[44px] rounded-sm border px-2 text-[11px] font-medium text-muted-foreground sm:min-h-0",
          "transition-colors hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        Add
      </button>
    </div>
  );
}

interface ActiveFilterChipsProps {
  filters: LibraryFilters;
  lockedFacet?: ArtifactFacet;
  onFiltersChange: (next: Partial<LibraryFilters>) => void;
}

function optionLabel(options: readonly { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? humaniseFilterValue(value);
}

function humaniseFilterValue(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function ActiveFilterChips({
  filters,
  lockedFacet,
  onFiltersChange,
}: ActiveFilterChipsProps) {
  const tags = filters.tags ?? [];
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...filters.types.map((type) => ({
      key: `type-${type}`,
      label: `Type: ${optionLabel(KNOWN_ARTIFACT_TYPES, type)}`,
      clear: () => onFiltersChange({ types: filters.types.filter((v) => v !== type) }),
    })),
    ...filters.statuses.map((status) => ({
      key: `status-${status}`,
      label: `Status: ${optionLabel(KNOWN_STATUSES, status)}`,
      clear: () =>
        onFiltersChange({
          statuses: filters.statuses.filter((v) => v !== status),
        }),
    })),
    !lockedFacet && filters.facet
      ? {
          key: `workspace-${filters.facet}`,
          label: `Workspace: ${optionLabel(FACET_OPTIONS, filters.facet)}`,
          clear: () => onFiltersChange({ facet: undefined }),
        }
      : null,
    filters.dateFrom
      ? {
          key: "date-from",
          label: `Date from: ${filters.dateFrom}`,
          clear: () => onFiltersChange({ dateFrom: undefined }),
        }
      : null,
    filters.dateTo
      ? {
          key: "date-to",
          label: `Date to: ${filters.dateTo}`,
          clear: () => onFiltersChange({ dateTo: undefined }),
        }
      : null,
    ...tags.map((tag) => ({
      key: `tag-${tag}`,
      label: `Tag: ${tag}`,
      clear: () => onFiltersChange({ tags: tags.filter((v) => v !== tag) }),
    })),
    ...filters.lensFidelity.map((value) => ({
      key: `fidelity-${value}`,
      label: `Quality: ${humaniseFilterValue(value)}`,
      clear: () =>
        onFiltersChange({
          lensFidelity: filters.lensFidelity.filter((v) => v !== value),
        }),
    })),
    ...filters.lensFreshness.map((value) => ({
      key: `freshness-${value}`,
      label: `Quality: ${humaniseFilterValue(value)}`,
      clear: () =>
        onFiltersChange({
          lensFreshness: filters.lensFreshness.filter((v) => v !== value),
        }),
    })),
    ...filters.lensVerification.map((value) => ({
      key: `verification-${value}`,
      label: `Quality: ${humaniseFilterValue(value)}`,
      clear: () =>
        onFiltersChange({
          lensVerification: filters.lensVerification.filter((v) => v !== value),
        }),
    })),
  ].filter((chip): chip is { key: string; label: string; clear: () => void } => chip !== null);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border-t px-3 py-2">
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Active
      </span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.clear}
          className={cn(
            "inline-flex h-6 items-center rounded-sm bg-primary/10 px-2 text-[11px] font-medium text-primary",
            "transition-colors hover:bg-primary/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {chip.label}
        </button>
      ))}
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
  /**
   * Filter sections to hide. Used by the Library page when a grouped lens
   * is active (e.g. "type" is hidden because the lens already locks the type).
   * Accepts an array of filter section names to suppress from the UI.
   *
   * library-source-rollup-v1 FE-06.
   */
  hiddenFilterSections?: Array<"type">;
  className?: string;
}

export function LibraryFilterBar({
  filters,
  onFiltersChange,
  resultCount,
  lockedFacet,
  hiddenFilterSections,
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
    tags = [],
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
    tags.length +
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
      tags: [],
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
        {/* Type filter — hidden when hiddenFilterSections includes "type"
            (e.g. when a grouped lens is active and the type is already locked) */}
        {!hiddenFilterSections?.includes("type") && (
          <MultiSelectChips
            label="Type"
            options={KNOWN_ARTIFACT_TYPES}
            selected={types}
            onChange={(next) => onFiltersChange({ types: next })}
          />
        )}

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
            label="Workspace"
            options={FACET_OPTIONS}
            selected={facet ? [facet] : []}
            tooltip={TOOLTIP_COPY.library.workspaceFacetHeader}
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
          Quality
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
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Date and tag row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-3 py-2">
        <DateRangeInputs
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={(from, to) =>
            onFiltersChange({ dateFrom: from, dateTo: to })
          }
        />
        <TagFilterInput
          tags={tags}
          onChange={(next) => onFiltersChange({ tags: next })}
        />
      </div>

      <ActiveFilterChips
        filters={filters}
        lockedFacet={lockedFacet}
        onFiltersChange={onFiltersChange}
      />

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
            tooltip={TOOLTIP_COPY.library.fidelityChip}
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
            tooltip={TOOLTIP_COPY.library.freshnessChip}
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

        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// URL sync hook for library lens switcher (library-source-rollup-v1 FE-06)
// ---------------------------------------------------------------------------

/**
 * useLibraryLensUrlSync — bidirectional sync for the ?lens= URL query param.
 *
 * Follows the same pattern as useLensFilterUrlSync. Returns:
 *   readLensFromUrl()  — reads ?lens= from window.location.search, returns
 *                        the value or null when absent/invalid.
 *   syncLensToUrl(lens) — writes ?lens= to the URL without navigation
 *                         (history.replaceState).
 *
 * library-source-rollup-v1 FE-06.
 */
export function useLibraryLensUrlSync() {
  const VALID_LENSES = [
    "default",
    "concepts",
    "entities",
    "syntheses",
    "evidence",
    "contradictions",
    "glossary",
    "orphans",
  ] as const;

  type ValidLens = (typeof VALID_LENSES)[number];

  function readLensFromUrl(): ValidLens | null {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const value = params.get("lens");
    if (!value) return null;
    return (VALID_LENSES as readonly string[]).includes(value)
      ? (value as ValidLens)
      : null;
  }

  function syncLensToUrl(lens: string): void {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (lens === "default") {
      params.delete("lens");
    } else {
      params.set("lens", lens);
    }
    const qs = params.toString();
    const newUrl = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }

  return { readLensFromUrl, syncLensToUrl };
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
 *   date_from, date_to, tag[], lens_fidelity, lens_freshness, lens_verification
 *
 * The hook is intentionally side-effect-free — it does not subscribe to router
 * events. Pages should call syncToUrl whenever filters change.
 */
export function useLensFilterUrlSync() {
  const pendingUrlRef = useRef<string | null>(null);
  const pendingTimerRef = useRef<number | null>(null);

  const flushPendingUrl = useCallback(() => {
    pendingTimerRef.current = null;
    const nextUrl = pendingUrlRef.current;
    pendingUrlRef.current = null;
    if (!nextUrl || typeof window === "undefined") return;

    window.history.replaceState(null, "", nextUrl);
  }, []);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
      }
    },
    [],
  );

  /**
   * Read lens filter values from the current window.location.search.
   * Returns null when running server-side (no window object).
   */
  const readFromUrl = useCallback((): Pick<
    LibraryFilters,
    "dateFrom" | "dateTo" | "tags" | "lensFidelity" | "lensFreshness" | "lensVerification"
  > | null => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return {
      dateFrom: params.get("date_from") ?? undefined,
      dateTo: params.get("date_to") ?? undefined,
      tags: params.getAll("tag[]").filter(Boolean),
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
  }, []);

  /**
   * Push the given lens filter values to the URL without triggering a
   * navigation (uses history.replaceState).  Also preserves all non-lens
   * query params already present in the URL.
   */
  const syncToUrl = useCallback((
    filters: Pick<
      LibraryFilters,
      "dateFrom" | "dateTo" | "tags" | "lensFidelity" | "lensFreshness" | "lensVerification"
    >,
  ): void => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    // Replace filter params — delete then re-append.
    params.delete("date_from");
    params.delete("date_to");
    params.delete("tag[]");
    params.delete("lens_fidelity");
    params.delete("lens_freshness");
    params.delete("lens_verification");

    if (filters.dateFrom) params.set("date_from", filters.dateFrom);
    if (filters.dateTo) params.set("date_to", filters.dateTo);
    for (const tag of filters.tags ?? []) params.append("tag[]", tag);
    for (const v of filters.lensFidelity) params.append("lens_fidelity", v);
    for (const v of filters.lensFreshness) params.append("lens_freshness", v);
    for (const v of filters.lensVerification) params.append("lens_verification", v);

    const qs = params.toString();
    const newUrl = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;

    pendingUrlRef.current = newUrl;
    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current);
    }
    pendingTimerRef.current = window.setTimeout(flushPendingUrl, 0);
  }, [flushPendingUrl]);

  return { readFromUrl, syncToUrl };
}
