"use client";

/**
 * useCostBreakdown — TanStack Query hook for fetching per-stage cost data.
 *
 * Wraps GET /api/artifacts/:id?include=cost via ``getArtifactWithCost``.
 *
 * Returns:
 *   - costBreakdown: CostBreakdownResponse | null — cost data; null when the
 *     artifact exists but has no recorded cost data (expected for artifacts
 *     compiled before cost telemetry was introduced, or for skipped stages).
 *   - isLoading: boolean — true on first fetch (no cached data)
 *   - isError: boolean — true when the fetch failed
 *   - error: Error | null — ApiError on 404/5xx; generic Error on network failure
 *   - isNotFound: boolean — true when the error is a 404 Not Found
 *
 * Cache strategy:
 *   - staleTime: 30s — cost data changes only after a new workflow run;
 *     30 s matches the base ``useArtifact`` staleTime for consistency.
 *   - gcTime: 5min — cached entries kept 5 minutes after unmount
 *   - retry: false — Portal is local-only; retries do not help.
 *
 * Null semantics:
 *   ``costBreakdown`` is null in two distinct cases:
 *     1. Loading — ``isLoading`` is true; do not treat as "no data"
 *     2. Backend returned null / omitted the field — artifact has no cost data
 *   Callers should render the "No cost data available" state only when
 *   ``!isLoading && costBreakdown === null``.
 *
 * P4-FE-002.
 */

import { useQuery } from "@tanstack/react-query";
import { getArtifactWithCost } from "@/lib/api/artifacts";
import { ApiError } from "@/lib/api/client";
import type { CostBreakdownResponse } from "@/types/artifact";
import type { ArtifactDetailWithCost } from "@/lib/api/artifacts";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

/**
 * Stable query key for cost breakdown data.
 * Scoped under ["artifact", "cost", id] to avoid collision with the base
 * artifact detail key ["artifact", "detail", id].
 */
export const costBreakdownQueryKey = (id: string) =>
  ["artifact", "cost", id] as const;

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseCostBreakdownResult {
  /**
   * Per-stage cost breakdown; null when no cost data exists for this artifact.
   * Undefined while loading (use ``isLoading`` to differentiate).
   */
  costBreakdown: CostBreakdownResponse | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  /** ApiError on 404/4xx/5xx; generic Error on network failure */
  error: Error | null;
  /** True when the error is a 404 Not Found (artifact does not exist) */
  isNotFound: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCostBreakdown(id: string): UseCostBreakdownResult {
  const { data, isLoading, isFetching, isError, error } = useQuery<
    ArtifactDetailWithCost,
    Error
  >({
    queryKey: costBreakdownQueryKey(id),
    queryFn: () => getArtifactWithCost(id),
    enabled: Boolean(id),
    staleTime: 30_000,   // 30 seconds — matches useArtifact
    gcTime: 5 * 60_000,  // 5 minutes
    // No retries: Portal is local-only. 404 = artifact doesn't exist;
    // 5xx = backend needs attention. Neither benefits from retrying.
    retry: false,
  });

  const isNotFound =
    isError && error instanceof ApiError && error.status === 404;

  // Extract cost_breakdown from the detail response.
  // data?.cost_breakdown will be undefined before the query resolves and
  // null/undefined when the backend omits the field (no cost data recorded).
  const costBreakdown: CostBreakdownResponse | null =
    data?.cost_breakdown ?? null;

  return {
    costBreakdown,
    isLoading,
    isFetching,
    isError,
    error: error as Error | null,
    isNotFound,
  };
}
