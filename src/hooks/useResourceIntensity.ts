"use client";

/**
 * useResourceIntensity — TanStack Query hook for the Resource Intensity widget.
 *
 * Wraps GET /api/workflows/resource-intensity via `getResourceIntensity`.
 *
 * Returns:
 *   - data: ResourceIntensityDTO | undefined — the metric payload
 *   - percentile: number | null — shorthand for data.percentile_vs_baseline
 *   - isLoading: boolean — true on first fetch (no cached data)
 *   - isError: boolean — true when the fetch failed
 *   - error: Error | null — the error object
 *
 * Cache / refresh strategy:
 *   - staleTime: 5 min  — telemetry is low-frequency; avoid hammering the backend
 *   - gcTime: 10 min    — keep the last reading in cache across brief unmounts
 *   - refetchInterval: 5 min (configurable via options.refetchInterval)
 *   - retry: false      — local-only Portal; transient retries add no value
 *
 * Usage:
 *   const { percentile, isLoading, isError } = useResourceIntensity();
 */

import { useQuery } from "@tanstack/react-query";
import { getResourceIntensity } from "@/lib/api/workflows";
import type { ResourceIntensityDTO } from "@/lib/api/workflows";

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------

export const resourceIntensityQueryKey = ["workflows", "resource-intensity"] as const;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UseResourceIntensityOptions {
  /**
   * How often (in ms) TanStack Query should automatically re-fetch.
   * Defaults to 300_000 (5 minutes).
   */
  refetchInterval?: number;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface UseResourceIntensityResult {
  data: ResourceIntensityDTO | undefined;
  /** Shorthand for data.percentile_vs_baseline — null when baseline unavailable */
  percentile: number | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const DEFAULT_REFETCH_INTERVAL = 300_000; // 5 minutes

export function useResourceIntensity(
  options: UseResourceIntensityOptions = {},
): UseResourceIntensityResult {
  const { refetchInterval = DEFAULT_REFETCH_INTERVAL } = options;

  const { data, isLoading, isFetching, isError, error, refetch } =
    useQuery<ResourceIntensityDTO, Error>({
      queryKey: resourceIntensityQueryKey,
      queryFn: getResourceIntensity,
      staleTime: 5 * 60_000,   // 5 minutes
      gcTime: 10 * 60_000,     // 10 minutes
      refetchInterval,
      retry: false,
    });

  return {
    data,
    percentile: data?.percentile_vs_baseline ?? null,
    isLoading,
    isFetching,
    isError,
    error: error as Error | null,
    refetch,
  };
}
