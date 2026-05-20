"use client";

/**
 * GraphSearchOverlay — Cmd-K / Ctrl-K search overlay for the vault graph.
 *
 * Opens a shadcn/ui Command palette with two sections:
 *   1. Recent — last 5 nodes interacted with (sessionStorage["graph:recent"])
 *   2. Results — Fuse.js client matches (≤2K loaded nodes) or server FTS5
 *
 * Filled dot (●) = node currently in the loaded graph subgraph.
 * Ring dot (○) = server-only result not currently loaded.
 *
 * Search implementation (P4-03):
 *   - Client Fuse.js: threshold 0.3, keys title:2 > tags:1, on ≤2K nodes.
 *   - Server fallback: fires when loadedNodeCount > 2K OR fuse yields < 3 hits.
 *     Debounced 300ms to avoid hammering the API.
 *   - On selection: highlights matched nodes via onSelectResult callback
 *     (caller applies amber ring via nodeReducer + animates camera to first).
 *     Also populates `q` in FilterState and adds a chip.
 *
 * ARIA: role="dialog" aria-modal="true" aria-label="Search graph"
 *
 * Implements: FR-36; interaction spec §5; filter contract §2.16.
 * Tasks: P4-02, P4-03.
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { VaultGraphNode } from "@/types/graph";

// ---------------------------------------------------------------------------
// sessionStorage recent-nodes helper
// ---------------------------------------------------------------------------

const RECENT_KEY = "graph:recent";
const RECENT_MAX = 5;

export interface RecentNode {
  id: string;
  title: string | null;
  artifact_type: string;
}

function readRecent(): RecentNode[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    return JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? "[]") as RecentNode[];
  } catch {
    return [];
  }
}

export function recordRecentNode(node: RecentNode): void {
  if (typeof sessionStorage === "undefined") return;
  const existing = readRecent().filter((n) => n.id !== node.id);
  const next = [node, ...existing].slice(0, RECENT_MAX);
  sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

// ---------------------------------------------------------------------------
// Search result type
// ---------------------------------------------------------------------------

export interface GraphSearchResult {
  id: string;
  title: string | null;
  artifact_type: string;
  workspace: string;
  /** true = node is in the currently loaded graph */
  inGraph: boolean;
}

// ---------------------------------------------------------------------------
// FNV-1a debounce (simple)
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GraphSearchOverlayProps {
  /** Whether the overlay is open */
  open: boolean;
  /** Called to close the overlay */
  onCloseAction: () => void;
  /** Currently loaded graph nodes (for client Fuse.js search + inGraph flag) */
  loadedNodes: VaultGraphNode[];
  /**
   * Called when a result is selected.
   * Caller should: highlight amber ring, animate camera, populate FilterState.q.
   */
  onSelectResultAction: (result: GraphSearchResult) => void;
  /**
   * Called when the overlay needs a server FTS5 search.
   * Caller should fetch `GET /api/portal/graph?q=query` and pass back results.
   */
  onServerSearch?: (query: string) => Promise<GraphSearchResult[]>;
}

// ---------------------------------------------------------------------------
// Dot indicators
// ---------------------------------------------------------------------------

function FilledDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 rounded-full bg-current ${className ?? ""}`}
    />
  );
}

function RingDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 rounded-full border-2 border-current ${className ?? ""}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GraphSearchOverlay({
  open,
  onCloseAction,
  loadedNodes,
  onSelectResultAction,
  onServerSearch,
}: GraphSearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GraphSearchResult[]>([]);
  const [recent, setRecent] = useState<RecentNode[]>([]);
  const [isServerLoading, setIsServerLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Build a Set of loaded node IDs for O(1) inGraph check
  const loadedNodeIds = useMemo(
    () => new Set(loadedNodes.map((n) => n.id)),
    [loadedNodes],
  );

  // Load recent on open
  useEffect(() => {
    if (open) {
      setRecent(readRecent());
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      // Focus input after mount
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Fuse.js search (client-side, lazy import to keep bundle clean)
  const doClientSearch = useCallback(
    async (q: string): Promise<GraphSearchResult[]> => {
      if (!q) return [];
      let FuseClass: (new (list: VaultGraphNode[], opts: Record<string, unknown>) => {
        search: (q: string, opts?: { limit?: number }) => Array<{
          item: VaultGraphNode;
          score?: number;
        }>;
      }) | null = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod = await import("fuse.js" as any);
        FuseClass = mod.default ?? mod;
      } catch {
        // fuse.js not installed — fall through to empty results
        return [];
      }
      if (!FuseClass) return [];
      const fuse = new FuseClass(loadedNodes, {
        threshold: 0.3,
        keys: [
          { name: "title", weight: 2 },
          { name: "tags", weight: 1 },
        ],
        includeScore: true,
        minMatchCharLength: 2,
      });
      return fuse
        .search(q, { limit: 20 })
        .map((r) => ({
          id: r.item.id,
          title: r.item.title,
          artifact_type: r.item.artifact_type,
          workspace: r.item.workspace,
          inGraph: true,
        }));
    },
    [loadedNodes],
  );

  // Combined search effect
  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      return;
    }

    let cancelled = false;

    async function runSearch() {
      const clientResults = await doClientSearch(debouncedQuery);

      // Decide whether server fallback is needed
      const needsServer = loadedNodes.length > 2000 || clientResults.length < 3;

      if (!needsServer || !onServerSearch) {
        if (!cancelled) setResults(clientResults);
        return;
      }

      // Merge client results + server results (server fills gaps)
      setIsServerLoading(true);
      try {
        const serverResults = await onServerSearch(debouncedQuery);
        if (!cancelled) {
          // Deduplicate: prefer client result (already in graph) over server-only
          const seen = new Set(clientResults.map((r) => r.id));
          const serverOnly = serverResults
            .filter((r) => !seen.has(r.id))
            .map((r) => ({ ...r, inGraph: loadedNodeIds.has(r.id) }));
          setResults([...clientResults, ...serverOnly]);
        }
      } catch {
        if (!cancelled) setResults(clientResults);
      } finally {
        if (!cancelled) setIsServerLoading(false);
      }
    }

    runSearch();
    return () => { cancelled = true; };
  }, [debouncedQuery, doClientSearch, loadedNodes.length, loadedNodeIds, onServerSearch]);

  // Keyboard navigation within the overlay
  const allItems = useMemo((): Array<RecentNode | GraphSearchResult> => {
    if (query) return results;
    return recent;
  }, [query, results, recent]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseAction();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, allItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = allItems[activeIndex];
        if (item) selectItem(item);
      }
    },
    [allItems, activeIndex, onCloseAction], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function selectItem(item: RecentNode | GraphSearchResult) {
    const result: GraphSearchResult = {
      id: item.id,
      title: item.title,
      artifact_type: item.artifact_type,
      workspace: "workspace" in item ? item.workspace : "",
      inGraph: "inGraph" in item ? item.inGraph : loadedNodeIds.has(item.id),
    };
    recordRecentNode({
      id: result.id,
      title: result.title,
      artifact_type: result.artifact_type,
    });
    onSelectResultAction(result);
    onCloseAction();
  }

  if (!open) return null;

  const displayItems = query ? results : recent;
  const sectionLabel = query
    ? `Results${results.length > 0 ? ` (${results.length} found)` : ""}`
    : "Recent";

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search graph"
    >
      {/* Overlay backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onCloseAction}
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-xl rounded-xl border bg-popover shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <svg
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="graph-search-listbox"
            placeholder="Search graph…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {isServerLoading && (
            <svg
              aria-label="Searching…"
              className="size-3.5 animate-spin text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <kbd
            aria-label="Press Escape to close"
            className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline"
          >
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div className="max-h-[320px] overflow-y-auto">
          {displayItems.length > 0 ? (
            <>
              <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {sectionLabel}
              </p>
              <ul
                id="graph-search-listbox"
                ref={listRef}
                role="listbox"
                aria-label={sectionLabel}
                className="pb-2"
              >
                {displayItems.map((item, idx) => {
                  const inGraph = "inGraph" in item ? item.inGraph : loadedNodeIds.has(item.id);
                  const isActive = idx === activeIndex;
                  return (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => selectItem(item)}
                      className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm transition-colors ${
                        isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
                      }`}
                    >
                      <span
                        className={inGraph ? "text-primary" : "text-muted-foreground/50"}
                        title={inGraph ? "In current graph" : "Server result — not currently loaded"}
                      >
                        {inGraph ? <FilledDot /> : <RingDot />}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {item.title ?? item.id}
                      </span>
                      <span className="shrink-0 capitalize text-xs text-muted-foreground">
                        {item.artifact_type.replace(/_/g, " ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : query && !isServerLoading ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <span>No results for &ldquo;{query}&rdquo;</span>
              <a
                href={`/search?q=${encodeURIComponent(query)}`}
                className="text-xs text-primary underline underline-offset-2 hover:no-underline"
              >
                Search full vault →
              </a>
            </div>
          ) : !query ? (
            <div className="py-8 text-center text-xs text-muted-foreground/60">
              Type to search nodes in this graph
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
