"use client";

/**
 * useLineage — TanStack Query hook for GET /api/artifacts/:id/synthesis-lineage.
 *
 * Returns the full synthesis lineage tree rooted at the given artifact.
 * Traverses ``derived_from`` and ``generated_by`` edges up to ``depth`` levels
 * deep via a single recursive CTE round-trip on the backend.
 *
 * Returned data shape: SynthesisLineage (found, root, depth, raw_edge_count).
 * When ``found`` is false the artifact is not in the Postgres overlay yet —
 * the root will be null.
 *
 * Portal v1.7 Phase 3 (P3-09 / P3-10).
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchSynthesisLineage,
  type SynthesisLineage,
  type GetSynthesisLineageParams,
} from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UseLineageResult {
  data: SynthesisLineage | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch the synthesis lineage tree for ``artifactId``.
 *
 * The query is disabled when ``artifactId`` is undefined or an empty string
 * so the hook is safe to call before an artifact is selected.
 *
 * ``params`` allows callers to control traversal depth (1–10) and sibling
 * pagination. Defaults match the backend: depth=5, sibling_limit=50.
 *
 * Reusable across surfaces:
 *   - ResearchLineagePanel (ContextRail) — P3-09
 *   - WorkflowOSTab — P3-10
 */
export function useLineage(
  artifactId: string | undefined,
  params: GetSynthesisLineageParams = {},
): UseLineageResult {
  const { depth, sibling_limit, sibling_cursor } = params;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["lineage", artifactId, depth, sibling_limit, sibling_cursor],
    queryFn: () => fetchSynthesisLineage(artifactId!, params),
    enabled: Boolean(artifactId),
    staleTime: 60_000,
  });

  return {
    data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
