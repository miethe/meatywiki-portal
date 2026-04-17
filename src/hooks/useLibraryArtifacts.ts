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
import type { ArtifactCard, ArtifactStatus } from "@/types/artifact";

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
}

export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = {
  types: [],
  statuses: [],
  sort: "updated",
  order: "desc",
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
  const { types, statuses, sort, order } = filters;

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
    queryKey: ["artifacts", "library", { types, statuses, sort, order }],
    queryFn: async ({ pageParam }) => {
      return listArtifacts({
        workspace: "library",
        type: types.length > 0 ? types : undefined,
        status: statuses.length > 0 ? statuses : undefined,
        sort,
        order,
        cursor: pageParam as string | null,
        limit: PAGE_SIZE,
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
