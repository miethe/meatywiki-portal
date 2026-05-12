/**
 * useSearch — React hook for the search surface.
 *
 * Wraps the search API call in a useState/useCallback pattern (not TanStack
 * Query) so the trigger is explicit (user submits a query) rather than
 * reactive to a query key change. This matches the "search on submit" UX
 * pattern rather than the "filter as you type" library pattern.
 *
 * State machine:
 *   idle       → user hasn't searched yet
 *   loading    → fetch in flight
 *   success    → 200 OK (results may be empty)
 *   embeddings_not_ready → 409 — banner shown, results cleared
 *   error      → other fetch error
 *
 * The hook exposes `searchMode` and `setSearchMode` so the banner's
 * "Switch to keyword search" action can flip the mode and re-run the query
 * without lifting state to the page.
 */

"use client";

import { useState, useCallback } from "react";
import {
  search,
  isEmbeddingsNotReadyError,
  type SearchMode,
  type SearchResult,
} from "@/lib/api/search";
import type { ArtifactCard } from "@/types/artifact";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type SearchStatus =
  | "idle"
  | "loading"
  | "success"
  | "embeddings_not_ready"
  | "error";

export interface UseSearchResult {
  /** Current text query */
  query: string;
  setQuery: (q: string) => void;

  /** Active search mode — controlled so the banner action can flip it */
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;

  /** Execute a search with the current query and mode */
  runSearch: (overrideMode?: SearchMode) => Promise<void>;

  /** Derived status flags */
  isIdle: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  isEmbeddingsNotReady: boolean;
  isError: boolean;

  /** Raw error message (non-embeddings errors) */
  errorMessage: string | null;

  /** Search results from the last successful fetch */
  results: ArtifactCard[];
  cursor: string | null;
  degraded: boolean;

  /** Dismiss the embeddings_not_ready banner for this session */
  dismissEmbeddingsBanner: () => void;
  /** Whether the banner has been dismissed */
  embeddingsBannerDismissed: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSearch(): UseSearchResult {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("fts");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [results, setResults] = useState<ArtifactCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [embeddingsBannerDismissed, setEmbeddingsBannerDismissed] =
    useState(false);

  const runSearch = useCallback(
    async (overrideMode?: SearchMode) => {
      const mode = overrideMode ?? searchMode;
      if (overrideMode) setSearchMode(overrideMode);

      // Clear stale error/banner state on every new query
      setErrorMessage(null);
      setEmbeddingsBannerDismissed(false);

      if (!query.trim()) return;

      setStatus("loading");
      setResults([]);
      setCursor(null);
      setDegraded(false);

      try {
        const result: SearchResult = await search({ q: query, mode });
        setResults(result.data);
        setCursor(result.cursor);
        setDegraded(result.degraded ?? false);
        setStatus("success");
      } catch (err) {
        if (isEmbeddingsNotReadyError(err)) {
          setStatus("embeddings_not_ready");
        } else {
          setErrorMessage(
            err instanceof Error ? err.message : "An unexpected error occurred.",
          );
          setStatus("error");
        }
      }
    },
    [query, searchMode],
  );

  const dismissEmbeddingsBanner = useCallback(() => {
    setEmbeddingsBannerDismissed(true);
  }, []);

  return {
    query,
    setQuery,
    searchMode,
    setSearchMode,
    runSearch,

    isIdle: status === "idle",
    isLoading: status === "loading",
    isSuccess: status === "success",
    isEmbeddingsNotReady:
      status === "embeddings_not_ready" && !embeddingsBannerDismissed,
    isError: status === "error",

    errorMessage,
    results,
    cursor,
    degraded,

    dismissEmbeddingsBanner,
    embeddingsBannerDismissed,
  };
}
