"use client";

/**
 * useArtifactHandoffs — TanStack Query hook for GET /api/artifacts/:id/handoffs.
 *
 * Returns paginated handoff edges declared from the given artifact. Each item
 * carries the target artifact's identity (id, title, artifact_type) plus edge
 * metadata (confidence, source, agent_id, agent_role) — ALL fields nullable.
 *
 * Query key: ["artifacts", id, "handoffs"]
 *
 * Bundle E / P4-02.
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import type { ServiceModeEnvelope } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Item type
// ---------------------------------------------------------------------------

/**
 * A single handoff edge as returned by GET /api/artifacts/:id/handoffs.
 *
 * Artifact identity fields (id, title, artifact_type) carry the target
 * artifact's data. Edge metadata fields (confidence, source, agent_id,
 * agent_role) are ALL nullable — the backend may omit any of them.
 */
export interface HandoffEdgeItem {
  /** ID of the target artifact. */
  id: string;
  /** Human-readable title — null when the target is not yet reconciled. */
  title: string | null;
  /** Artifact type discriminator (e.g. "concept", "entity"). */
  artifact_type: string | null;
  /** Confidence score of the handoff edge [0–1]. Nullable. */
  confidence: number | null;
  /** Source system that created the edge. Nullable. */
  source: string | null;
  /** Agent ID that declared the handoff. Nullable. */
  agent_id: string | null;
  /** Role of the declaring agent. Nullable. */
  agent_role: string | null;
}

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UseArtifactHandoffsResult {
  data: ServiceModeEnvelope<HandoffEdgeItem> | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch handoff edges for `artifactId`.
 *
 * The query is skipped when `artifactId` is empty / undefined so the hook is
 * safe to call before an artifact is selected.
 */
export function useArtifactHandoffs(
  artifactId: string | null | undefined,
): UseArtifactHandoffsResult {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["artifacts", artifactId, "handoffs"],
    queryFn: () =>
      apiFetch<ServiceModeEnvelope<HandoffEdgeItem>>(
        `/artifacts/${encodeURIComponent(artifactId!)}/handoffs`,
        { method: "GET" },
      ),
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
