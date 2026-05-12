"use client";

/**
 * Search page — text query surface with FTS / semantic / hybrid mode selection.
 *
 * M-03 (audit Wave 1 / P2-02):
 *   When the backend returns 409 with error.code === "embeddings_not_ready",
 *   a non-fatal banner is shown above the (empty) results area.
 *
 * Banner behaviour:
 *   - Appears only on 409 embeddings_not_ready; does NOT appear for degraded=true
 *     200 responses (those silently fall back to FTS on the backend).
 *   - "Switch to keyword search" primary action: flips mode to FTS + re-runs query.
 *   - "Dismiss" secondary action: hides the banner for this session.
 *   - Cleared automatically on the next successful query.
 *
 * Accessibility:
 *   - Banner has role="alert" so screen readers announce it immediately.
 *   - Both banner actions are keyboard reachable in DOM order.
 *   - Mode selector uses a native <select> with an explicit <label>.
 *   - Results list uses role="list" / role="listitem".
 */

import { useCallback } from "react";
import { Search as SearchIcon, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearch } from "@/hooks/useSearch";
import type { SearchMode } from "@/lib/api/search";
import type { ArtifactCard } from "@/types/artifact";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Embeddings-not-ready banner
// ---------------------------------------------------------------------------

interface EmbeddingsBannerProps {
  onSwitchToKeyword: () => void;
  onDismiss: () => void;
}

function EmbeddingsBanner({ onSwitchToKeyword, onDismiss }: EmbeddingsBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={cn(
        "flex flex-col gap-3 rounded-md border border-yellow-300 bg-yellow-50 p-4",
        "dark:border-yellow-700 dark:bg-yellow-950/40",
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
            Semantic search is not ready yet
          </p>
          <p className="mt-0.5 text-xs text-yellow-700 dark:text-yellow-300">
            Embeddings haven&apos;t been generated for your vault. Re-run ingest with
            embeddings enabled or switch to keyword search.
          </p>
        </div>
        {/* Dismiss button */}
        <button
          type="button"
          aria-label="Dismiss embeddings warning"
          onClick={onDismiss}
          className={cn(
            "shrink-0 inline-flex size-6 items-center justify-center rounded",
            "text-yellow-600 hover:bg-yellow-100 hover:text-yellow-800 transition-colors",
            "dark:text-yellow-400 dark:hover:bg-yellow-900 dark:hover:text-yellow-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pl-7">
        <button
          type="button"
          onClick={onSwitchToKeyword}
          className={cn(
            "inline-flex min-h-[44px] items-center rounded-md border border-yellow-400 px-3 text-xs font-medium sm:h-8 sm:min-h-0",
            "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors",
            "dark:border-yellow-600 dark:bg-yellow-900/60 dark:text-yellow-200 dark:hover:bg-yellow-900",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        >
          Switch to keyword search
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode selector
// ---------------------------------------------------------------------------

interface ModeSelectorProps {
  value: SearchMode;
  onChange: (mode: SearchMode) => void;
  disabled?: boolean;
}

function ModeSelector({ value, onChange, disabled }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="search-mode"
        className="shrink-0 text-xs font-medium text-muted-foreground"
      >
        Mode
      </label>
      <select
        id="search-mode"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as SearchMode)}
        aria-label="Search mode"
        className={cn(
          "min-h-[44px] rounded-md border border-input bg-background px-2 text-xs text-foreground sm:h-8 sm:min-h-0",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <option value="fts">Keyword (FTS)</option>
        <option value="semantic">Semantic</option>
        <option value="hybrid">Hybrid</option>
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------

function ResultCard({ artifact }: { artifact: ArtifactCard }) {
  return (
    <li role="listitem">
      <Link
        href={`/artifact/${artifact.id}`}
        className={cn(
          "flex flex-col gap-1 rounded-md border bg-card p-3 transition-colors",
          "hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span className="text-sm font-medium text-foreground line-clamp-2">
          {artifact.title}
        </span>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium uppercase tracking-wide">
            {artifact.type}
          </span>
          <span>{artifact.workspace}</span>
        </div>
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SearchPage() {
  const {
    query,
    setQuery,
    searchMode,
    setSearchMode,
    runSearch,
    isLoading,
    isSuccess,
    isEmbeddingsNotReady,
    isError,
    errorMessage,
    results,
    degraded,
    dismissEmbeddingsBanner,
  } = useSearch();

  const handleSubmit = useCallback(
    (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
      void runSearch();
    },
    [runSearch],
  );

  const handleSwitchToKeyword = useCallback(() => {
    void runSearch("fts");
  }, [runSearch]);

  const handleModeChange = useCallback(
    (mode: SearchMode) => {
      setSearchMode(mode);
    },
    [setSearchMode],
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-3xl mx-auto w-full">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Search your knowledge vault.
        </p>
      </div>

      {/* Search form */}
      <form
        role="search"
        aria-label="Search vault"
        onSubmit={handleSubmit}
        className="flex flex-col gap-3"
      >
        <div className="flex gap-2">
          <label htmlFor="search-input" className="sr-only">
            Search query
          </label>
          <div className="relative flex-1">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              autoComplete="off"
              aria-label="Search query"
              className={cn(
                "w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground",
                "min-h-[44px] sm:h-9 sm:min-h-0",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "placeholder:text-muted-foreground",
              )}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            aria-label="Run search"
            className={cn(
              "inline-flex min-h-[44px] items-center rounded-md border px-4 text-sm font-medium sm:h-9 sm:min-h-0",
              "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {isLoading ? "Searching…" : "Search"}
          </button>
        </div>

        <ModeSelector
          value={searchMode}
          onChange={handleModeChange}
          disabled={isLoading}
        />
      </form>

      {/* Results area */}
      <div className="flex flex-col gap-4">
        {/* Embeddings not ready banner */}
        {isEmbeddingsNotReady && (
          <EmbeddingsBanner
            onSwitchToKeyword={handleSwitchToKeyword}
            onDismiss={dismissEmbeddingsBanner}
          />
        )}

        {/* Generic error state */}
        {isError && errorMessage && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        {/* Degraded notice (silent fallback — informational only) */}
        {isSuccess && degraded && (
          <p
            aria-live="polite"
            className="text-xs text-muted-foreground"
          >
            Semantic index unavailable — showing keyword results instead.
          </p>
        )}

        {/* Results list */}
        {isSuccess && results.length > 0 && (
          <ul
            role="list"
            aria-label="Search results"
            className="flex flex-col gap-2"
          >
            {results.map((artifact) => (
              <ResultCard key={artifact.id} artifact={artifact} />
            ))}
          </ul>
        )}

        {/* Empty state */}
        {isSuccess && results.length === 0 && (
          <p
            role="status"
            className="text-sm text-muted-foreground text-center py-8"
          >
            No results found.
          </p>
        )}
      </div>
    </div>
  );
}
