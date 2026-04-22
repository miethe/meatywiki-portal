"use client";

/**
 * useDerivatives — TanStack Query hook for fetching derivative artifacts
 * compiled from a source artifact.
 *
 * Wraps GET /api/artifacts/:sourceId/derivatives via `getDerivatives`.
 *
 * Returns:
 *   - derivatives: DerivativeItem[] — the fetched derivatives (empty while loading)
 *   - isLoading: boolean — true on first fetch (no cached data)
 *   - isFetching: boolean — true whenever a background fetch is in progress
 *   - isError: boolean — true when the fetch failed
 *   - error: Error | null — the error object (ApiError on 404/5xx)
 *   - isNotFound: boolean — true when error.status === 404 (unknown id or not_a_source)
 *   - refetch: () => void — manually trigger a refetch
 *   - hasMore: boolean — true when cursor is non-null (more pages available)
 *   - cursor: string | null — opaque next-page token from the envelope
 *
 * Cache strategy (mirrors useArtifact conventions):
 *   - staleTime: 30s — derivatives are considered fresh for 30 seconds
 *   - gcTime: 5min — cached entries kept for 5 minutes after unmount
 *   - retry: false — Portal is local-only; 404 means no derivatives or wrong id
 *
 * Query key: ["artifact", "derivatives", sourceId]
 *
 * library-source-rollup-v1 Phase 3 DETAIL-01.
 */

import { useQuery } from "@tanstack/react-query";
import { getDerivatives } from "@/lib/api/artifacts";
import { ApiError } from "@/lib/api/client";
import type { DerivativeItem } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const derivativesQueryKey = (sourceId: string) =>
  ["artifact", "derivatives", sourceId] as const;

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

export interface UseDerivativesResult {
  derivatives: DerivativeItem[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  /** ApiError on 404 (not_found / not_a_source) or 5xx; generic Error on network failure */
  error: Error | null;
  /** True when the error is a 404 — either unknown ID or not a source-type artifact */
  isNotFound: boolean;
  refetch: () => void;
  /** True when there are more pages available (cursor present in envelope) */
  hasMore: boolean;
  /** Opaque cursor token for fetching the next page; null on last page */
  cursor: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDerivatives(sourceId: string): UseDerivativesResult {
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: derivativesQueryKey(sourceId),
    queryFn: () => getDerivatives(sourceId, { limit: 50 }),
    enabled: Boolean(sourceId),
    staleTime: 30_000,   // 30 seconds
    gcTime: 5 * 60_000,  // 5 minutes
    // No retries: Portal is local-only. A 404 means the artifact doesn't exist
    // or is not a source type; a 5xx means the backend needs attention.
    retry: false,
  });

  const isNotFound =
    isError && error instanceof ApiError && error.status === 404;

  return {
    derivatives: data?.data ?? [],
    isLoading,
    isFetching,
    isError,
    error: error as Error | null,
    isNotFound,
    refetch,
    hasMore: Boolean(data?.cursor),
    cursor: data?.cursor ?? null,
  };
}
