"use client";

/**
 * GraphGroupingSelector — toolbar dropdown for selecting graph grouping mode.
 *
 * Renders a compact "Group by" button that opens a dropdown menu listing all
 * 8 grouping modes. Disabled modes (e.g. semantic_cluster) are greyed out and
 * show a tooltip explaining why they are unavailable.
 *
 * Style: matches SavedViewsMenu (same trigger button class, same dropdown shell).
 *
 * v2.2 — graph explorer grouping selector (P3-09).
 */

import { useState, useRef, useEffect } from "react";
import { Layers, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GROUPING_MODES,
  getGroupingDescriptor,
  type GroupingMode,
} from "@/lib/graph/groupingModes";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GraphGroupingSelectorProps {
  /** Currently active grouping mode. */
  mode: GroupingMode;
  /** Called when the user selects a (non-disabled) mode. */
  onChange: (mode: GroupingMode) => void;
  /** When true, the entire selector is non-interactive (e.g. during loading). */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphGroupingSelector({
  mode,
  onChange,
  disabled = false,
}: GraphGroupingSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeDescriptor = getGroupingDescriptor(mode);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSelect(value: GroupingMode) {
    onChange(value);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button — mirrors SavedViewsMenu trigger style */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Select graph grouping mode"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
          "transition-colors hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-accent text-accent-foreground",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Layers aria-hidden="true" className="size-3" />
        <span>
          {mode === "none"
            ? "Group by…"
            : activeDescriptor.label}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3 transition-transform", open && "rotate-180")}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          aria-label="Graph grouping modes"
          className={cn(
            "absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border bg-popover shadow-md",
            "flex flex-col gap-0.5 py-1.5",
          )}
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Group by
          </div>

          {GROUPING_MODES.map((descriptor) => (
            <GroupingModeItem
              key={descriptor.value}
              descriptor={descriptor}
              isActive={descriptor.value === mode}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

interface GroupingModeItemProps {
  descriptor: (typeof GROUPING_MODES)[number];
  isActive: boolean;
  onSelect: (value: GroupingMode) => void;
}

function GroupingModeItem({
  descriptor,
  isActive,
  onSelect,
}: GroupingModeItemProps) {
  const { value, label, disabled, disabledReason } = descriptor;

  return (
    <div
      className="group relative px-1"
      title={disabled ? (disabledReason ?? "") : undefined}
    >
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) onSelect(value);
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs",
          "text-left transition-colors",
          disabled
            ? "cursor-not-allowed text-muted-foreground/40"
            : "hover:bg-accent hover:text-accent-foreground",
          isActive && !disabled && "bg-accent/60 text-accent-foreground font-medium",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        {/* Active checkmark */}
        <Check
          aria-hidden="true"
          className={cn(
            "size-3 shrink-0",
            isActive && !disabled ? "opacity-100" : "opacity-0",
          )}
        />
        <span className="truncate">{label}</span>
        {disabled && (
          <span className="ml-auto shrink-0 text-[10px] italic text-muted-foreground/50">
            soon
          </span>
        )}
      </button>

      {/* Tooltip for disabled modes — visible on hover of the row */}
      {disabled && disabledReason && (
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-44",
            "rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md",
            "group-hover:block",
          )}
        >
          {disabledReason}
        </div>
      )}
    </div>
  );
}
