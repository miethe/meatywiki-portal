"use client";

/**
 * useFeaturedTopics — TanStack Query hook for the
 * GET /api/research/featured-topics endpoint.
 *
 * Returns a fixed-limit list of topic_note artifacts ordered by recent
 * derivative activity (activity_score = count of recently-updated derivatives
 * within the given days window).
 *
 * Portal v1.7 Phase 4 (P4-04).
 */

import { useQuery } from "@tanstack/react-query";
import { fetchFeaturedTopics } from "@/lib/api/research";
import type { FeaturedTopicItem } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UseFeaturedTopicsResult {
  topics: FeaturedTopicItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches featured topic cards from the backend.
 *
 * Composes TanStack Query's `useQuery` over `fetchFeaturedTopics`
 * from `@/lib/api/research`.
 *
 * `topics` is an array of FeaturedTopicItem sorted by activity_score
 * (descending) as returned by the backend.
 */
export function useFeaturedTopics(options?: {
  days?: number;
  limit?: number;
}): UseFeaturedTopicsResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["featured-topics", options],
    queryFn: () => fetchFeaturedTopics(options),
  });

  return {
    topics: data?.data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
  };
}
