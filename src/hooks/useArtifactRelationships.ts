"use client";

/**
 * useArtifactRelationships — fetch upstream/downstream artifact relations for
 * the "Related Artifacts" section of ActivityHistoryTooltip (P3-01).
 *
 * Calls GET /api/artifacts/{id}/relationships
 * Response: RelationshipsResponse { artifact_id, upstream: Relation[], downstream: Relation[] }
 *
 * Backend caps each array at 10 items. On its 5 s timeout the backend returns
 * empty arrays — the hook normalises this to the same empty-array shape.
 *
 * Query is only active while `enabled` is true (matching the pattern used by
 * useCompileEvents / useArtifactCompileActivity — open only while tooltip is
 * visible to avoid unnecessary network traffic).
 *
 * Cache: staleTime=60s (relationships change infrequently).
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Types (local — do NOT edit src/types/compileEvents.ts)
// ---------------------------------------------------------------------------

export interface Relation {
  artifact_id: string;
  title: string | null;
  artifact_type: string | null;
  relationship: string;
}

export interface RelationshipsResponse {
  artifact_id: string;
  upstream: Relation[];
  downstream: Relation[];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UseArtifactRelationshipsOptions {
  artifactId: string;
  /**
   * When false the query does not execute.
   * Pass `isOpen` from the tooltip's controlled state so requests are only
   * made while the popover is visible.
   */
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface UseArtifactRelationshipsResult {
  upstream: Relation[];
  downstream: Relation[];
  isLoading: boolean;
  isError: boolean;
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export function artifactRelationshipsQueryKey(artifactId: string): [string, string, string] {
  return ["artifact", artifactId, "relationships"];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useArtifactRelationships({
  artifactId,
  enabled,
}: UseArtifactRelationshipsOptions): UseArtifactRelationshipsResult {
  const { data, isLoading, isError } = useQuery<RelationshipsResponse>({
    queryKey: artifactRelationshipsQueryKey(artifactId),
    queryFn: () =>
      api.get<RelationshipsResponse>(`/api/artifacts/${artifactId}/relationships`),
    enabled: enabled && Boolean(artifactId),
    staleTime: 60_000, // 60 s — relationships don't change often
    gcTime: 5 * 60_000,
    retry: 1,
  });

  return {
    upstream: data?.upstream ?? [],
    downstream: data?.downstream ?? [],
    isLoading: enabled && isLoading,
    isError,
  };
}
