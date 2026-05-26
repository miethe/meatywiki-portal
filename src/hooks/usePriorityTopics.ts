"use client";

/**
 * usePriorityTopics — TanStack Query hook for the
 * GET /api/research/priority-topics endpoint.
 *
 * Returns up to 20 topic_note artifacts ranked by composite priority score,
 * each enriched with derivative_count, stale_count, and contradiction_count.
 *
 * Portal v1.7 Phase 4 (P4-03).
 *
 * SC-P4-3: PriorityTopicsGrid populated with live data.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchPriorityTopics } from "@/lib/api/research";
import type { PriorityTopicItem } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UsePriorityTopicsResult {
  topics: PriorityTopicItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches priority topics from GET /api/research/priority-topics.
 *
 * Accepts an optional `topic_id` filter to scope results to a single topic.
 * The endpoint has a fixed limit of 20; no cursor pagination is supported.
 *
 * Returns a flat `topics` array alongside standard TanStack Query state flags.
 */
export function usePriorityTopics(options?: {
  topic_id?: string;
}): UsePriorityTopicsResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["priority-topics", options],
    queryFn: () => fetchPriorityTopics(options),
  });

  return {
    topics: data?.data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
  };
}
