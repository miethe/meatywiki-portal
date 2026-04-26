"use client";

/**
 * useCrossEntitySynthesis — TanStack Query infinite-scroll hook for the
 * GET /api/research/cross-entity-synthesis endpoint.
 *
 * Returns cursor-paginated synthesis entries grouped by entity. Each entry
 * contains an entity card and a list of associated synthesis artifact cards.
 *
 * Portal v1.7 Phase 4 (P4-08).
 *
 * SC-P4-08: Research Home cross-entity synthesis tabs wired with live data.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchCrossEntitySynthesis } from "@/lib/api/research";
import type { CrossEntitySynthesisEntry } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UseCrossEntitySynthesisResult {
  entries: CrossEntitySynthesisEntry[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches cross-entity synthesis entries with cursor pagination.
 *
 * Composes TanStack Query's `useInfiniteQuery` over
 * `fetchCrossEntitySynthesis` from `@/lib/api/research`.
 *
 * `entries` is a flat array accumulated across all loaded pages; each entry
 * groups an entity with its associated synthesis artifacts.
 * Call `fetchNextPage()` when the user clicks "Load more".
 */
export function useCrossEntitySynthesis(): UseCrossEntitySynthesisResult {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["cross-entity-synthesis"],
    queryFn: async ({ pageParam }) => {
      return fetchCrossEntitySynthesis({
        cursor: pageParam as string | undefined,
        limit: PAGE_SIZE,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
  });

  const entries = useMemo<CrossEntitySynthesisEntry[]>(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data]);

  return {
    entries,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    isError,
    error: error as Error | null,
  };
}
