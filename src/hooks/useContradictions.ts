"use client";

/**
 * useContradictions — TanStack Query infinite-scroll hook for the
 * GET /api/artifacts/research/contradictions endpoint.
 *
 * Returns cursor-paginated contradiction pairs. Each pair contains two
 * artifact stubs (artifact_a, artifact_b), a shared_topic tag, and a
 * flagged_at timestamp.
 *
 * Portal v1.6 Phase 7 (P7-02).
 *
 * SC-P7-1: Research workspace "Contradictions" panel visible and functional.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getContradictions } from "@/lib/api/research";
import type { ContradictionPair } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UseContradictionsResult {
  pairs: ContradictionPair[];
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
 * Fetches contradiction pairs with cursor pagination.
 *
 * Composes TanStack Query's `useInfiniteQuery` over
 * `getContradictions` from `@/lib/api/research`.
 *
 * `pairs` is a flat array accumulated across all loaded pages.
 * Call `fetchNextPage()` when the user scrolls/clicks "Load more".
 */
export function useContradictions(): UseContradictionsResult {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["research", "contradictions"],
    queryFn: async ({ pageParam }) => {
      return getContradictions({
        cursor: pageParam as string | null,
        limit: PAGE_SIZE,
      });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.cursor ?? null,
  });

  const pairs = useMemo<ContradictionPair[]>(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data]);

  return {
    pairs,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    isError,
    error: error as Error | null,
  };
}
