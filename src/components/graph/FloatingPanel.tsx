"use client";

/**
 * FloatingPanel — collapsible floating overlay panel for the graph immersive canvas.
 *
 * Renders via ReactDOM.createPortal to document.body so it stacks above the
 * WebGL/sigma canvas without z-index interference from any ancestor stacking
 * context.
 *
 * Four anchor positions are supported:
 *   "top-left" | "top-right" | "bottom-left" | "bottom-right"
 *
 * Each panel is independently collapsible via:
 *   - The chevron toggle button in the panel header
 *   - A global keyboard shortcut (shortcutKey prop, single char)
 *     Shortcut fires only when the event target is not a text-entry element
 *     and no modifier keys (Ctrl/Cmd/Alt) are held.
 *
 * pointer-events behaviour:
 *   - Collapsed: outer wrapper = pointer-events-none (canvas click-through)
 *   - Expanded:  outer wrapper = pointer-events-auto
 *   - The collapsed toggle button always retains pointer-events-auto
 *
 * Accessibility (A11Y-001):
 *   - Expanded panel has role="dialog" + aria-label={title}.
 *   - Header collapse button has aria-expanded + aria-controls pointing to content.
 *   - Focus trap: Tab / Shift+Tab cycle within focusable elements inside the open panel.
 *     The trap activates only when focus is already inside the panel — it does NOT
 *     prevent the global shortcutKey listener from opening the panel from outside.
 *   - Escape closes the panel and restores focus to the element that was active
 *     when the panel opened (falls back to the collapsed toggle button).
 *   - Icon-only buttons carry explicit aria-label.
 *
 * CSS surface uses --mw-graph-* custom properties defined in graph.css so the
 * panel style is fully dark-theme consistent without introducing new globals.
 *
 * Implements: OVLY-001 (portal-v2.5-graph-immersive, Phase 3)
 *             A11Y-001 (portal-v2.5-graph-immersive, Phase 6)
 * Spec: docs/project_plans/.../phase-2-3-canvas-overlays.md § FloatingPanel Component Spec
 */

import { useEffect, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FloatingPanelProps {
  /** Unique identifier for the panel; used in data attributes and aria-controls. */
  id: string;
  /** Corner to anchor the panel to. Fixed 16px inset from each edge. */
  anchor: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Whether the panel is open on first render. Defaults to true. */
  defaultOpen?: boolean;
  /** Icon shown inside the collapsed toggle button. */
  collapsedIcon: React.ReactNode;
  /**
   * Single character keyboard shortcut to toggle the panel globally.
   * Case-insensitive. No modifier keys (ctrl/cmd/alt). Ignored when focus is
   * inside a text-entry element or inside [data-floating-panel-content].
   */
  shortcutKey?: string;
  /** Displayed in the panel header. Also used as aria-label for the region. */
  title?: string;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Anchor position helpers
// ---------------------------------------------------------------------------

/** Tailwind fixed-position classes for each anchor. 16px = 4 in Tailwind scale. */
const ANCHOR_CLASSES: Record<FloatingPanelProps["anchor"], string> = {
  "top-left": "top-4 left-4",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-right": "bottom-4 right-4",
};

/** Origin for the scale(0) collapse animation — collapses toward the anchor corner. */
const TRANSFORM_ORIGIN: Record<FloatingPanelProps["anchor"], string> = {
  "top-left": "origin-top-left",
  "top-right": "origin-top-right",
  "bottom-left": "origin-bottom-left",
  "bottom-right": "origin-bottom-right",
};

/** Chevron direction for the header toggle — points toward the anchor edge. */
function CollapseChevron({ anchor, open }: { anchor: FloatingPanelProps["anchor"]; open: boolean }) {
  const cls = "size-3.5 shrink-0";
  if (anchor === "top-left" || anchor === "top-right") {
    return open
      ? <ChevronUp aria-hidden className={cls} />
      : <ChevronDown aria-hidden className={cls} />;
  }
  return open
    ? <ChevronDown aria-hidden className={cls} />
    : <ChevronUp aria-hidden className={cls} />;
}

// ---------------------------------------------------------------------------
// Text-entry guard — don't steal keyboard shortcuts while user types
// ---------------------------------------------------------------------------

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea") return true;
  if (target.hasAttribute("contenteditable")) return true;
  if (target.closest("[data-floating-panel-content]")) return true;
  return false;
}

// ---------------------------------------------------------------------------
// A11Y-001: focusable elements selector (WCAG 2.1 §Focus Order)
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable]",
].join(", ");

// ---------------------------------------------------------------------------
// FloatingPanel
// ---------------------------------------------------------------------------

export function FloatingPanel({
  id,
  anchor,
  defaultOpen = true,
  collapsedIcon,
  shortcutKey,
  title,
  children,
}: FloatingPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  // Stable ID for aria-controls even when component remounts
  const contentId = `floating-panel-${id}`;
  const toggleRef = useRef<HTMLButtonElement>(null);
  // A11Y-001: remember the element focused before the panel opened for focus restoration
  const priorFocusRef = useRef<Element | null>(null);
  // Ref to the expanded panel root for focus trap
  const panelRef = useRef<HTMLDivElement>(null);

  // SSR guard — portal requires document.body
  useEffect(() => {
    setMounted(true);
  }, []);

  // A11Y-001: record active element when panel opens; restore on close
  const handleOpen = useCallback(() => {
    priorFocusRef.current = document.activeElement;
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Restore focus to the element that was focused when the panel opened.
    // Fall back to the collapsed toggle button if the prior element is gone.
    requestAnimationFrame(() => {
      const prior = priorFocusRef.current;
      if (prior && prior instanceof HTMLElement && document.contains(prior)) {
        prior.focus();
      } else {
        toggleRef.current?.focus();
      }
      priorFocusRef.current = null;
    });
  }, []);

  // Global keyboard shortcut
  useEffect(() => {
    if (!shortcutKey || !mounted) return;
    const key = shortcutKey; // narrowed to string for closure

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when modifier keys are held
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Ignore when typing in a text field
      if (isTextEntry(e.target)) return;
      if (e.key.toLowerCase() === key.toLowerCase()) {
        // A11Y-001: use the focus-aware open/close handlers
        setOpen((prev) => {
          if (!prev) {
            priorFocusRef.current = document.activeElement;
          }
          return !prev;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcutKey, mounted]);

  // A11Y-001: focus trap + Escape key handler (active only when panel is open)
  useEffect(() => {
    if (!open || !mounted) return;
    const panel = panelRef.current;
    if (!panel) return;

    // `panel` is non-null here (checked above), but capture in local const so
    // TypeScript can narrow inside the closures below.
    const panelEl = panel;

    function getFocusables(): HTMLElement[] {
      return Array.from(panelEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.closest("[aria-hidden='true']"),
      );
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Escape: close and restore focus
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
        return;
      }

      // Tab / Shift+Tab: trap focus within the panel ONLY when focus is already inside.
      // This preserves the existing global shortcutKey behavior — pressing the shortcut
      // from outside focuses the panel toggle, but does not immediately enter the trap.
      if (e.key === "Tab") {
        const active = document.activeElement;
        if (!panelEl.contains(active)) return; // focus is outside — let Tab flow normally

        const focusables = getFocusables();
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: wrap to last when on first
          if (active === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab: wrap to first when on last
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    // Listen on the panel element to intercept before bubbling; capture=true so
    // we catch events targeting deeply-nested focusables.
    panelEl.addEventListener("keydown", handleKeyDown, true);
    return () => panelEl.removeEventListener("keydown", handleKeyDown, true);
  }, [open, mounted, handleClose]);

  if (!mounted) return null;

  const anchorClasses = ANCHOR_CLASSES[anchor];
  const originClass = TRANSFORM_ORIGIN[anchor];
  const shortcutLabel = shortcutKey ? ` (${shortcutKey.toUpperCase()})` : "";

  // The portal content: a fixed-position wrapper containing both the panel
  // and the collapsed toggle. The outer wrapper toggles pointer-events so a
  // collapsed panel does not swallow canvas clicks.
  const content = (
    <div
      data-floating-panel={id}
      data-anchor={anchor}
      data-open={String(open)}
      className={cn(
        "fixed z-50",
        anchorClasses,
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      // Prevent accidental propagation of non-shortcut keys from child inputs
      // reaching the window listener above
      onKeyDown={(e) => {
        // If focus is inside the content area, let the child handle it
        if ((e.target as Element)?.closest("[data-floating-panel-content]")) {
          e.stopPropagation();
        }
      }}
    >
      {/* ── Collapsed toggle button ────────────────────────────────────── */}
      {/* Always rendered; visible only when panel is closed */}
      <button
        ref={toggleRef}
        type="button"
        onClick={handleOpen}
        aria-expanded={open}
        aria-controls={contentId}
        title={`Open ${title ?? id}${shortcutLabel}`}
        aria-label={`Open ${title ?? id}${shortcutLabel}`}
        className={cn(
          // Always pointer-events-auto even when outer wrapper is none
          "pointer-events-auto",
          // Visually show/hide with opacity + scale; keep in DOM for a11y
          open
            ? "pointer-events-none opacity-0 scale-0"
            : "opacity-100 scale-100",
          "absolute",
          // Collapsed button anchors to the same corner as the panel
          anchor === "top-left" && "top-0 left-0",
          anchor === "top-right" && "top-0 right-0",
          anchor === "bottom-left" && "bottom-0 left-0",
          anchor === "bottom-right" && "bottom-0 right-0",
          // Size + appearance
          "flex size-10 items-center justify-center rounded-lg",
          // Translucent panel surface
          "border border-[var(--mw-graph-border)] shadow-xl backdrop-blur-md",
          "bg-[color-mix(in_srgb,var(--mw-graph-surface)_85%,transparent)]",
          "text-[var(--mw-graph-text-primary)]",
          "transition-all duration-150 ease-[ease]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mw-graph-accent)]",
          "hover:bg-[color-mix(in_srgb,var(--mw-graph-surface)_95%,transparent)]",
        )}
      >
        {collapsedIcon}
        {/* Shortcut <kbd> chip in bottom-right of the button */}
        {shortcutKey && (
          <kbd
            aria-hidden
            className={cn(
              "absolute bottom-0.5 right-0.5",
              "rounded px-0.5 text-[9px] font-mono leading-none",
              "bg-[var(--mw-graph-border)] text-[var(--mw-graph-text-secondary)]",
              "select-none",
            )}
          >
            {shortcutKey.toUpperCase()}
          </kbd>
        )}
      </button>

      {/* ── Expanded panel ─────────────────────────────────────────────── */}
      {/* A11Y-001: role="dialog" + aria-label so screen readers announce panel purpose */}
      <div
        ref={panelRef}
        id={contentId}
        role="dialog"
        aria-label={title ?? id}
        aria-modal="false"
        className={cn(
          // Animate open/closed: scale from origin + fade
          originClass,
          open
            ? "scale-100 opacity-100"
            : "scale-0 opacity-0 pointer-events-none",
          "transition-[transform,opacity] duration-150 ease-[ease]",
          // Surface
          "rounded-lg border border-[var(--mw-graph-border)] shadow-xl backdrop-blur-md",
          "bg-[color-mix(in_srgb,var(--mw-graph-surface)_85%,transparent)]",
          "text-[var(--mw-graph-text-primary)]",
        )}
      >
        {/* Header — always rendered; title text is optional */}
        <div
          className={cn(
            "flex items-center justify-between gap-2 px-3 py-2",
            "border-b border-[var(--mw-graph-border)]",
          )}
        >
          {title && (
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--mw-graph-text-secondary)] select-none">
              {title}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {shortcutKey && (
              <kbd
                aria-label={`Keyboard shortcut: ${shortcutKey.toUpperCase()}`}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-mono",
                  "bg-[var(--mw-graph-border)] text-[var(--mw-graph-text-secondary)]",
                  "select-none",
                )}
              >
                {shortcutKey.toUpperCase()}
              </kbd>
            )}
            {/* A11Y-001: collapse button — explicit aria-label, aria-expanded, aria-controls */}
            <button
              type="button"
              onClick={handleClose}
              aria-expanded={open}
              aria-controls={contentId}
              title={`Collapse ${title ?? id}${shortcutLabel}`}
              aria-label={open ? `Collapse ${title ?? id}${shortcutLabel}` : `Expand ${title ?? id}${shortcutLabel}`}
              className={cn(
                "flex size-6 items-center justify-center rounded",
                "text-[var(--mw-graph-text-secondary)]",
                "transition-colors duration-100",
                "hover:bg-[var(--mw-graph-border)] hover:text-[var(--mw-graph-text-primary)]",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mw-graph-accent)]",
              )}
            >
              <CollapseChevron anchor={anchor} open={open} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          data-floating-panel-content
          className="p-3 min-w-[260px] max-w-[420px] max-h-[80vh] overflow-auto"
        >
          {children}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
