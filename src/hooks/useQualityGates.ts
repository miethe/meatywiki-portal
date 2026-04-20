"use client";

/**
 * useQualityGates — TanStack Query hook for fetching quality gate results.
 *
 * Wraps GET /api/artifacts/:id/quality-gates.
 *
 * Returns:
 *   - gates: QualityGatesResponse | null — fetched data; null means no gates exist
 *   - isLoading: boolean — true on first fetch (no cached data)
 *   - isError: boolean — true when the fetch failed
 *   - error: Error | null — the error object (ApiError on 404/5xx)
 *
 * Cache strategy:
 *   - staleTime: 60s — quality gate results change only after a new workflow run
 *   - gcTime: 5min — cached entries kept 5 minutes after unmount
 *   - retry: false — Portal is local-only; no transient network retries in v1.
 *
 * When ``workflowRunId`` is provided it is included in the query key so that
 * callers can invalidate / refetch after a specific run completes.
 *
 * Portal v1.5 Phase 1 (P1.5-1-05).
 */

import { useQuery } from "@tanstack/react-query";
import { getQualityGates, type QualityGatesResponse } from "@/lib/api/artifacts";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const qualityGatesQueryKey = (
  artifactId: string,
  workflowRunId?: string,
) =>
  workflowRunId
    ? (["artifact", "quality-gates", artifactId, workflowRunId] as const)
    : (["artifact", "quality-gates", artifactId] as const);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseQualityGatesResult {
  /** Quality gate rule results; null when no gate data exists for the artifact */
  gates: QualityGatesResponse | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useQualityGates(
  artifactId: string,
  workflowRunId?: string,
): UseQualityGatesResult {
  const { data, isLoading, isError, error } = useQuery<
    QualityGatesResponse | null,
    Error
  >({
    queryKey: qualityGatesQueryKey(artifactId, workflowRunId),
    queryFn: () => getQualityGates(artifactId),
    enabled: Boolean(artifactId),
    staleTime: 60_000,   // 60 seconds
    gcTime: 5 * 60_000,  // 5 minutes
    retry: false,
  });

  return {
    // data is undefined while loading; null when backend returns null body.
    // Treat undefined (loading) and null (no gates) distinctly from the caller's
    // perspective — isLoading tells you which case applies.
    gates: data ?? null,
    isLoading,
    isError,
    error: error as Error | null,
  };
}
