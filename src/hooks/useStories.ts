"use client";

/**
 * useStories — TanStack Query hook for the story list.
 *
 * Wraps GET /api/stories via `listStories`.
 *
 * Cache strategy:
 *   - staleTime: 30s — list is considered fresh for 30 seconds
 *   - gcTime: 5min — cached entries kept 5 minutes after unmount
 *   - retry: false — local-only Portal; no transient retries in v1
 *
 * Usage:
 *   const { stories, isLoading, isError } = useStories({ status: "drafted" });
 */

import { useQuery } from "@tanstack/react-query";
import { listStories } from "@/lib/api/stories";
import type { StoriesEnvelope, StoryFilters } from "@/types/stories";

// ---------------------------------------------------------------------------
// Query key factory — filters are part of the key so each filter combo caches
// ---------------------------------------------------------------------------

export const storiesQueryKey = (filters: StoryFilters) =>
  ["stories", "list", filters] as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseStoriesResult {
  stories: StoriesEnvelope | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useStories(filters: StoryFilters = {}): UseStoriesResult {
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<
    StoriesEnvelope,
    Error
  >({
    queryKey: storiesQueryKey(filters),
    queryFn: () => listStories(filters),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: false,
  });

  return {
    stories: data,
    isLoading,
    isFetching,
    isError,
    error: error as Error | null,
    refetch,
  };
}
