"use client";

/**
 * useArtifact — TanStack Query hook for fetching a single artifact detail.
 *
 * Wraps GET /api/artifacts/:id via `getArtifact`.
 *
 * Returns:
 *   - artifact: ArtifactDetail | undefined — the fetched artifact (undefined while loading)
 *   - isLoading: boolean — true on first fetch (no cached data)
 *   - isError: boolean — true when the fetch failed
 *   - error: Error | null — the error object (ApiError on 404/5xx)
 *   - refetch: () => void — manually trigger a refetch
 *
 * Cache strategy:
 *   - staleTime: 30s — artifact detail is considered fresh for 30 seconds
 *   - gcTime: 5min — cached entries are kept for 5 minutes after unmount
 *   - retry: false — Portal is local-only; no transient network retries in v1.
 *     (404 semantics: artifact doesn't exist; 5xx: backend is down or broken)
 *
 * Usage:
 *   const { artifact, isLoading, isError, error } = useArtifact(id);
 */

import { useQuery } from "@tanstack/react-query";
import { getArtifact } from "@/lib/api/artifacts";
import { ApiError } from "@/lib/api/client";
import type { ArtifactDetail } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Query key factory (consistent with useLibraryArtifacts pattern)
// ---------------------------------------------------------------------------

export const artifactQueryKey = (id: string) => ["artifact", "detail", id] as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseArtifactResult {
  artifact: ArtifactDetail | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  /** ApiError on 404/4xx/5xx; generic Error on network failure */
  error: Error | null;
  /** True when the error is a 404 Not Found */
  isNotFound: boolean;
  refetch: () => void;
}

export function useArtifact(id: string): UseArtifactResult {
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<
    ArtifactDetail,
    Error
  >({
    queryKey: artifactQueryKey(id),
    queryFn: () => getArtifact(id),
    enabled: Boolean(id),
    staleTime: 30_000,   // 30 seconds
    gcTime: 5 * 60_000,  // 5 minutes
    // No retries: Portal is local-only. A 404 means the artifact doesn't exist;
    // a 5xx means the backend needs attention. Neither benefits from retrying.
    retry: false,
  });

  const isNotFound =
    isError && error instanceof ApiError && error.status === 404;

  return {
    artifact: data,
    isLoading,
    isFetching,
    isError,
    error: error as Error | null,
    isNotFound,
    refetch,
  };
}
