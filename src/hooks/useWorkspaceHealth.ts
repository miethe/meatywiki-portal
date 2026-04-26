"use client";

/**
 * useWorkspaceHealth — TanStack Query hook for the
 * GET /api/research/workspace-health endpoint.
 *
 * Returns aggregate health statistics for the research workspace:
 * total_artifacts, by_status breakdown, freshness_distribution,
 * contradiction_count, and review_queue_depth.
 *
 * Portal v1.7 Phase 4 (P4-07).
 *
 * SC-P4-7: WorkspaceHealthGauge wired with live data.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchWorkspaceHealth } from "@/lib/api/research";
import type { WorkspaceHealthSummary } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UseWorkspaceHealthResult {
  health: WorkspaceHealthSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches aggregate workspace health statistics.
 *
 * Composes TanStack Query's `useQuery` over
 * `fetchWorkspaceHealth` from `@/lib/api/research`.
 *
 * `health` is undefined while loading or on error.
 * Call `refetch()` to retry after an error.
 */
export function useWorkspaceHealth(): UseWorkspaceHealthResult {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["workspace-health"],
    queryFn: async () => {
      const envelope = await fetchWorkspaceHealth();
      return envelope.data;
    },
  });

  return {
    health: data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
