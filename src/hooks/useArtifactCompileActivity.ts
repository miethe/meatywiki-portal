"use client";

/**
 * useArtifactCompileActivity — fetch workflow stage event history for Library
 * card status badge and activity tooltip (P4-01 / P4-02).
 *
 * Calls GET /api/artifacts/{id}/activity?limit=10
 * Response: ActivityResponse { items: WorkflowStageEventDTO[], next_cursor }
 *
 * OQ-4 resolution (P4-01): `latestCompile` exposes only the most recent event
 * where `workflow === "compile"`. This is the only workflow type in v1.
 * Broadening to all-workflow display is deferred (see context.md OQ-4 row).
 *
 * Cache: TanStack Query, staleTime=30s. Manual invalidation via
 * `invalidateActivityCache(queryClient, artifactId)` in InboxClient on
 * terminal-success so Library badges update within ~5 s (P4-04).
 *
 * Named distinctly from `useArtifactActivity` (which powers the ContextRail
 * activity timeline — a different shape/endpoint from the compile events list).
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchArtifactActivity,
  artifactActivityQueryKey,
} from "@/lib/api/artifacts";
import type { WorkflowStageEventDTO } from "@/types/compileEvents";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UseArtifactCompileActivityOptions {
  artifactId: string;
  /**
   * How many events to fetch per call.
   * Default 10 is sufficient for badge (needs 1) + tooltip timeline (needs ~10).
   */
  limit?: number;
  /**
   * When false the query does not execute.
   * Useful for lazy tooltip content loading (P4-02 / P4-04 Option A).
   */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface UseArtifactCompileActivityResult {
  /** All activity items (DESC by created_at). Empty while loading. */
  items: WorkflowStageEventDTO[];
  /**
   * Most recent compile-workflow event. Null when no compile history or loading.
   * OQ-4: filtered to `workflow === "compile"` only.
   */
  latestCompile: WorkflowStageEventDTO | null;
  /** Pagination cursor. null = no more pages. */
  nextCursor: string | null;
  isLoading: boolean;
  isError: boolean;
  /** Null when not in error state. */
  error: Error | null;
  /** Manually refetch (e.g. to reflect a just-completed compile). */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useArtifactCompileActivity({
  artifactId,
  limit = 10,
  enabled = true,
}: UseArtifactCompileActivityOptions): UseArtifactCompileActivityResult {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: artifactActivityQueryKey(artifactId),
    queryFn: () => fetchArtifactActivity(artifactId, { limit }),
    enabled: enabled && Boolean(artifactId),
    staleTime: 30_000, // 30 s — badge tolerates 30 s stale data between interactions
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const items: WorkflowStageEventDTO[] = data?.items ?? [];
  const nextCursor = data?.next_cursor ?? null;

  // OQ-4 resolution: filter to compile workflow only.
  const compileItems = items.filter((e) => e.workflow === "compile");
  const latestCompile = compileItems.length > 0 ? compileItems[0] : null;

  return {
    items: compileItems, // expose compile items only for badge/tooltip consumers
    latestCompile,
    nextCursor,
    isLoading,
    isError,
    error: isError && error instanceof Error ? error : null,
    refetch,
  };
}
