"use client";

/**
 * LibraryFilterBar — type/status/sort controls for the Library screen.
 *
 * Design: compact horizontal bar, multi-select dropdowns for type and status,
 * single-select sort dropdown. All state is lifted to LibraryPage so filter
 * changes flow through the React Query key and trigger immediate refetch.
 *
 * The filter bar slot in the Library page scaffold notes that P4-09 will
 * replace this with the full Lens Filter Bar. This component is intentionally
 * lightweight to make that replacement clean.
 *
 * Accessibility: every interactive control has an accessible label; dropdowns
 * are keyboard-navigable via native <select> semantics.
 *
 * Note: Tags filter omitted — backend does not support tag query param in v1.
 * A slot comment is left below for future implementation.
 */

import { cn } from "@/lib/utils";
import type { ArtifactSortField, SortOrder } from "@/lib/api/artifacts";
import type { ArtifactStatus } from "@/types/artifact";
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
              "inline-flex h-6 items-center rounded-sm px-2 text-[11px] font-medium transition-colors",
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
          className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          "h-6 rounded-sm border border-input bg-background px-2 text-[11px] text-foreground",
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
// Main filter bar
// ---------------------------------------------------------------------------

interface LibraryFilterBarProps {
  filters: LibraryFilters;
  onFiltersChange: (next: Partial<LibraryFilters>) => void;
  /** Total artifacts loaded (for result count display) */
  resultCount?: number;
  className?: string;
}

export function LibraryFilterBar({
  filters,
  onFiltersChange,
  resultCount,
  className,
}: LibraryFilterBarProps) {
  const { types, statuses, sort, order } = filters;

  const activeFilterCount = types.length + statuses.length;

  function clearAll() {
    onFiltersChange({ types: [], statuses: [] });
  }

  return (
    <div
      role="search"
      aria-label="Library filters"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-card/50 px-3 py-2",
        className,
      )}
    >
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

      {/* Sort */}
      <SortSelect
        sort={sort}
        order={order}
        onChange={(s, o) => onFiltersChange({ sort: s, order: o })}
      />

      {/* TAG FILTER SLOT — not implemented in v1 (backend no tag query param).
          Add <MultiSelectChips label="Tags" ... /> here when backend supports
          ?tags=foo&tags=bar query params on GET /api/artifacts. */}

      {/* Spacer + active filter count + clear all */}
      <div className="ml-auto flex items-center gap-2">
        {resultCount !== undefined && (
          <span className="text-[11px] text-muted-foreground" aria-live="polite" aria-atomic="true">
            {resultCount} {resultCount === 1 ? "artifact" : "artifacts"}
          </span>
        )}
        <ActiveFilterCount count={activeFilterCount} />
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className={cn(
              "text-[11px] text-muted-foreground underline-offset-2 hover:underline",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
