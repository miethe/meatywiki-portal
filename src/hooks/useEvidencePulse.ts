"use client";

/**
 * useEvidencePulse — TanStack Query hooks for the evidence-pulse endpoints.
 *
 * Two hooks:
 *   useEvidencePulseNew      — GET /api/research/evidence-pulse/new
 *   useEvidencePulseContradictions — GET /api/research/evidence-pulse/contradictions
 *
 * Both auto-refresh every 60 seconds via refetchInterval.
 *
 * Portal v1.7 Phase 4 (P4-05).
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchEvidencePulseNew,
  fetchEvidencePulseContradictions,
} from "@/lib/api/research";
import type {
  EvidencePulseNewItem,
  EvidenceContradictionPair,
} from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFETCH_INTERVAL_MS = 60_000;

// ---------------------------------------------------------------------------
// useEvidencePulseNew
// ---------------------------------------------------------------------------

export interface UseEvidencePulseNewOptions {
  days?: number;
  limit?: number;
  topic_id?: string;
}

export interface UseEvidencePulseNewResult {
  items: EvidencePulseNewItem[];
  /** Total count of new evidence items in the corpus window. */
  total_count: number;
  /** Number of new evidence items in the last 7 days. */
  last_7_days: number;
  /** Number of new evidence items in the prior 7-day window. */
  prior_7_days: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Fetches recently ingested evidence artifacts.
 *
 * Wraps GET /api/research/evidence-pulse/new with a 60-second auto-refresh.
 * `items` is the flat list of evidence artifact cards.
 * `total_count`, `last_7_days`, and `prior_7_days` are derived from the
 * envelope's aggregate fields (defaulting to 0 until the backend ships them).
 */
export function useEvidencePulseNew(
  options?: UseEvidencePulseNewOptions,
): UseEvidencePulseNewResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["evidence-pulse-new", options] as const,
    queryFn: () => fetchEvidencePulseNew(options),
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  const items: EvidencePulseNewItem[] = data?.data ?? [];

  // The envelope exposes aggregate fields when the backend ships them.
  // Cast to access optional fields safely; default to 0 until present.
  const envelope = data as
    | (typeof data & {
        total_count?: number;
        last_7_days?: number;
        prior_7_days?: number;
      })
    | undefined;

  return {
    items,
    total_count: envelope?.total_count ?? items.length,
    last_7_days: envelope?.last_7_days ?? 0,
    prior_7_days: envelope?.prior_7_days ?? 0,
    isLoading,
    isError,
    error: error as Error | null,
  };
}

// ---------------------------------------------------------------------------
// useEvidencePulseContradictions
// ---------------------------------------------------------------------------

export interface UseEvidencePulseContradictionsOptions {
  limit?: number;
}

export interface UseEvidencePulseContradictionsResult {
  items: EvidenceContradictionPair[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Fetches contradiction pairs with aggregate trend data.
 *
 * Wraps GET /api/research/evidence-pulse/contradictions with a 60-second
 * auto-refresh. `items` is the flat list of contradiction pairs from the
 * first (and typically only) page of data.
 */
export function useEvidencePulseContradictions(
  options?: UseEvidencePulseContradictionsOptions,
): UseEvidencePulseContradictionsResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["evidence-pulse-contradictions", options] as const,
    queryFn: () => fetchEvidencePulseContradictions(options),
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  // The API returns data[0].contradictions; default to [] before first fetch.
  const items: EvidenceContradictionPair[] =
    data?.data?.[0]?.contradictions ?? [];

  return {
    items,
    isLoading,
    isError,
    error: error as Error | null,
  };
}
