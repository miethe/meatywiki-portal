"use client";

/**
 * use-processing-history — fetch pipeline stage event history for a single artifact.
 *
 * Calls GET /api/artifacts/:id/processing-history.
 * Response shape: Service-Mode v2 envelope wrapping list[StageEventItem].
 * No cursor pagination — history is bounded per artifact.
 *
 * Graceful degradation:
 *   - 404: endpoint not yet available → empty list (no mock; this is real data)
 *   - Network error: surfaces error to caller for retry UI
 *
 * P2-02 — Processing history tab on artifact detail.
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { ServiceModeEnvelope } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type StageEventType =
  | "stage_started"
  | "stage_completed"
  | "stage_failed"
  | "stage_degraded"
  | "compile_failed";

export interface StageEventItem {
  event_id: string;
  event_type: StageEventType;
  stage_name: string | null;
  /** ISO 8601 datetime */
  created_at: string;
  duration_ms: number | null;
  output_summary: string | null;
  error_detail: string | null;
  degraded_reason: string | null;
  run_id: string;
  template_id: string | null;
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const processingHistoryQueryKey = (artifactId: string) =>
  ["artifact", "processing-history", artifactId] as const;

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

async function fetchProcessingHistory(artifactId: string): Promise<StageEventItem[]> {
  try {
    const envelope = await apiFetch<ServiceModeEnvelope<StageEventItem>>(
      `/artifacts/${encodeURIComponent(artifactId)}/processing-history`,
      { method: "GET" },
    );
    return envelope.data ?? [];
  } catch (err) {
    // Endpoint not yet present on this backend version — return empty list
    // rather than surfacing an error. Caller sees empty state, not failure.
    if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
      return [];
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseProcessingHistoryResult {
  events: StageEventItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch pipeline stage events for an artifact.
 *
 * Returns an empty list when the endpoint is absent (404/405).
 * Re-throws all other errors so the tab can show a retry UI.
 *
 * @param artifactId Artifact UUID. Pass null/undefined to disable.
 */
export function useProcessingHistory(
  artifactId: string | null | undefined,
): UseProcessingHistoryResult {
  const { data, isLoading, isError, error, refetch } = useQuery<StageEventItem[], Error>({
    queryKey: processingHistoryQueryKey(artifactId ?? ""),
    queryFn: () => fetchProcessingHistory(artifactId!),
    enabled: Boolean(artifactId),
    staleTime: 30_000,   // 30 s — processing events change during active runs
    gcTime: 5 * 60_000,
    retry: 1,
  });

  return {
    events: data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
