"use client";

/**
 * useArtifactNeighborhood — TanStack Query hook for GET /api/portal/graph/neighborhood.
 *
 * Fetches the per-artifact knowledge graph neighborhood — nodes and edges
 * within `hops` hops of the given artifact.
 *
 * Follows the same patterns as useArtifactEdges (staleTime, enabled guard,
 * TanStack Query key structure).
 *
 * v2.1 — mini-graph component (P2 Phase 2).
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import type {
  NeighborhoodGraphData,
  NeighborhoodGraphResponse,
  GraphEdgeType,
  GraphNodeType,
} from "@/types/graph";

// ---------------------------------------------------------------------------
// Fetch options
// ---------------------------------------------------------------------------

export interface NeighborhoodFetchOptions {
  hops?: 1 | 2 | 3;
  edgeTypes?: GraphEdgeType[];
  nodeTypes?: GraphNodeType[];
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

async function fetchArtifactNeighborhood(
  artifactId: string,
  options: NeighborhoodFetchOptions = {},
): Promise<NeighborhoodGraphData> {
  const params = new URLSearchParams();
  params.set("artifact_id", artifactId);
  if (options.hops != null) {
    params.set("hops", String(options.hops));
  }
  if (options.edgeTypes?.length) {
    for (const et of options.edgeTypes) {
      params.append("edge_types[]", et);
    }
  }
  if (options.nodeTypes?.length) {
    for (const nt of options.nodeTypes) {
      params.append("node_types[]", nt);
    }
  }

  const response = await apiFetch<NeighborhoodGraphResponse>(
    `/portal/graph/neighborhood?${params.toString()}`,
    { method: "GET" },
  );
  return response;
}

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UseArtifactNeighborhoodResult {
  data: NeighborhoodGraphData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch the knowledge graph neighborhood for `artifactId`.
 *
 * Skips the query when `artifactId` is empty / undefined so the hook is
 * safe to call before an artifact is selected.
 *
 * @param artifactId - ID of the center artifact
 * @param options - Hop count, edge type filter, node type filter
 */
export function useArtifactNeighborhood(
  artifactId: string | null | undefined,
  options: NeighborhoodFetchOptions = {},
): UseArtifactNeighborhoodResult {
  const { hops = 2, edgeTypes, nodeTypes } = options;

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: [
      "artifacts",
      artifactId,
      "neighborhood",
      hops,
      edgeTypes ?? [],
      nodeTypes ?? [],
    ],
    queryFn: () =>
      fetchArtifactNeighborhood(artifactId!, { hops, edgeTypes, nodeTypes }),
    enabled: Boolean(artifactId),
    staleTime: 60_000, // neighborhood data refreshes less often than artifact detail
    gcTime: 5 * 60_000,
    retry: false,
  });

  return {
    data,
    isLoading,
    isFetching,
    isError,
    error: error as Error | null,
    refetch,
  };
}
