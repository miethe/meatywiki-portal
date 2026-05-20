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
 * FE-04: Added `optimisticUpdateArtifact` — allows InboxClient to apply
 * optimistic status mutations (e.g. after compile success) without a full
 * network refetch. Caller passes a partial update that is merged into the
 * matching artifact by ID.
 *
 * Usage:
 *   const { artifacts, cursor, isLoading, error, loadMore, hasMore,
 *           optimisticUpdateArtifact } = useInboxArtifacts({ initialData });
 */

import { useCallback, useEffect, useState } from "react";
import { listArtifacts, listInboxWithProcessed } from "@/lib/api/artifacts";
import type { ArtifactCard, ServiceModeEnvelope } from "@/types/artifact";
import type { ProcessedItemDTO } from "@/types/compileEvents";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

interface UseInboxArtifactsOptions {
  /** Server-fetched first page, avoids client waterfall. */
  initialData: ServiceModeEnvelope<ArtifactCard>;
  /** Page size for subsequent load-more fetches. */
  limit?: number;
  /**
   * P3-06 inbox-live-status: when true, the hook fetches the inbox with the
   * `processed` extension array on mount and after each load-more. Defaults to false.
   */
  includeProcessed?: boolean;
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
  /**
   * FE-04: Optimistically apply a partial update to a single artifact by ID.
   * The update is merged (Object.assign semantics) into the existing item.
   * Use after compile success to reflect the new status without a full refetch.
   */
  optimisticUpdateArtifact: (id: string, patch: Partial<ArtifactCard>) => void;
  /**
   * P3-06 inbox-live-status: recently processed artifacts (past 24 h).
   * Only populated when `includeProcessed=true` is passed in options.
   */
  processedItems: ProcessedItemDTO[];
  /**
   * P3-06: manually refresh the processed section (e.g. after a terminal
   * success event so the newly processed artifact appears without a full
   * page reload).
   */
  refreshProcessed: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInboxArtifacts({
  initialData,
  limit = 50,
  includeProcessed = false,
}: UseInboxArtifactsOptions): UseInboxArtifactsResult {
  const [artifacts, setArtifacts] = useState<ArtifactCard[]>(
    initialData.data ?? [],
  );
  const [cursor, setCursor] = useState<string | null | undefined>(
    initialData.cursor,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processedItems, setProcessedItems] = useState<ProcessedItemDTO[]>([]);

  const hasMore = cursor != null && cursor !== "";

  // P3-06: fetch processed section on mount (and on demand via refreshProcessed).
  const refreshProcessed = useCallback(async () => {
    if (!includeProcessed) return;
    try {
      const envelope = await listInboxWithProcessed({ limit });
      setProcessedItems(envelope.processed ?? []);
    } catch {
      // Silently ignore — processed section is non-critical
    }
  }, [includeProcessed, limit]);

  useEffect(() => {
    void refreshProcessed();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, []); // intentionally empty — refreshProcessed is stable

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

  // FE-04: Optimistic update — merge patch into the matching artifact by ID.
  // Produces a new array so React sees the reference change and re-renders.
  const optimisticUpdateArtifact = useCallback(
    (id: string, patch: Partial<ArtifactCard>) => {
      setArtifacts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
    },
    [],
  );

  return {
    artifacts,
    cursor,
    hasMore,
    isLoading,
    error,
    loadMore,
    optimisticUpdateArtifact,
    processedItems,
    refreshProcessed,
  };
}
