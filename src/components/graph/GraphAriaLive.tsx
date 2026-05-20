"use client";

/**
 * GraphAriaLive — ARIA live region component for graph announcements.
 *
 * Provides a sr-only live region (role="status", aria-live="polite") that announces
 * important graph state changes to screen readers. Uses a React Context to wire event
 * handlers from VaultGraphPageClient to the announcer.
 *
 * Implements P5-06: ARIA live region with 7 announcement templates per interaction spec §11.
 *
 * Templates:
 *   1. Filter applied   — "Showing N nodes, M edges. Filtered to: [chips]."
 *   2. Filter cleared   — "All filters cleared. Showing N nodes, M edges."
 *   3. Focus entered    — "Focus mode: [mode] from [node title]. K nodes highlighted."
 *   4. Focus exited     — "Focus mode off. Showing N nodes."
 *   5. Node selected    — "[Node title] selected. [Type], [workspace]."
 *   6. Multi-select     — "N nodes selected: [title 1], [title 2], and N more."
 *   7. Camera preset    — "View changed to: [preset name]."
 *   8. Layout settle    — "Graph layout complete. N nodes positioned."
 */

import React, { createContext, useContext, useCallback, useState } from "react";

interface GraphAriaLiveContextValue {
  announce: (message: string) => void;
}

const GraphAriaLiveContext = createContext<GraphAriaLiveContextValue | null>(null);

/**
 * useAriaAnnouncer — hook to get the announce function.
 * Call this from VaultGraphPageClient or any child that needs to announce events.
 */
export function useAriaAnnouncer() {
  const context = useContext(GraphAriaLiveContext);
  if (!context) {
    // Return a no-op if context is missing (early mount edge case)
    return {
      announce: () => {
        // no-op
      },
    };
  }
  return context;
}

/**
 * GraphAriaLive — provider that owns the live region state and exposes
 * `announce()` to descendants via context. Wrap the graph subtree so
 * `useAriaAnnouncer()` calls inside the tree resolve. The sr-only live region
 * renders alongside `children` without affecting visual layout.
 */
interface GraphAriaLiveProps {
  children?: React.ReactNode;
}

export function GraphAriaLive({ children }: GraphAriaLiveProps) {
  const [announcement, setAnnouncement] = useState("");

  const announce = useCallback((message: string) => {
    // Clear and reset to trigger aria-live update
    setAnnouncement("");
    // Batch the update on next tick to ensure AT detects the change
    requestAnimationFrame(() => {
      setAnnouncement(message);
    });
  }, []);

  return (
    <GraphAriaLiveContext.Provider value={{ announce }}>
      {/* Live region — sr-only, aria-live="polite" per interaction spec §11 */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="sr-only"
      >
        {announcement}
      </div>
      {children}
    </GraphAriaLiveContext.Provider>
  );
}
