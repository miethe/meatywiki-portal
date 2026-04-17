"use client";

/**
 * useContradictionCount — derives the number of contradiction edges for an artifact.
 *
 * Composes useArtifactEdges (P4-03) to count all incoming + outgoing edges
 * whose type === "contradicts". Returns 0 when edges are loading or unavailable.
 *
 * This hook is intentionally thin — the heavy lifting (query, cache) lives in
 * useArtifactEdges. This hook just applies a filter + count.
 *
 * Phase: P4-04.
 * SC-P4-5: graceful degradation — never throws; returns 0 on error/missing.
 */

import { useArtifactEdges } from "./useArtifactEdges";

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UseContradictionCountResult {
  /** Number of contradiction edges (incoming + outgoing combined). 0 while loading. */
  count: number;
  /** True while the edges request is in flight for the first time. */
  isLoading: boolean;
  /** True when the edges request failed. count will be 0. */
  isError: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the count of `contradicts` edges (in + out) for `artifactId`.
 *
 * Safe to call with null/undefined — returns count=0, isLoading=false in that case.
 */
export function useContradictionCount(
  artifactId: string | null | undefined,
): UseContradictionCountResult {
  const { data, isLoading, isError } = useArtifactEdges(artifactId);

  if (!data) {
    return { count: 0, isLoading, isError };
  }

  const contradictEdges = [
    ...data.incoming.filter((e) => e.type === "contradicts"),
    ...data.outgoing.filter((e) => e.type === "contradicts"),
  ];

  return {
    count: contradictEdges.length,
    isLoading,
    isError,
  };
}
