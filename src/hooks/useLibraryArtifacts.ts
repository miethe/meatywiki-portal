/**
 * useLibraryArtifacts — TanStack Query hook for the Library screen.
 *
 * Manages cursor-based pagination as an infinite query so that "Load more"
 * appends to the existing list (no page replacement, no scroll reset).
 *
 * Filter params are included in the query key so that any filter change
 * triggers a fresh fetch (cache miss). This is intentional — filters should
 * produce immediate results rather than showing stale data from a different
 * filter set.
 *
 * Performance note: React.useMemo on the flat artifact list keeps ArtifactCard
 * re-renders to a minimum when only new pages are appended.
 */

"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { listArtifacts } from "@/lib/api/artifacts";
import type { ArtifactSortField, SortOrder } from "@/lib/api/artifacts";
import type {
  ArtifactCard,
  ArtifactFacet,
  ArtifactStatus,
  LensFidelity,
  LensFreshness,
  LensVerificationState,
} from "@/types/artifact";

// ---------------------------------------------------------------------------
// Filter shape (public API of this hook)
// ---------------------------------------------------------------------------

export interface LibraryFilters {
  /** Multi-select type filter — empty array means "all types" */
  types: string[];
  /** Multi-select status filter — empty array means "all statuses" */
  statuses: ArtifactStatus[];
  /** Sort field */
  sort: ArtifactSortField;
  /** Sort direction */
  order: SortOrder;
  /**
   * Portal surface facet filter (taxonomy-redesign P5-02).
   * Maps to ?facet= query param. Undefined means "no facet filter" (all workspaces).
   * Filtered-view screens (P5-03/04/05) pre-set this to research/blog/projects.
   */
  facet?: ArtifactFacet;
  /**
   * Date range filter: ISO 8601 date string (YYYY-MM-DD) for lower bound.
   * Serialised as ?date_from= — backend support is reserved (MISMATCH-04).
   */
  dateFrom?: string;
  /**
   * Date range filter: ISO 8601 date string (YYYY-MM-DD) for upper bound.
   * Serialised as ?date_to= — backend support is reserved (MISMATCH-04).
   */
  dateTo?: string;
  /** Lens fidelity filter — empty array means "all fidelity levels" (P4-09) */
  lensFidelity: LensFidelity[];
  /** Lens freshness filter — empty array means "all freshness classes" (P4-09) */
  lensFreshness: LensFreshness[];
  /** Lens verification filter — empty array means "all verification states" (P4-09) */
  lensVerification: LensVerificationState[];
}

export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = {
  types: [],
  statuses: [],
  sort: "updated",
  order: "desc",
  facet: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  lensFidelity: [],
  lensFreshness: [],
  lensVerification: [],
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

interface UseLibraryArtifactsResult {
  artifacts: ArtifactCard[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isError: boolean;
  error: Error | null;
  total: number;
}

export function useLibraryArtifacts(
  filters: LibraryFilters = DEFAULT_LIBRARY_FILTERS,
): UseLibraryArtifactsResult {
  const {
    types,
    statuses,
    sort,
    order,
    facet,
    dateFrom,
    dateTo,
    lensFidelity,
    lensFreshness,
    lensVerification,
  } = filters;

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
  } = useInfiniteQuery({
    // Query key includes all filter params — any change busts cache immediately
    queryKey: [
      "artifacts",
      "library",
      { types, statuses, sort, order, facet, dateFrom, dateTo, lensFidelity, lensFreshness, lensVerification },
    ],
    queryFn: async ({ pageParam }) => {
      return listArtifacts({
        // When a facet is set, omit workspace — the backend resolves the facet
        // to a workspace/research_origin predicate (OQ-6 resolution).
        // Without a facet, fall back to workspace=library to scope the list.
        workspace: facet ? undefined : "library",
        facet,
        type: types.length > 0 ? types : undefined,
        status: statuses.length > 0 ? statuses : undefined,
        sort,
        order,
        lensFidelity: lensFidelity.length > 0 ? lensFidelity : undefined,
        lensFreshness: lensFreshness.length > 0 ? lensFreshness : undefined,
        lensVerification: lensVerification.length > 0 ? lensVerification : undefined,
        cursor: pageParam as string | null,
        limit: PAGE_SIZE,
        // dateFrom/dateTo reserved — not yet a real backend param (MISMATCH-04)
      });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.cursor ?? null,
  });

  // Flatten all pages into a single stable artifact array.
  // useMemo ensures this only recomputes when data changes.
  const artifacts = useMemo<ArtifactCard[]>(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data]);

  const total = artifacts.length;

  return {
    artifacts,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    isError,
    error: error as Error | null,
    total,
  };
}
