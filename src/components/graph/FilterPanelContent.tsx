"use client";

/**
 * FilterPanelContent — shared filter panel body used by both FilterSidebar
 * (desktop) and GraphFilterSheet (mobile bottom sheet).
 *
 * Extracts the inner content of FilterSidebar (search input + accordion
 * sections + clear-all footer) into a standalone component so that both
 * surfaces render identical controls from a single source of truth.
 *
 * Props mirror the relevant slots from FilterSidebarProps:
 *   - searchValue / onSearchChange   → free-text search input (dim 16)
 *   - activeFilterCount / onClearAll → footer clear-all button
 *   - isFilterPending                → "Updating…" pulse indicator
 *   - children                       → GraphFilters (or any filter controls)
 *
 * P5-02: mobile bottom-sheet filter panel.
 */

import { type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GraphFilterPresets } from "@/components/graph/GraphFilterPresets";
import type { GraphFiltersValues } from "@/components/graph/GraphFilters";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FilterPanelContentProps {
  /**
   * Optional id forwarded to the scrollable content div — used by FilterSidebar
   * to wire aria-controls on the collapse/expand buttons.
   */
  id?: string;
  /** Free-text search query (dim 16). Shown when onSearchChange is provided. */
  searchValue?: string;
  /** Called when the search input value changes. */
  onSearchChange?: (value: string) => void;
  /** Number of active filter dimensions — drives footer visibility. */
  activeFilterCount?: number;
  /** Called when "Clear all filters" footer button is clicked. */
  onClearAll?: () => void;
  /**
   * When true, shows a subtle "Updating…" pulse indicator above the filter
   * controls (P3-03 debounce/refetch window indicator).
   */
  isFilterPending?: boolean;
  /** Filter controls (GraphFilters). */
  children?: ReactNode;
  /**
   * Called when the user clicks a quick-start preset card (P5-11).
   * When provided, preset cards are shown in the empty-filter state.
   */
  onApplyPreset?: (partial: Partial<GraphFiltersValues>) => void;
  /** Additional className applied to the root wrapper. */
  className?: string;
}

// ---------------------------------------------------------------------------
// FilterPanelContent
// ---------------------------------------------------------------------------

export function FilterPanelContent({
  id,
  searchValue,
  onSearchChange,
  activeFilterCount = 0,
  onClearAll,
  isFilterPending = false,
  onApplyPreset,
  children,
  className,
}: FilterPanelContentProps) {
  return (
    <div id={id} className={cn("flex flex-col flex-1 min-h-0 overflow-hidden", className)}>
      {/* Free-text search input (dim 16 — always visible per filter contract §10) */}
      {onSearchChange !== undefined && (
        <div className="shrink-0 border-b px-3 py-2">
          <div className="relative flex items-center">
            <Search
              aria-hidden="true"
              className="absolute left-2.5 size-3.5 text-muted-foreground/60 pointer-events-none"
            />
            <input
              type="search"
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search nodes…"
              aria-label="Search nodes in graph"
              className={cn(
                "w-full rounded-md border border-input bg-background",
                "py-1.5 pl-8 pr-3 text-xs",
                "placeholder:text-muted-foreground/60",
                "focus:outline-none focus:ring-1 focus:ring-ring",
              )}
            />
            {searchValue && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => onSearchChange("")}
                className="absolute right-2 text-muted-foreground/60 hover:text-foreground focus:outline-none"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pending indicator (P3-03: subtle loading indicator during debounce/refetch) */}
      {isFilterPending && (
        <div
          aria-live="polite"
          aria-label="Updating graph…"
          className="shrink-0 px-3 py-1.5 text-[10px] text-muted-foreground animate-pulse"
        >
          Updating…
        </div>
      )}

      {/* Scrollable filter controls area */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* P5-11: Quick-start preset cards — shown when no filters are active */}
        {onApplyPreset && activeFilterCount === 0 && (
          <GraphFilterPresets onApplyPreset={onApplyPreset} />
        )}
        {children}
      </div>

      {/* Footer — clear all (shown when active filters exist) */}
      {activeFilterCount > 0 && onClearAll && (
        <div className="shrink-0 border-t px-3 py-2">
          <button
            type="button"
            onClick={onClearAll}
            className={cn(
              "flex w-full items-center justify-center gap-1.5",
              "text-[11px] font-medium text-muted-foreground",
              "rounded-md px-2 py-1.5 hover:bg-accent hover:text-foreground",
              "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <X aria-hidden="true" className="size-3" />
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
