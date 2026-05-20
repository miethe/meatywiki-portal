"use client";

/**
 * FilterSidebar — v2.2 shell with 280px open / 48px collapsed rail.
 *
 * P3-01: Shell — open/collapsed rail, breakpoint-responsive defaults,
 *         CSS width transition, ARIA, keyboard (ESC), active-count badge.
 * P3-02: 16-dimension filter controls (to be filled into filter-sidebar__content).
 *
 * Design spec refs:
 *   - Filter contract §0, §1, §5 — filter-sidebar__content sections
 *   - Interaction spec §1 (breakpoints), §2 (sidebar wireframe),
 *     §12 (animation: 200ms easeInOutCubic)
 *
 * Breakpoint defaults (SSR-safe — server returns collapsed, client corrects on mount):
 *   ≥ 1280px  →  open by default
 *   768–1279px →  collapsed (rail) by default; click to expand
 *   < 768px   →  hidden (bottom-sheet is P5-02; render null here)
 *
 * CSS transition: width 280px ↔ 48px at 200ms cubic-bezier(0.65,0,0.35,1)
 * (easeInOutCubic per interaction-spec §12)
 *
 * ⚠ Backward-compat: the old v2.1 props (nodeTypes, edgeTypes, onNodeTypesChange,
 *   onEdgeTypesChange, onClearAll, alwaysVisible) are still accepted so that
 *   VaultGraphPageClient.tsx continues to type-check until P3-02 replaces the
 *   wiring. They are forwarded to legacy sub-sections if present, but the new
 *   controlled API (open / onOpenChange) takes precedence for the shell layout.
 *
 * v2.2 — vault graph filter overhaul (P3-01).
 */

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { SlidersHorizontal, ChevronLeft, ChevronRight, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GraphNodeType, GraphEdgeType } from "@/types/graph";

// ---------------------------------------------------------------------------
// useFilterSidebarDefault — SSR-safe breakpoint hook
// ---------------------------------------------------------------------------

/**
 * Returns the default open state for the sidebar based on viewport width.
 *
 * Rules (per interaction spec §1):
 *   ≥ 1280px → open (true)
 *   768–1279px → collapsed (false)
 *   < 768px → hidden (handled by render null in FilterSidebar)
 *
 * SSR: returns false (collapsed) on the server; updates on first client mount.
 * This avoids a hydration mismatch — the client corrects immediately via
 * useEffect before the user can interact.
 */
export function useFilterSidebarDefault(): boolean {
  // SSR-safe: start collapsed so server + first client render match.
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Guard: should never be server-side, but keep defensive.
    if (typeof window === "undefined") return;

    const mql = window.matchMedia("(min-width: 1280px)");
    // Set the correct initial state once mounted.
    setIsOpen(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsOpen(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isOpen;
}

// ---------------------------------------------------------------------------
// useFilterSidebarHidden — true when viewport is <768px (bottom-sheet territory)
// ---------------------------------------------------------------------------

function useFilterSidebarHidden(): boolean {
  // SSR: assume not hidden (collapsed is safe fallback; hidden would lose content).
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia("(max-width: 767px)");
    setIsHidden(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsHidden(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isHidden;
}

// ---------------------------------------------------------------------------
// Section stub structure (shape placeholder for P3-02 controls)
// ---------------------------------------------------------------------------

/** Section labels mirror the filter contract §1 priority groupings. */
const FILTER_SECTIONS: Array<{ id: string; label: string; priority: "primary" | "secondary" | "advanced" }> = [
  { id: "workspace",    label: "Workspace",    priority: "primary"   },
  { id: "type",        label: "Artifact Type", priority: "primary"   },
  { id: "edges",       label: "Edges",         priority: "primary"   },
  { id: "freshness",   label: "Freshness",     priority: "secondary" },
  { id: "project",     label: "Project",       priority: "secondary" },
  { id: "domain",      label: "Domain",        priority: "secondary" },
  { id: "date",        label: "Date Range",    priority: "secondary" },
  { id: "fidelity",    label: "Fidelity",      priority: "advanced"  },
  { id: "fscore",      label: "Freshness Score",priority: "advanced" },
  { id: "confidence",  label: "Confidence",    priority: "advanced"  },
  { id: "lifecycle",   label: "Lifecycle",     priority: "advanced"  },
  { id: "status",      label: "Status",        priority: "advanced"  },
  { id: "verif",       label: "Verification",  priority: "advanced"  },
  { id: "tags",        label: "Tags",          priority: "advanced"  },
  { id: "semantic",    label: "Semantic Neighbor", priority: "advanced" },
  { id: "search",      label: "Search",        priority: "primary"   },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FilterSidebarProps {
  // ── v2.2 controlled API ──────────────────────────────────────────────────
  /** Current open state (controlled). If omitted, internal state is used. */
  open?: boolean;
  /** Called when the sidebar requests an open/close state change. */
  onOpenChange?: (open: boolean) => void;
  /** Number of active filter dimensions (shown as badge on the rail icon). */
  activeFilterCount?: number;
  /** Content slot — P3-02 fills this with 16-dim controls. */
  children?: ReactNode;
  className?: string;

  // ── P3-02: always-visible free-text search (dim 16) ─────────────────────
  /**
   * Current free-text search query (dim 16 — always visible per filter contract §10).
   * Rendered in the open-mode header below the title, above the accordion children.
   */
  searchValue?: string;
  /** Called when the search input value changes. */
  onSearchChange?: (value: string) => void;

  // ── v2.1 backward-compat props (no-op wrappers until P3-02) ─────────────
  /** @deprecated v2.1 — will be replaced by children in P3-02. */
  nodeTypes?: GraphNodeType[];
  /** @deprecated v2.1 */
  edgeTypes?: GraphEdgeType[];
  /** @deprecated v2.1 */
  onNodeTypesChange?: (types: GraphNodeType[]) => void;
  /** @deprecated v2.1 */
  onEdgeTypesChange?: (types: GraphEdgeType[]) => void;
  /** @deprecated v2.1 */
  onClearAll?: () => void;
  /** @deprecated v2.1 — has no effect in v2.2; use breakpoint hook instead. */
  alwaysVisible?: boolean;
}

// ---------------------------------------------------------------------------
// ActiveCountBadge
// ---------------------------------------------------------------------------

function ActiveCountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      aria-label={`${count} active filter${count === 1 ? "" : "s"}`}
      className={cn(
        "absolute -top-1 -right-1",
        "flex h-4 min-w-4 items-center justify-center rounded-full px-1",
        "bg-primary text-primary-foreground text-[10px] font-semibold leading-none",
        "pointer-events-none select-none",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Rail (collapsed) view
// ---------------------------------------------------------------------------

interface RailProps {
  activeFilterCount: number;
  contentId: string;
  onExpand: () => void;
}

function Rail({ activeFilterCount, contentId, onExpand }: RailProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-3">
      {/* Filter icon button */}
      <div className="relative">
        <button
          type="button"
          aria-label="Expand graph filters"
          aria-expanded={false}
          aria-controls={contentId}
          onClick={onExpand}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md",
            "text-muted-foreground hover:text-foreground hover:bg-accent",
            "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
        </button>
        <ActiveCountBadge count={activeFilterCount} />
      </div>

      {/* Expand chevron hint */}
      <button
        type="button"
        aria-label="Expand graph filters"
        onClick={onExpand}
        tabIndex={-1}
        aria-hidden="true"
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded",
          "text-muted-foreground/60 hover:text-muted-foreground",
          "transition-colors focus:outline-none",
        )}
      >
        <ChevronRight aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterSidebar (main component)
// ---------------------------------------------------------------------------

export function FilterSidebar({
  open: openProp,
  onOpenChange,
  activeFilterCount: activeFilterCountProp,
  children,
  className,
  searchValue,
  onSearchChange,
  // v2.1 backward-compat props
  nodeTypes,
  edgeTypes,
  onClearAll,
}: FilterSidebarProps) {
  const contentId = useId();
  const sidebarRef = useRef<HTMLElement>(null);

  // ── Controlled vs. uncontrolled open state ───────────────────────────────
  const isControlled = openProp !== undefined;
  const defaultOpen = useFilterSidebarDefault();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  // Sync internal state to default when default flips (breakpoint change)
  useEffect(() => {
    if (!isControlled) {
      setInternalOpen(defaultOpen);
    }
  }, [defaultOpen, isControlled]);

  const open = isControlled ? openProp! : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  // ── Hidden below 768px (bottom-sheet territory — P5-02) ─────────────────
  const hidden = useFilterSidebarHidden();
  if (hidden) return null;

  // ── Active filter count (derived from v2.1 compat props if not provided) ─
  const legacyActiveCount =
    (nodeTypes?.length ?? 0) + (edgeTypes?.length ?? 0);
  const activeFilterCount = activeFilterCountProp ?? legacyActiveCount;

  // ── ESC key collapses the sidebar ────────────────────────────────────────
  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <aside
      ref={sidebarRef}
      role="complementary"
      aria-label="Graph filters"
      onKeyDown={handleKeyDown}
      className={cn(
        // Layout: fixed height, flex column, overflow handling
        "filter-sidebar relative flex flex-col shrink-0 rounded-lg border bg-card overflow-hidden",
        // Height: fill parent (graph body row is items-stretch)
        "self-stretch",
        className,
      )}
      style={{
        // CSS width transition: 280px ↔ 48px at 200ms easeInOutCubic
        // Using inline style for the timing function because Tailwind doesn't
        // expose arbitrary cubic-bezier in transition-timing-function utilities.
        width: open ? "280px" : "48px",
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — valid CSS property; TS doesn't model all vendor/spec keys
        transition: "width 200ms cubic-bezier(0.65, 0, 0.35, 1)",
        minWidth: open ? "280px" : "48px",
      }}
    >
      {open ? (
        // ── Open (expanded) panel ──────────────────────────────────────────
        <>
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b px-3 py-2.5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal
                aria-hidden="true"
                className="size-3.5 text-muted-foreground shrink-0"
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                Graph Filters
              </span>
              {activeFilterCount > 0 && (
                <span
                  aria-label={`${activeFilterCount} active`}
                  className={cn(
                    "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1",
                    "bg-primary/15 text-primary text-[10px] font-semibold leading-none",
                  )}
                >
                  {activeFilterCount}
                </span>
              )}
            </div>

            {/* Collapse button */}
            <button
              type="button"
              aria-label="Collapse filter sidebar"
              aria-expanded={true}
              aria-controls={contentId}
              onClick={() => setOpen(false)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md",
                "text-muted-foreground hover:text-foreground hover:bg-accent",
                "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
          </div>

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

          {/* Content area — filled by P3-02 via children prop */}
          <div
            id={contentId}
            className="filter-sidebar__content flex-1 overflow-y-auto"
          >
            {children ?? (
              // Stub sections — shape placeholder until P3-02 adds real controls
              <div className="flex flex-col gap-0 p-1">
                {/* Primary filters */}
                <FilterSectionStub
                  label="Primary Filters"
                  sections={FILTER_SECTIONS.filter((s) => s.priority === "primary")}
                />

                {/* Secondary filters */}
                <FilterSectionStub
                  label="Secondary Filters"
                  sections={FILTER_SECTIONS.filter((s) => s.priority === "secondary")}
                />

                {/* Advanced filters (collapsed accordion — P3-02 will implement) */}
                <FilterSectionStub
                  label="Advanced Filters"
                  sections={FILTER_SECTIONS.filter((s) => s.priority === "advanced")}
                  collapsed
                />
              </div>
            )}
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
        </>
      ) : (
        // ── Collapsed (rail) view ──────────────────────────────────────────
        <Rail
          activeFilterCount={activeFilterCount}
          contentId={contentId}
          onExpand={() => setOpen(true)}
        />
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// FilterSectionStub — shape placeholder for P3-02 controls
// ---------------------------------------------------------------------------

interface FilterSectionStubProps {
  label: string;
  sections: Array<{ id: string; label: string }>;
  collapsed?: boolean;
}

function FilterSectionStub({ label, sections, collapsed = false }: FilterSectionStubProps) {
  const [isOpen, setIsOpen] = useState(!collapsed);

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between px-3 py-2",
          "text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
          "hover:text-foreground transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        )}
      >
        {label}
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-3 shrink-0 transition-transform duration-150",
            isOpen && "rotate-90",
          )}
        />
      </button>

      {isOpen && (
        <div className="flex flex-col gap-0.5 pb-2 px-3">
          {sections.map((section) => (
            <div
              key={section.id}
              className="flex h-7 items-center rounded-sm px-1 text-xs text-muted-foreground/60 italic"
            >
              {/* P3-02 will replace this stub with the real control */}
              {section.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
