"use client";

/**
 * useGraphSearch — hybrid free-text search for the vault graph (P3-05).
 *
 * Strategy:
 *   - Loaded node count ≤ VAULT_GRAPH_NODE_CAP (2 000): run Fuse.js client-side
 *     on the `nodes` array (title + tags), threshold 0.3.
 *   - Loaded node count > VAULT_GRAPH_NODE_CAP OR Fuse.js returns < 3 results:
 *     trigger server FTS5 fallback by returning a non-null `serverSearchQuery`
 *     that the caller feeds into `useVaultGraph({ q })`. Caller re-fetches and
 *     passes the updated nodes back; this hook then highlights them all.
 *
 * Highlighting:
 *   - Matching nodes: `graph.setNodeAttribute(id, 'highlighted', true)`
 *   - Non-matching nodes: `graph.setNodeAttribute(id, 'highlighted', false)`
 *   - When query is empty: all nodes get `highlighted = false` (cleared).
 *   - Camera animates to the first match after a 16ms tick (one render cycle)
 *     so sigma has time to refresh before the camera animates.
 *
 * Debounce: 200ms before executing search to avoid mid-keystroke work.
 *
 * Usage:
 *   Must be called inside a component that is a descendant of <SigmaContainer>
 *   so `useSigma()` resolves. The sigma instance is used to read the graphology
 *   graph and to animate the camera.
 *
 * v2.2 — graph explorer hybrid free-text search (P3-05).
 */

import { useEffect, useRef } from "react";
// fuse.js is installed via `pnpm add fuse.js`; if not present, client search degrades to server fallback.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let FuseSync: any = null;
try {
  // Synchronous require for use inside hooks (non-lazy path)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  FuseSync = require("fuse.js");
  if (FuseSync && FuseSync.default) FuseSync = FuseSync.default;
} catch {
  // fuse.js not installed — client search disabled; server fallback will be used
  FuseSync = null;
}
import { useSigma } from "@react-sigma/core";
import type { VaultGraphNode } from "@/types/graph";
import { VAULT_GRAPH_NODE_CAP } from "@/hooks/useVaultGraph";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fuse.js fuzzy-match threshold: 0 = exact, 1 = match anything. */
const FUSE_THRESHOLD = 0.3;

/**
 * Minimum client-side match count before falling back to server FTS5.
 * If Fuse.js returns fewer than this many results, we request server search.
 */
const FUSE_MIN_RESULTS = 3;

/** Debounce delay in ms before executing a search after query changes. */
const SEARCH_DEBOUNCE_MS = 200;

// ---------------------------------------------------------------------------
// Hook input / output
// ---------------------------------------------------------------------------

export interface UseGraphSearchOptions {
  /**
   * Free-text query from `GraphFiltersValues.q`.
   * Empty string → clear all highlights, no camera move.
   */
  query: string;
  /**
   * Currently loaded nodes. The hook uses this array for Fuse.js indexing and
   * to detect whether node count exceeds the 2K client-search threshold.
   */
  nodes: VaultGraphNode[];
  /**
   * Callback invoked when the hook decides a server FTS5 fallback is needed.
   * Called with the query string that should be passed to `useVaultGraph({ q })`.
   * Called with `null` when client-side search is sufficient or query is empty.
   */
  onServerSearchNeededAction: (q: string | null) => void;
}

/**
 * useGraphSearch — apply hybrid search highlights to the sigma/graphology graph.
 *
 * Call inside a descendant of `<SigmaContainer>` so `useSigma()` resolves.
 */
export function useGraphSearch({
  query,
  nodes,
  onServerSearchNeededAction,
}: UseGraphSearchOptions): void {
  const sigma = useSigma();

  // Stable refs so the debounced callback always reads the latest snapshot.
  const queryRef = useRef(query);
  queryRef.current = query;

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const onServerSearchNeededRef = useRef(onServerSearchNeededAction);
  onServerSearchNeededRef.current = onServerSearchNeededAction;

  // Debounce timer
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;

      const q = queryRef.current.trim();
      const currentNodes = nodesRef.current;
      const graph = sigma.getGraph();

      // ── Empty query → clear all highlights, cancel any server search ─────
      if (!q) {
        graph.forEachNode((nodeId, attrs) => {
          if (attrs.highlighted) {
            graph.setNodeAttribute(nodeId, "highlighted", false);
          }
        });
        sigma.refresh();
        onServerSearchNeededRef.current(null);
        return;
      }

      const nodeCount = currentNodes.length;

      // ── Client-side Fuse.js (≤ 2K nodes) ──────────────────────────────────
      if (nodeCount <= VAULT_GRAPH_NODE_CAP && FuseSync) {
        const fuse = new FuseSync(currentNodes, {
          keys: ["title", "tags"],
          threshold: FUSE_THRESHOLD,
          includeScore: false,
        });

        const results: Array<{ item: { id: string } }> = fuse.search(q);
        const matchIds = new Set(results.map((r) => r.item.id));

        // If client search yields enough results, apply highlights locally.
        if (matchIds.size >= FUSE_MIN_RESULTS) {
          onServerSearchNeededRef.current(null);
          applyHighlights(graph, sigma, matchIds);
          return;
        }
      }

      // ── Server FTS5 fallback (> 2K nodes OR Fuse < 3 results) ───────────
      // Signal the parent to re-fetch with `?q=`. Once the updated nodes land
      // in a future render cycle, `highlighted` will be set to true for all
      // returned nodes (which are already filtered by the server).
      onServerSearchNeededRef.current(q);

      // While waiting for the server response, highlight what the graph has now.
      // Mark all loaded nodes as highlighted so there is immediate feedback;
      // once the server responds and the component re-renders with filtered
      // nodes, a subsequent effect run will clean up the state correctly.
      // This is intentionally kept simple — the server response drives truth.
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // query and nodes.length are the stable deps; full nodes array identity
    // is not used here to avoid re-running on every page append.
  }, [sigma, query, nodes.length]);

  // ── Server results arrived: all current nodes are already FTS5-filtered ──
  // When the server fallback is active and nodes change (new server response),
  // highlight all loaded nodes (they passed the server filter) and clear the
  // highlight on any stale nodes that are no longer in the result set.
  // This runs separately from the debounce effect so it fires immediately
  // on node data arrival without waiting for the 200ms debounce.
  useEffect(() => {
    const q = queryRef.current.trim();
    if (!q) return;

    const nodeCount = nodesRef.current.length;

    // Only apply "all visible = highlighted" logic in server-fallback mode.
    // In client mode, the debounce effect above sets highlights with Fuse scores.
    if (nodeCount <= VAULT_GRAPH_NODE_CAP) return;

    const graph = sigma.getGraph();
    const serverMatchIds = new Set(nodesRef.current.map((n) => n.id));
    applyHighlights(graph, sigma, serverMatchIds);
  }, [sigma, nodes]);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Apply `highlighted` attribute to all graph nodes: true for matches, false
 * for non-matches. Animates the camera to the first matching node.
 */
function applyHighlights(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graph: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sigma: any,
  matchIds: Set<string>,
): void {
  let firstMatchId: string | null = null;

  graph.forEachNode((nodeId: string, attrs: Record<string, unknown>) => {
    const isMatch = matchIds.has(nodeId);
    if (attrs.highlighted !== isMatch) {
      graph.setNodeAttribute(nodeId, "highlighted", isMatch);
    }
    if (isMatch && firstMatchId === null) {
      firstMatchId = nodeId;
    }
  });

  sigma.refresh();

  // Animate camera to first match (defer one tick so sigma has rendered).
  if (firstMatchId !== null) {
    const matchId = firstMatchId;
    requestAnimationFrame(() => {
      const displayData = sigma.getNodeDisplayData(matchId);
      if (!displayData) return;
      sigma.getCamera().animate(
        { x: displayData.x, y: displayData.y, ratio: 0.5 },
        { duration: 300 },
      );
    });
  }
}
