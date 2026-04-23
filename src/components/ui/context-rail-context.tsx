"use client";

/**
 * ContextRailContext — lightweight toggle state for the Context Rail.
 *
 * On desktop (≥1280px) the rail is always visible via CSS.
 * On mobile (<1280px) visibility is controlled by `isOpen` state.
 *
 * Usage:
 *   - Wrap layout with <ContextRailProvider>
 *   - Use <ContextRailToggleButton> in the top bar (wired in later phases)
 *   - ContextRail reads `isOpen` to apply the appropriate class
 */

import React, { createContext, useContext, useState, useCallback } from "react";

interface ContextRailContextValue {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const ContextRailContext = createContext<ContextRailContextValue | null>(null);

export function ContextRailProvider({
  children,
  defaultOpen = false,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <ContextRailContext.Provider value={{ isOpen, toggle, open, close }}>
      {children}
    </ContextRailContext.Provider>
  );
}

export function useContextRailToggle(): ContextRailContextValue {
  const ctx = useContext(ContextRailContext);
  if (!ctx) {
    // Graceful fallback when used outside a provider (e.g. in tests or
    // before the provider is wired up). Returns a no-op singleton.
    const noop = () => {};
    return { isOpen: false, toggle: noop, open: noop, close: noop };
  }
  return ctx;
}

/**
 * ContextRailToggleButton — minimal button that wires into the top bar.
 * Renders as a <button>; callers supply icon + aria-label via children.
 * Top bar integration is deferred to later phases (P3+).
 */
export function ContextRailToggleButton({
  children,
  className,
  "aria-label": ariaLabel = "Toggle context rail",
}: {
  children?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const { toggle } = useContextRailToggle();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </button>
  );
}
