"use client";

/**
 * SavedViewsMenu — toolbar dropdown for saved graph view snapshots.
 *
 * Renders a "Views" button that opens a dropdown listing:
 *   1. Built-in read-only presets (no delete button)
 *   2. User-saved views (with × delete button)
 *   3. A "Save current view…" action at the bottom
 *
 * Clicking any view calls `onApplyView(view)` which the parent wires to
 * setFilter + optional camera/grouping setters.
 *
 * Name capture: uses native `window.prompt()` for v1 (lightweight, no extra
 * deps, acceptable for single-user personal tool context).
 *
 * v2.2 — graph explorer saved views (P3-06).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Bookmark, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_VIEWS } from "@/lib/graph/defaultViews";
import {
  listSavedViews,
  saveView,
  deleteSavedView,
  type SavedView,
} from "@/lib/graph/savedViews";
import type { GraphFiltersValues } from "@/components/graph/GraphFilters";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SavedViewsMenuProps {
  /** Current filter state — captured when saving a view. */
  currentFilter: GraphFiltersValues;
  /** Active camera preset name (from parent's camera state), or null. */
  currentCameraPreset: string | null;
  /** Active grouping key (P3-09 — pass null until that phase ships). */
  currentGrouping: string | null;
  /** Called when the user clicks a view to apply it. */
  onApplyView: (view: SavedView) => void;
}

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View row
// ---------------------------------------------------------------------------

interface ViewRowProps {
  view: SavedView;
  onApply: (view: SavedView) => void;
  onDelete?: (id: string) => void;
}

function ViewRow({ view, onApply, onDelete }: ViewRowProps) {
  return (
    <div className="group flex items-center gap-1 rounded-md px-1">
      <button
        type="button"
        onClick={() => onApply(view)}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs",
          "text-left transition-colors hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        <span className="truncate">{view.name}</span>
      </button>

      {onDelete && (
        <button
          type="button"
          aria-label={`Delete view "${view.name}"`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(view.id);
          }}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded",
            "text-muted-foreground/50 opacity-0 transition-opacity",
            "hover:bg-destructive/10 hover:text-destructive",
            "focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
            "group-hover:opacity-100",
          )}
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SavedViewsMenu({
  currentFilter,
  currentCameraPreset,
  currentGrouping,
  onApplyView,
}: SavedViewsMenuProps) {
  const [open, setOpen] = useState(false);
  const [userViews, setUserViews] = useState<SavedView[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load / refresh user views when menu opens
  useEffect(() => {
    if (open) {
      setUserViews(listSavedViews());
    }
  }, [open]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  const handleApply = useCallback(
    (view: SavedView) => {
      onApplyView(view);
      setOpen(false);
    },
    [onApplyView],
  );

  const handleDelete = useCallback((id: string) => {
    deleteSavedView(id);
    setUserViews(listSavedViews());
  }, []);

  const handleSaveCurrent = useCallback(() => {
    // native prompt — lightweight for single-user personal tool (v1)
    const name = window.prompt("Name for this view:");
    if (!name || !name.trim()) return;

    saveView({
      name: name.trim(),
      filter: currentFilter,
      cameraPreset: currentCameraPreset,
      grouping: currentGrouping,
    });

    // Refresh user views list immediately
    setUserViews(listSavedViews());
  }, [currentFilter, currentCameraPreset, currentGrouping]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button — matches EncodingToolbar button style */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Saved graph views"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
          "transition-colors hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-accent text-accent-foreground",
        )}
      >
        <Bookmark aria-hidden="true" className="size-3" />
        Views
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3 transition-transform", open && "rotate-180")}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          aria-label="Saved views"
          className={cn(
            "absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border bg-popover shadow-md",
            "flex flex-col gap-0.5 py-1.5",
          )}
        >
          {/* Built-in presets section */}
          <SectionLabel>Presets</SectionLabel>
          {DEFAULT_VIEWS.map((view) => (
            <ViewRow key={view.id} view={view} onApply={handleApply} />
          ))}

          {/* User-saved views section */}
          {userViews.length > 0 && (
            <>
              <div className="my-1 border-t" />
              <SectionLabel>Saved</SectionLabel>
              {userViews.map((view) => (
                <ViewRow
                  key={view.id}
                  view={view}
                  onApply={handleApply}
                  onDelete={handleDelete}
                />
              ))}
            </>
          )}

          {/* Save current view action */}
          <div className="my-1 border-t" />
          <div className="px-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleSaveCurrent}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
            >
              <Bookmark aria-hidden="true" className="size-3" />
              Save current view…
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
