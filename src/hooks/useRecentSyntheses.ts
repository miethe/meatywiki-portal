"use client";

/**
 * useRecentSyntheses — TanStack Query hook for the
 * GET /api/research/recent-syntheses endpoint.
 *
 * Returns a flat list of recently-updated synthesis artifacts, ordered by
 * updated_at DESC. Optionally filtered by topic_id.
 *
 * Portal v1.7 Phase 4 (P4-09).
 */

import { useQuery } from "@tanstack/react-query";
import { fetchRecentSyntheses } from "@/lib/api/research";
import type { RecentSynthesisItem } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UseRecentSynthesesResult {
  syntheses: RecentSynthesisItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export interface UseRecentSynthesesOptions {
  limit?: number;
  topic_id?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches recently-updated synthesis artifacts.
 *
 * Composes TanStack Query's `useQuery` over `fetchRecentSyntheses` from
 * `@/lib/api/research`. Returns a flat array — not paginated.
 *
 * Query key: ["recent-syntheses", options]
 */
export function useRecentSyntheses(
  options: UseRecentSynthesesOptions = {},
): UseRecentSynthesesResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["recent-syntheses", options],
    queryFn: () => fetchRecentSyntheses(options),
  });

  return {
    syntheses: data?.data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
  };
}
