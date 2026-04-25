"use client";

/**
 * useSynthesisNarrative — TanStack Query hook for the
 * GET /api/research/synthesis-narrative endpoint.
 *
 * Returns a singleton SynthesisNarrativeSummary with corpus-level
 * synthesis statistics: total count, coverage ratio, average source
 * count, most active topic, and most recently updated synthesis.
 *
 * Portal v1.7 Phase 4 (P4-06).
 */

import { useQuery } from "@tanstack/react-query";
import { fetchSynthesisNarrative } from "@/lib/api/research";
import type { SynthesisNarrativeSummary } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface UseSynthesisNarrativeResult {
  narrative: SynthesisNarrativeSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches corpus-level synthesis narrative statistics.
 *
 * Composes TanStack Query's `useQuery` over `fetchSynthesisNarrative`
 * from `@/lib/api/research`.
 *
 * The backend never returns 404 — an empty corpus produces a zeroed
 * summary, so `narrative` is either populated or undefined (loading/error).
 */
export function useSynthesisNarrative(): UseSynthesisNarrativeResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["synthesis-narrative"],
    queryFn: () => fetchSynthesisNarrative(),
  });

  return {
    narrative: data?.data,
    isLoading,
    isError,
    error: error as Error | null,
  };
}
