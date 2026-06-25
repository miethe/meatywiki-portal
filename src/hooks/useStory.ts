"use client";

/**
 * useStory — TanStack Query hook for a single story detail.
 *
 * Wraps GET /api/stories/:id via `getStory`.
 *
 * Returns:
 *   - story: StoryDetail | undefined
 *   - isLoading, isError, error, refetch, isNotFound
 *
 * Cache strategy:
 *   - staleTime: 30s
 *   - gcTime: 5min
 *   - retry: false — 404 means the story doesn't exist; 5xx needs attention
 *
 * Usage:
 *   const { story, isLoading, isNotFound } = useStory(id);
 */

import { useQuery } from "@tanstack/react-query";
import { getStory } from "@/lib/api/stories";
import { ApiError } from "@/lib/api/client";
import type { StoryDetail } from "@/types/stories";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const storyQueryKey = (id: string) => ["story", "detail", id] as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseStoryResult {
  story: StoryDetail | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  /** ApiError on 404/4xx/5xx; generic Error on network failure */
  error: Error | null;
  /** True when the error is a 404 Not Found */
  isNotFound: boolean;
  refetch: () => void;
}

export function useStory(id: string): UseStoryResult {
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<
    StoryDetail,
    Error
  >({
    queryKey: storyQueryKey(id),
    queryFn: () => getStory(id),
    enabled: Boolean(id),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: false,
  });

  const isNotFound =
    isError && error instanceof ApiError && (error as ApiError).status === 404;

  return {
    story: data,
    isLoading,
    isFetching,
    isError,
    error: error as Error | null,
    isNotFound,
    refetch,
  };
}
