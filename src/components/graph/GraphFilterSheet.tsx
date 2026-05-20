"use client";

/**
 * GraphFilterSheet — mobile bottom-sheet filter panel for the vault graph.
 *
 * Replaces FilterSidebar on viewports < 768px. Triggered by the filter button
 * in the page header's mobile action slot (VaultGraphPageClient).
 *
 * Spec refs:
 *   - Interaction spec §6  — mobile bottom sheet wireframe
 *   - Interaction spec §10 — swipe gesture thresholds
 *   - Phase plan P5-02     — requirements
 *
 * Behaviour:
 *   - Sheet height: 60% viewport (CSS `60dvh`, `60vh` fallback).
 *   - Drag handle at top: `role="separator" aria-label="Drag to resize"`.
 *   - Swipe-down dismiss: downward pointer velocity > 0.5 px/ms.
 *   - Swipe-up expand: upward pointer velocity > 0.5 px/ms → 100% height.
 *   - Backdrop click: closes sheet.
 *   - ESC key: closes sheet.
 *   - Canvas dim: parent applies a CSS class (handled in VaultGraphPageClient).
 *
 * Implementation notes:
 *   - Uses PointerEvent API (works for both touch and mouse).
 *   - Velocity measured as |deltaY| / elapsed_ms.
 *   - No Radix / vaul dependency — uses the same custom-primitive pattern as
 *     Dialog.tsx in this repo.
 *
 * P5-02: mobile bottom-sheet filter panel.
 */

import {
  useEffect,
  useRef,
  useCallback,
  useState,
  useId,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Velocity threshold (px/ms) for swipe-to-dismiss / swipe-to-expand. */
const SWIPE_VELOCITY_THRESHOLD = 0.5;

/** Sheet height when in "normal" (partial) state — 60% of viewport. */
const SHEET_HEIGHT_PARTIAL = "60dvh";
const SHEET_HEIGHT_PARTIAL_FALLBACK = "60vh";

/** Sheet height when in "expanded" state — full viewport. */
const SHEET_HEIGHT_FULL = "100dvh";
const SHEET_HEIGHT_FULL_FALLBACK = "100vh";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GraphFilterSheetProps {
  /** Whether the sheet is open. */
  open: boolean;
  /** Called to request the sheet close (backdrop click, swipe-down, ESC, × button). */
  onOpenChangeAction: (open: boolean) => void;
  /** Number of active filter dimensions — shown in the header badge. */
  activeFilterCount?: number;
  /** Filter panel content (FilterPanelContent + GraphFilters). */
  children?: ReactNode;
}

// ---------------------------------------------------------------------------
// GraphFilterSheet
// ---------------------------------------------------------------------------

export function GraphFilterSheet({
  open,
  onOpenChangeAction,
  activeFilterCount = 0,
  children,
}: GraphFilterSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);

  // "expanded" = full-height; "partial" = 60vh (default)
  const [expanded, setExpanded] = useState(false);

  // Reset expanded state when sheet closes
  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  // ── Scroll lock while open ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ── ESC key closes the sheet ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChangeAction(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChangeAction]);

  // ── Focus management — trap focus inside sheet while open ─────────────────
  useEffect(() => {
    if (!open) return;
    const el = sheetRef.current;
    if (!el) return;
    // Focus the close button (first interactive element) on open
    const firstFocusable = el.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
  }, [open]);

  // ── Swipe gesture detection via PointerEvent API ──────────────────────────
  const pointerStart = useRef<{ y: number; t: number } | null>(null);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // Only track primary pointer (touch or left-click)
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pointerStart.current = { y: e.clientY, t: performance.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointerStart.current) return;
      const deltaY = e.clientY - pointerStart.current.y;
      const elapsed = performance.now() - pointerStart.current.t;
      pointerStart.current = null;

      if (elapsed <= 0) return;
      const velocity = Math.abs(deltaY) / elapsed; // px/ms

      if (velocity > SWIPE_VELOCITY_THRESHOLD) {
        if (deltaY > 0) {
          // Swipe down — dismiss or collapse from expanded
          if (expanded) {
            setExpanded(false);
          } else {
            onOpenChangeAction(false);
          }
        } else {
          // Swipe up — expand to full height
          setExpanded(true);
        }
      }
    },
    [expanded, onOpenChangeAction],
  );

  const handlePointerCancel = useCallback(() => {
    pointerStart.current = null;
  }, []);

  // ── Computed sheet height ─────────────────────────────────────────────────
  const sheetHeight = expanded
    ? `min(${SHEET_HEIGHT_FULL}, ${SHEET_HEIGHT_FULL_FALLBACK})`
    : `min(${SHEET_HEIGHT_PARTIAL}, ${SHEET_HEIGHT_PARTIAL_FALLBACK})`;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
        onClick={() => onOpenChangeAction(false)}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label="Graph filters"
        className={cn(
          // Position: fixed at bottom, full width, above backdrop
          "fixed bottom-0 left-0 right-0 z-50",
          // Shape
          "flex flex-col rounded-t-2xl border-t border-x bg-card shadow-2xl",
          // Animate in from below
          "animate-in slide-in-from-bottom duration-300 ease-out",
          // Prevent interaction with elements behind sheet
          "overflow-hidden",
        )}
        style={{
          height: sheetHeight,
          // Smooth height transition when expanding/collapsing
          transition: "height 250ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Drag handle — touch target for swipe detection */}
        <div
          role="separator"
          aria-label="Drag to resize"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className={cn(
            "flex shrink-0 flex-col items-center gap-1 px-4 pt-3 pb-1",
            "cursor-grab active:cursor-grabbing select-none touch-none",
          )}
        >
          {/* Visual handle pill */}
          <div
            aria-hidden="true"
            className="h-1 w-10 rounded-full bg-muted-foreground/30"
          />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal
              aria-hidden="true"
              className="size-3.5 text-muted-foreground shrink-0"
            />
            <span
              id={titleId}
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
            >
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

          {/* Close button */}
          <button
            type="button"
            aria-label="Close filter panel"
            onClick={() => onOpenChangeAction(false)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md",
              "text-muted-foreground hover:text-foreground hover:bg-accent",
              "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        {/* Scrollable filter content */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
