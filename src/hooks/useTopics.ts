"use client";

/**
 * useTopics — TanStack Query hook for GET /api/topics.
 *
 * Fetches the full first-page list of topic_note artifacts for use in
 * scope dropdowns and topic selectors. Not paginated — topics are expected
 * to fit within a single page for dropdown usage.
 *
 * staleTime: 60s to avoid redundant refetches across sibling components.
 * refetchOnWindowFocus: false — topic taxonomy changes infrequently.
 *
 * Portal v1.7 Phase 4 (P4-02).
 */

import { useQuery } from "@tanstack/react-query";
import { fetchTopics } from "@/lib/api/research";
import type { TopicItem } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UseTopicsResult {
  topics: TopicItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches topic_note artifacts for scope filtering.
 *
 * Wraps `fetchTopics` with TanStack Query for deduplication, caching,
 * and background revalidation. Pass `options` to filter by cursor / limit.
 *
 * @param options - Optional fetch parameters forwarded to `fetchTopics`.
 */
export function useTopics(
  options?: Parameters<typeof fetchTopics>[0],
): UseTopicsResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["topics", options],
    queryFn: () => fetchTopics(options),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    topics: data?.data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
  };
}
