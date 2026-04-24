/**
 * useFreshnessStatus — cursor-paginated hook for the Stale Artifacts panel.
 *
 * Fetches GET /api/artifacts/research/freshness-status with a configurable
 * threshold_days param. Supports Next / Prev cursor navigation.
 *
 * Key design choices:
 * - Uses plain useState + useEffect (not TanStack infinite query) because the
 *   panel uses discrete Prev/Next cursor navigation rather than append-style
 *   load-more. This keeps the page content stable (no accumulated list).
 * - threshold_days input is debounced by 400ms at the call site
 *   (StaleArtifactsPanel handles debounce via useDebounce).
 * - Cursor history is maintained in a stack so Prev navigation works without
 *   a server-side prevCursor field.
 *
 * P7-01: Research workspace — Stale Artifacts panel.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getFreshnessStatus, type FreshnessItem } from "@/lib/api/research";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Hook result type
// ---------------------------------------------------------------------------

export interface UseFreshnessStatusResult {
  items: FreshnessItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** True when a next page is available. */
  hasNext: boolean;
  /** True when a previous page is available (cursor stack depth > 0). */
  hasPrev: boolean;
  /** Advance to the next page. No-op if no next cursor. */
  fetchNext: () => void;
  /** Return to the previous page. No-op if on the first page. */
  fetchPrev: () => void;
  /** Current page index (0-based, for display as "Page N"). */
  pageIndex: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 20;

export function useFreshnessStatus(
  thresholdDays: number,
  limit: number = DEFAULT_LIMIT,
): UseFreshnessStatusResult {
  // Current forward cursor (null = first page)
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  // Stack of cursors seen so far — each entry is the cursor that produced
  // that page, so popping navigates back.
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);

  const [items, setItems] = useState<FreshnessItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // AbortController ref so we can cancel in-flight requests on param change.
  const abortRef = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      // Cancel any in-flight request.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setIsError(false);
      setError(null);

      try {
        const result = await getFreshnessStatus({
          threshold_days: thresholdDays,
          cursor,
          limit,
        });

        if (controller.signal.aborted) return;

        setItems(result.data);
        setNextCursor(result.cursor ?? null);
      } catch (err) {
        if (controller.signal.aborted) return;
        const e = err instanceof Error ? err : new Error(String(err));
        // 404 → treat as empty (endpoint may not exist yet)
        if (err instanceof ApiError && err.status === 404) {
          setItems([]);
          setNextCursor(null);
        } else {
          setIsError(true);
          setError(e);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [thresholdDays, limit],
  );

  // Re-fetch when threshold_days changes: reset pagination.
  useEffect(() => {
    setCurrentCursor(null);
    setCursorStack([]);
    void fetchPage(null);

    return () => {
      abortRef.current?.abort();
    };
  }, [thresholdDays, fetchPage]);

  const fetchNext = useCallback(() => {
    if (!nextCursor) return;
    setCursorStack((prev) => [...prev, currentCursor]);
    setCurrentCursor(nextCursor);
    void fetchPage(nextCursor);
  }, [nextCursor, currentCursor, fetchPage]);

  const fetchPrev = useCallback(() => {
    if (cursorStack.length === 0) return;
    const stack = [...cursorStack];
    const prevCursor = stack.pop() ?? null;
    setCursorStack(stack);
    setCurrentCursor(prevCursor);
    void fetchPage(prevCursor);
  }, [cursorStack, fetchPage]);

  return {
    items,
    isLoading,
    isError,
    error,
    hasNext: nextCursor !== null,
    hasPrev: cursorStack.length > 0,
    fetchNext,
    fetchPrev,
    pageIndex: cursorStack.length,
  };
}

// ---------------------------------------------------------------------------
// useDebounce — lightweight debounce hook used by StaleArtifactsPanel
// ---------------------------------------------------------------------------

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * of no changes. Used to defer threshold_days API calls while the user types.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
