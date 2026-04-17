"use client";

/**
 * useInboxArtifacts — client-side hook for cursor-paginated inbox artifact list.
 *
 * Manages incremental load-more state for the Inbox screen (P3-03).
 * Initialised from server-fetched `initialData` (SSR page) to avoid a
 * client-side waterfall on first render.
 *
 * Data-fetching: native fetch via `listArtifacts` (no TanStack Query / SWR
 * installed; matches package.json as of 2026-04-16).
 *
 * Usage:
 *   const { artifacts, cursor, isLoading, error, loadMore, hasMore } =
 *     useInboxArtifacts({ initialData });
 */

import { useCallback, useState } from "react";
import { listArtifacts } from "@/lib/api/artifacts";
import type { ArtifactCard, ServiceModeEnvelope } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

interface UseInboxArtifactsOptions {
  /** Server-fetched first page, avoids client waterfall. */
  initialData: ServiceModeEnvelope<ArtifactCard>;
  /** Page size for subsequent load-more fetches. */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface UseInboxArtifactsResult {
  artifacts: ArtifactCard[];
  /** Opaque cursor for the next page; null means no further pages. */
  cursor: string | null | undefined;
  hasMore: boolean;
  isLoading: boolean;
  /** Non-null when the most-recent fetch failed. */
  error: string | null;
  /** Fetch and append the next page. No-op if loading or no more pages. */
  loadMore: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInboxArtifacts({
  initialData,
  limit = 50,
}: UseInboxArtifactsOptions): UseInboxArtifactsResult {
  const [artifacts, setArtifacts] = useState<ArtifactCard[]>(
    initialData.data ?? [],
  );
  const [cursor, setCursor] = useState<string | null | undefined>(
    initialData.cursor,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMore = cursor != null && cursor !== "";

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const envelope = await listArtifacts({
        workspace: "inbox",
        cursor,
        limit,
      });
      setArtifacts((prev) => [...prev, ...(envelope.data ?? [])]);
      setCursor(envelope.cursor);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load more artifacts",
      );
    } finally {
      setIsLoading(false);
    }
  }, [cursor, hasMore, isLoading, limit]);

  return { artifacts, cursor, hasMore, isLoading, error, loadMore };
}
