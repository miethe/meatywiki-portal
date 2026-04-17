"use client";

/**
 * useReviewQueue — TanStack Query hook for the Review Queue screen (P4-05).
 *
 * Fetches artifacts with status=review from GET /api/artifacts. The backend
 * emits review items for Freshness and Contradiction gate types in v1; other
 * gate types (Coverage, Completeness, Relevance) are schema-present but not
 * yet emitted — this hook renders them gracefully if they appear.
 *
 * The hook prefers fetching with status=review directly. If no dedicated
 * review endpoint exists it falls back to a client-side filter by the
 * triggering_gate field present in artifact.metadata (frontmatter_jsonb).
 *
 * P4-05: Review Queue skeleton screen — read-only list.
 */

import { useQuery } from "@tanstack/react-query";
import { listArtifacts } from "@/lib/api/artifacts";
import type { ArtifactCard } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Gate type — V1 emits freshness + contradiction only; others are graceful
// ---------------------------------------------------------------------------

export type ReviewGateType =
  | "freshness"
  | "contradiction"
  | "coverage"
  | "completeness"
  | "relevance"
  | string; // forward-compatible with future gate types

export interface ReviewItem {
  artifact: ArtifactCard;
  /** Gate type that triggered review (from metadata.triggering_gate or derived). */
  gateType: ReviewGateType;
  /** ISO timestamp when the item entered review state */
  reviewedAt: string | null;
}

// ---------------------------------------------------------------------------
// Helper — derive gate type from artifact metadata / frontmatter
// ---------------------------------------------------------------------------

function deriveGateType(artifact: ArtifactCard): ReviewGateType {
  // Prefer an explicit field on metadata (may be added by backend reconciler)
  const meta = artifact.metadata as Record<string, unknown> | null | undefined;
  if (meta && typeof (meta as Record<string, unknown>)["triggering_gate"] === "string") {
    return (meta as Record<string, unknown>)["triggering_gate"] as ReviewGateType;
  }

  // Secondary heuristic: freshness=stale|outdated → freshness gate
  if (
    artifact.metadata?.freshness === "stale" ||
    artifact.metadata?.freshness === "outdated"
  ) {
    return "freshness";
  }

  // Tertiary: verification_state=disputed → contradiction gate
  if (artifact.metadata?.verification_state === "disputed") {
    return "contradiction";
  }

  // Default for review-status items with no other signal
  return "freshness";
}

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UseReviewQueueResult {
  items: ReviewItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReviewQueue(): UseReviewQueueResult {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["artifacts", "review-queue"],
    queryFn: () =>
      listArtifacts({
        status: "stale",
        sort: "updated",
        order: "asc",
        limit: 100,
      }),
    staleTime: 30_000,
  });

  const items: ReviewItem[] = (data?.data ?? []).map((artifact) => ({
    artifact,
    gateType: deriveGateType(artifact),
    reviewedAt: artifact.updated ?? null,
  }));

  return {
    items,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
