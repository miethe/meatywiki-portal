"use client";

/**
 * useArtifactEdges — TanStack Query hook for GET /api/artifacts/:id/edges.
 *
 * Returns incoming and outgoing edges for a given artifact. Each edge
 * carries the peer artifact's id, title (nullable if not indexed), subtype,
 * and the typed relationship between the two artifacts.
 *
 * Edge types (from backend schema):
 *   derived_from | supports | relates_to | supersedes | contradicts | contains
 *
 * P4-03: Backlinks panel — list view of artifact edges.
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Edge types
// ---------------------------------------------------------------------------

export type EdgeType =
  | "derived_from"
  | "supports"
  | "relates_to"
  | "supersedes"
  | "contradicts"
  | "contains"
  | (string & {}); // forward-compatible

/**
 * A single edge as returned by GET /api/artifacts/:id/edges.
 * `title` is null when the peer artifact is not in the Postgres overlay.
 */
export interface ArtifactEdgeItem {
  /** ID of the peer artifact (the other end of the edge). */
  artifact_id: string;
  /** Edge relationship type. */
  type: EdgeType;
  /**
   * Human-readable title of the peer artifact.
   * Null when the peer is not in the overlay (e.g. not yet reconciled).
   */
  title: string | null;
  /** Subtype of the peer artifact (e.g. "concept", "evidence"). */
  subtype: string | null;
}

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export interface ArtifactEdgesResponse {
  artifact_id: string;
  incoming: ArtifactEdgeItem[];
  outgoing: ArtifactEdgeItem[];
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

async function fetchArtifactEdges(
  artifactId: string,
): Promise<ArtifactEdgesResponse> {
  return apiFetch<ArtifactEdgesResponse>(
    `/artifacts/${encodeURIComponent(artifactId)}/edges`,
    { method: "GET" },
  );
}

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UseArtifactEdgesResult {
  data: ArtifactEdgesResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch incoming and outgoing edges for `artifactId`.
 *
 * Skips the query when `artifactId` is empty / undefined so the hook is
 * safe to call before an artifact is selected.
 */
export function useArtifactEdges(
  artifactId: string | null | undefined,
): UseArtifactEdgesResult {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["artifacts", artifactId, "edges"],
    queryFn: () => fetchArtifactEdges(artifactId!),
    enabled: Boolean(artifactId),
    staleTime: 30_000,
  });

  return {
    data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
