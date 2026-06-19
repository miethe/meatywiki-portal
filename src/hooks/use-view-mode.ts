"use client";

import { useState, useEffect, useCallback } from "react";
import type { ViewMode } from "@/components/ui/view-toggle";

// ---------------------------------------------------------------------------
// useViewMode — SSR-safe, localStorage-persisted view mode hook
// ---------------------------------------------------------------------------

/**
 * Returns the current view mode, a setter that persists to localStorage, and
 * a `mounted` flag that is false during SSR / the first render pass.
 *
 * All `window` access is deferred to a useEffect so that the hook is safe in
 * Next.js server components and avoids hydration mismatches.
 *
 * @param storageKey  - The localStorage key to read/write.
 * @param fallback    - The view mode to use when no persisted value exists (default: "grid").
 */
export function useViewMode(
  storageKey: string,
  fallback: ViewMode = "grid",
): { viewMode: ViewMode; setViewMode: (next: ViewMode) => void; mounted: boolean } {
  const [viewMode, setViewModeState] = useState<ViewMode>(fallback);
  const [mounted, setMounted] = useState(false);

  // Read from localStorage after first mount to avoid SSR mismatch
  useEffect(() => {
    let initial: ViewMode = fallback;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "list" || stored === "grid") {
        initial = stored;
      }
    } catch {
      // localStorage unavailable — fall back to default
    }
    setViewModeState(initial);
    setMounted(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setViewMode = useCallback(
    (next: ViewMode) => {
      setViewModeState(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // Ignore localStorage errors (private browsing, storage quota, etc.)
      }
    },
    [storageKey],
  );

  return { viewMode, setViewMode, mounted };
}
