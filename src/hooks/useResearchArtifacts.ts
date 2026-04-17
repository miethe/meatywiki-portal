/**
 * useResearchArtifacts — TanStack Query hook for the Research Pages screen.
 *
 * Mirrors useLibraryArtifacts but targets workspace=research. The backend
 * supports ?workspace=research via the same GET /api/artifacts endpoint.
 *
 * P4-01: Research workspace structure + navigation.
 */

"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { listArtifacts } from "@/lib/api/artifacts";
import type { ArtifactCard, ArtifactStatus } from "@/types/artifact";
import type { ArtifactSortField, SortOrder } from "@/lib/api/artifacts";

// Re-export LibraryFilters so the Research Pages screen can share the same
// filter shape without duplicating the type.
export type { LibraryFilters } from "@/hooks/useLibraryArtifacts";
export { DEFAULT_LIBRARY_FILTERS } from "@/hooks/useLibraryArtifacts";

const PAGE_SIZE = 50;

export interface UseResearchArtifactsResult {
  artifacts: ArtifactCard[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isError: boolean;
  error: Error | null;
  total: number;
}

export interface ResearchFilters {
  types: string[];
  statuses: ArtifactStatus[];
  sort: ArtifactSortField;
  order: SortOrder;
}

export const DEFAULT_RESEARCH_FILTERS: ResearchFilters = {
  types: [],
  statuses: [],
  sort: "updated",
  order: "desc",
};

export function useResearchArtifacts(
  filters: ResearchFilters = DEFAULT_RESEARCH_FILTERS,
): UseResearchArtifactsResult {
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
    queryKey: ["artifacts", "research", { types, statuses, sort, order }],
    queryFn: async ({ pageParam }) => {
      return listArtifacts({
        workspace: "research",
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
