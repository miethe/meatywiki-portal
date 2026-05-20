"use client";

/**
 * GraphFilterChips — chip strip above the vault graph canvas.
 *
 * Renders one chip per active (non-default) filter dimension.
 * Chip format per filter contract §3.
 *
 * Chip behavior:
 *   - Click chip body  → `onFocusFilterPanel(key)` (sidebar opens + scrolls to dim)
 *   - Click chip ×     → `onClearDim(key)` (resets that dim to its default)
 *   - "Clear all" btn  → `onClearAll()` (resets all dims; shown when ≥1 chip)
 *
 * When zero chips: renders nothing (the containing div collapses naturally).
 *
 * v2.2 — graph explorer filter chips (P3-07).
 */

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GraphFiltersValues } from "./GraphFilters";
import { FILTER_DIM_CHIP_DEFS, type FilterDimKey } from "./filterChipFormatters";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GraphFilterChipsProps {
  values: GraphFiltersValues;
  /** Reset one dim to its default. `key` is the primary dim key per FILTER_DIM_CHIP_DEFS. */
  onClearDim: (key: FilterDimKey) => void;
  /** Reset all dims to their defaults. */
  onClearAll: () => void;
  /**
   * Open the filter sidebar (if not already open) and scroll to the control
   * for this dim. VaultGraphPageClient wires this to setSidebarOpen(true) +
   * scrollIntoView on the `data-filter-dim` anchor.
   */
  onFocusFilterPanel: (key: FilterDimKey) => void;
}

// ---------------------------------------------------------------------------
// GraphFilterChips
// ---------------------------------------------------------------------------

export function GraphFilterChips({
  values,
  onClearDim,
  onClearAll,
  onFocusFilterPanel,
}: GraphFilterChipsProps) {
  // Compute active chips by running each dim's formatter
  const activeChips = FILTER_DIM_CHIP_DEFS.flatMap((def) => {
    const summary = def.formatter(values);
    if (summary === null) return [];
    return [{ ...def, summary }];
  });

  // Nothing to show — render nothing so the strip collapses
  if (activeChips.length === 0) return null;

  return (
    <div
      role="group"
      aria-label="Active graph filters"
      className="flex flex-wrap items-center gap-1.5"
    >
      {activeChips.map(({ dimKey, dimLabel, summary }) => (
        <FilterChip
          key={dimKey}
          label={summary.label}
          dimLabel={dimLabel}
          onFocus={() => onFocusFilterPanel(dimKey)}
          onClear={() => onClearDim(dimKey)}
        />
      ))}

      {/* Clear all — only when ≥1 chip */}
      <button
        type="button"
        onClick={onClearAll}
        aria-label="Clear all active filters"
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border/60",
          "px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
          "transition-colors hover:border-foreground/30 hover:bg-accent hover:text-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <X aria-hidden="true" className="size-3" />
        Clear all
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterChip — individual chip
// ---------------------------------------------------------------------------

interface FilterChipProps {
  /** Formatted label text (e.g. "workspace: library, research"). */
  label: string;
  /** Human-readable dim name used in ARIA labels (e.g. "Workspace"). */
  dimLabel: string;
  /** Called when the chip body is clicked (focus the filter panel). */
  onFocus: () => void;
  /** Called when the × button is clicked (clear this dim). */
  onClear: () => void;
}

function FilterChip({ label, dimLabel, onFocus, onClear }: FilterChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0 rounded-full border border-border/60 bg-background",
        "text-[11px] font-medium text-foreground/80",
        "transition-colors",
      )}
    >
      {/* Chip body — click to focus filter panel */}
      <button
        type="button"
        onClick={onFocus}
        aria-label={`Filter active: ${label}. Click to edit ${dimLabel} filter.`}
        className={cn(
          "rounded-l-full px-2.5 py-1",
          "hover:bg-accent hover:text-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          "transition-colors",
        )}
      >
        {label}
      </button>

      {/* Divider */}
      <span aria-hidden="true" className="h-4 w-px bg-border/60 shrink-0" />

      {/* × clear button */}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${dimLabel} filter`}
        className={cn(
          "rounded-r-full px-1.5 py-1",
          "text-muted-foreground hover:bg-accent hover:text-destructive",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          "transition-colors",
        )}
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </span>
  );
}
