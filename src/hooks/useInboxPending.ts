/**
 * useInboxPending — TanStack Query hook for the Inbox approval queue.
 *
 * Fetches all intake jobs awaiting approval from GET /api/intake/pending
 * and polls every 30 seconds when there are pending items. Polling is
 * suppressed when count is 0 (nothing to wait for) and paused when the
 * browser tab is in the background.
 *
 * This hook is the data layer for the Inbox Approval UI (P1-02). Mutation
 * hooks for approve/reject/scan are intentionally separate so consumers
 * can import only what they need.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { listPending } from "@/lib/api/intake";
import type { IntakePendingItem } from "@/lib/api/intake";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Query key for the pending intake list — used to invalidate from mutations. */
export const INBOX_PENDING_QUERY_KEY = ["intake", "pending"] as const;

/** Polling interval in milliseconds when count > 0. */
const POLL_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseInboxPendingResult {
  /** Pending intake items, defaults to [] when data is not yet loaded. */
  items: IntakePendingItem[];
  /** Total count of pending items, defaults to 0 when data is not yet loaded. */
  count: number;
  /** True while the initial fetch is in-flight (no cached data yet). */
  isLoading: boolean;
  /** Error object if the last fetch failed, otherwise null. */
  error: Error | null;
  /** Imperatively re-fetch the pending list (e.g. after a manual scan). */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the list of intake jobs currently awaiting approval.
 *
 * Polling behaviour:
 *   - When `count > 0`: re-fetches every 30 seconds (foreground only).
 *   - When `count === 0` or data is undefined: polling is disabled.
 *   - `refetchIntervalInBackground: false` — pauses when the tab is hidden.
 */
export function useInboxPending(): UseInboxPendingResult {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: INBOX_PENDING_QUERY_KEY,
    queryFn: listPending,
    refetchInterval: (query) => {
      const count = query.state.data?.count ?? 0;
      return count > 0 ? POLL_INTERVAL_MS : false;
    },
    refetchIntervalInBackground: false,
  });

  return {
    items: data?.items ?? [],
    count: data?.count ?? 0,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
