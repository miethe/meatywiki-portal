/**
 * useLibraryRollup — TanStack Query infinite hook for the Library source-rollup view.
 *
 * Mirrors useLibraryArtifacts shape but fetches from the source rollup endpoint
 * (GET /api/artifacts?workspace=library&view=source_rollup).
 *
 * When rollupLens="orphans", the endpoint returns derivative-type artifacts with
 * no resolvable source. derivative_count / derivatives_preview are present but
 * not meaningful (0 / []) for orphan items — documented here to avoid confusion.
 *
 * Filter params are included in the query key so any change triggers a fresh
 * fetch. The `types` filter is passed through to the URL builder but the
 * backend ignores it when view=source_rollup — see JSDoc on LibraryFilters for
 * context. No hard error is thrown; callers should document or hide the types
 * chip when rollup mode is active.
 *
 * Query key prefix: ["artifacts", "library", "rollup", ...] — intentionally
 * separate from ["artifacts", "library", ...] used by useLibraryArtifacts so
 * that lens switching does not poison the flat-list cache.
 *
 * library-source-rollup-v1 FE-01.
 */

"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { listArtifactsRollup } from "@/lib/api/artifacts";
import type { LibraryFilters } from "./useLibraryArtifacts";
import type { RollupArtifactItem } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

interface UseLibraryRollupOptions {
  /**
   * Filters to apply. Types filter is forwarded to the URL but the backend
   * ignores it when view=source_rollup. Callers should be aware of this
   * (MISMATCH-NOTE: types filter has no effect in rollup view).
   */
  filters?: LibraryFilters;
  /**
   * "orphans" activates the orphans sub-lens: derivatives with no resolvable
   * source artifact. Omit or set undefined for the default source rollup view.
   */
  rollupLens?: "orphans";
}

interface UseLibraryRollupResult {
  artifacts: RollupArtifactItem[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isError: boolean;
  error: Error | null;
  total: number;
}

export function useLibraryRollup(
  { filters, rollupLens }: UseLibraryRollupOptions = {},
): UseLibraryRollupResult {
  const {
    statuses = [],
    sort = "updated",
    order = "desc",
    facet,
    lensFidelity = [],
    lensFreshness = [],
    lensVerification = [],
    // types is part of LibraryFilters but the backend ignores it when
    // view=source_rollup. We include it only in the query key so that lens
    // switches from a flat-type view trigger a fresh rollup fetch.
    types = [],
  } = filters ?? {};

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: [
      "artifacts",
      "library",
      "rollup",
      // types included in key so switching from a flat-type lens triggers a fresh fetch;
      // the backend ignores types when view=source_rollup (see JSDoc above).
      { rollupLens, types, statuses, sort, order, facet, lensFidelity, lensFreshness, lensVerification },
    ],
    queryFn: async ({ pageParam }) => {
      return listArtifactsRollup({
        workspace: facet ? undefined : "library",
        facet,
        status: statuses.length > 0 ? statuses : undefined,
        // types intentionally omitted — backend ignores in rollup view
        sort,
        order,
        rollupLens,
        lensFidelity: lensFidelity.length > 0 ? lensFidelity : undefined,
        lensFreshness: lensFreshness.length > 0 ? lensFreshness : undefined,
        lensVerification: lensVerification.length > 0 ? lensVerification : undefined,
        cursor: pageParam as string | null,
        limit: PAGE_SIZE,
      });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.cursor ?? null,
  });

  const artifacts = useMemo<RollupArtifactItem[]>(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data]);

  const total = artifacts.length;

  return {
    artifacts,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    isError,
    error: error as Error | null,
    total,
  };
}
