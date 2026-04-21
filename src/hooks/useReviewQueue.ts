/**
 * useReviewQueue — TanStack Query hook for the Review Queue screen (P4-05).
 *
 * Fetches artifacts with status=stale from GET /api/artifacts. The backend
 * emits review items for Freshness and Contradiction gate types in v1; other
 * gate types (Coverage, Completeness, Relevance) are schema-present but not
 * yet emitted — this hook renders them gracefully if they appear.
 *
 * P4-05: Review Queue skeleton screen — read-only list.
 *
 * DP4-02e (ADR-DPI-008 Option C):
 *   - Added ReviewPriority type + priority field on ReviewItem.
 *   - Priority is derived client-side from metadata signals until the backend
 *     exposes a `priority` enum on the review DTO.
 *   - MISMATCH-04: Backend ArtifactCard DTO does not yet include a `priority`
 *     or `confidence_score` field. Heuristic derivation below is the v1.5
 *     stand-in. Update when backend adds these fields.
 *   - Added filter/sort state to the hook return for filter/sort controls.
 */

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { listArtifacts } from "@/lib/api/artifacts";
import type { ArtifactCard } from "@/types/artifact";
import type { SortOrder } from "@/lib/api/artifacts";

// ---------------------------------------------------------------------------
// Gate type — V1 emits freshness + contradiction; others are graceful extras
// ---------------------------------------------------------------------------

export type ReviewGateType =
  | "freshness"
  | "contradiction"
  | "coverage"
  | "completeness"
  | "relevance"
  | string; // forward-compatible with future gate types

// ---------------------------------------------------------------------------
// Priority — DP4-02e (ADR-DPI-008 Option C)
// MISMATCH-04: derived client-side until backend adds a priority field.
// ---------------------------------------------------------------------------

export type ReviewPriority = "CRITICAL" | "HIGH" | "ROUTINE";

export interface ReviewItem {
  artifact: ArtifactCard;
  /** Gate type that triggered review (from metadata.triggering_gate or derived). */
  gateType: ReviewGateType;
  /** ISO timestamp when the item entered review state. */
  reviewedAt: string | null;
  /**
   * Triage priority badge value (ADR-DPI-008 Option C, DP4-02e).
   * Derived client-side from gate type + metadata signals (MISMATCH-04).
   */
  priority: ReviewPriority;
  /**
   * Composite confidence score [0–1] shown in the metadata strip (DP4-02e).
   * Derived from lens fidelity + verification signals (MISMATCH-04).
   * Null when no lens metadata is present.
   */
  confidenceScore: number | null;
  /**
   * Most recent non-terminal workflow run for this artifact, if any.
   * Projected from artifact.active_run (DP4-02a gap fill — DP1-13 #9).
   * Stage Tracker manifest §2.10: Review Queue row secondary column.
   * Null/absent when no active run — StageTracker not rendered.
   */
  activeRun?: ArtifactCard["active_run"];
}

// ---------------------------------------------------------------------------
// Sort / filter state — exported for filter controls (DP4-02e)
// ---------------------------------------------------------------------------

export type ReviewSortField = "priority" | "updated";

export interface ReviewFilterState {
  sort: ReviewSortField;
  order: SortOrder;
  priorityFilter: ReviewPriority | "ALL";
  gateFilter: ReviewGateType | "ALL";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveGateType(artifact: ArtifactCard): ReviewGateType {
  const meta = artifact.metadata as Record<string, unknown> | null | undefined;
  if (meta && typeof (meta as Record<string, unknown>)["triggering_gate"] === "string") {
    return (meta as Record<string, unknown>)["triggering_gate"] as ReviewGateType;
  }
  if (
    artifact.metadata?.freshness === "stale" ||
    artifact.metadata?.freshness === "outdated"
  ) {
    return "freshness";
  }
  if (artifact.metadata?.verification_state === "disputed") {
    return "contradiction";
  }
  return "freshness";
}

function deriveReviewPriority(
  gateType: ReviewGateType,
  artifact: ArtifactCard,
): ReviewPriority {
  const meta = artifact.metadata as Record<string, unknown> | null | undefined;
  if (meta && typeof (meta as Record<string, unknown>)["priority"] === "string") {
    const p = (meta as Record<string, unknown>)["priority"] as string;
    if (p === "CRITICAL" || p === "HIGH" || p === "ROUTINE") return p;
  }
  if (
    gateType === "contradiction" ||
    artifact.metadata?.verification_state === "disputed"
  ) {
    return "CRITICAL";
  }
  if (artifact.metadata?.freshness === "outdated") {
    return "HIGH";
  }
  return "ROUTINE";
}

function deriveConfidenceScore(artifact: ArtifactCard): number | null {
  const meta = artifact.metadata as Record<string, unknown> | null | undefined;
  if (
    meta &&
    typeof (meta as Record<string, unknown>)["confidence_score"] === "number"
  ) {
    return (meta as Record<string, unknown>)["confidence_score"] as number;
  }
  const fidelity = artifact.metadata?.fidelity;
  const verification = artifact.metadata?.verification_state;
  if (!fidelity && !verification) return null;
  const fidelityScore: Record<string, number> = { high: 0.8, medium: 0.5, low: 0.2 };
  const fVal = fidelity ? (fidelityScore[fidelity] ?? 0.5) : 0.5;
  const verificationScore: Record<string, number> = {
    verified: 1.0,
    unverified: 0.5,
    disputed: 0.1,
  };
  const vVal = verification ? (verificationScore[verification] ?? 0.5) : 0.5;
  return Math.round(((fVal + vVal) / 2) * 100) / 100;
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
  /** Current filter/sort state for the filter controls (DP4-02e). */
  filters: ReviewFilterState;
  setSort: (field: ReviewSortField, order: SortOrder) => void;
  setPriorityFilter: (p: ReviewPriority | "ALL") => void;
  setGateFilter: (g: ReviewGateType | "ALL") => void;
}

const PRIORITY_ORDER: Record<ReviewPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  ROUTINE: 2,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReviewQueue(): UseReviewQueueResult {
  const [filters, setFilters] = useState<ReviewFilterState>({
    sort: "priority",
    order: "asc",
    priorityFilter: "ALL",
    gateFilter: "ALL",
  });

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

  const rawItems: ReviewItem[] = (data?.data ?? []).map((artifact) => {
    const gateType = deriveGateType(artifact);
    return {
      artifact,
      gateType,
      reviewedAt: artifact.updated ?? null,
      priority: deriveReviewPriority(gateType, artifact),
      confidenceScore: deriveConfidenceScore(artifact),
      activeRun: artifact.active_run ?? undefined,
    };
  });

  const filtered = rawItems
    .filter(
      (item) =>
        (filters.priorityFilter === "ALL" ||
          item.priority === filters.priorityFilter) &&
        (filters.gateFilter === "ALL" ||
          item.gateType === filters.gateFilter),
    )
    .sort((a, b) => {
      if (filters.sort === "priority") {
        const diff =
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        return filters.order === "asc" ? diff : -diff;
      }
      const aTime = a.reviewedAt ? new Date(a.reviewedAt).getTime() : 0;
      const bTime = b.reviewedAt ? new Date(b.reviewedAt).getTime() : 0;
      return filters.order === "asc" ? aTime - bTime : bTime - aTime;
    });

  const setSort = useCallback(
    (field: ReviewSortField, order: SortOrder) =>
      setFilters((prev) => ({ ...prev, sort: field, order })),
    [],
  );

  const setPriorityFilter = useCallback(
    (p: ReviewPriority | "ALL") =>
      setFilters((prev) => ({ ...prev, priorityFilter: p })),
    [],
  );

  const setGateFilter = useCallback(
    (g: ReviewGateType | "ALL") =>
      setFilters((prev) => ({ ...prev, gateFilter: g })),
    [],
  );

  return {
    items: filtered,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    filters,
    setSort,
    setPriorityFilter,
    setGateFilter,
  };
}
