/**
 * focusModes.ts — Focus-mode BFS traversal for the vault graph.
 *
 * Adapted from codebase-map/utils/focusModes.ts for MeatyWiki graphology
 * graph instances. Key adaptations:
 *
 *  - Operates directly on a graphology `AbstractGraph` (via the
 *    `GraphologyLike` structural interface) rather than a raw edge array.
 *    Graphology provides `forEachEdge`, `forEachNode`, `setNodeAttribute`,
 *    and `setEdgeAttribute` — no intermediate edge-array construction needed.
 *
 *  - Upstream edge types are domain-specific for MeatyWiki provenance:
 *      • `derived_from`   — artifact was compiled/derived from another
 *      • `references`     — artifact explicitly cites another
 *      • `generated_by`   — artifact was machine-generated from another
 *    All other edge types are treated as lateral/non-directional for the
 *    purpose of directional traversal.
 *
 *  - `graphology` represents directed edges as source → target. For the
 *    upstream mode we want to follow edges _backwards_ (find what the focal
 *    node was derived FROM), so we traverse edges where `target === current`
 *    and expand `source`. For downstream we go the other way.
 *
 *  - Hidden-state management: instead of returning a Set<string> and leaving
 *    attribute mutation to the caller, `activateFocusMode` and `clearFocusMode`
 *    mutate graphology node/edge `hidden` attributes in place. The host is
 *    responsible for calling `sigma.refresh()` after either function returns.
 *
 * Implements: FR-35; ADR lift table row 10.
 * P2-05 task.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The five supported focus modes. */
export type FocusMode = "off" | "flow" | "upstream" | "downstream" | "k-hop";

/** Options for focus-mode activation. */
export interface FocusModeOptions {
  /**
   * Hop depth for `k-hop` mode. Clamped to [1, 5].
   * Default: 2.
   */
  k?: number;
}

/**
 * Minimal graphology-compatible interface required by this module.
 *
 * Using a structural interface rather than importing graphology directly keeps
 * this module testable without a real graphology instance and avoids a hard
 * peer-dependency version pin.
 */
export interface GraphologyLike {
  /**
   * Iterate over all node IDs.
   * Matches graphology's `forEachNode(callback)` signature — callback receives
   * `(nodeId: string, attributes: Record<string, unknown>)`.
   */
  forEachNode(callback: (nodeId: string, attrs: Record<string, unknown>) => void): void;

  /**
   * Iterate over all edges.
   * Matches graphology's `forEachEdge(callback)` — callback receives:
   *   `(edgeId, attrs, source, target, sourceAttrs, targetAttrs, undirected)`
   */
  forEachEdge(
    callback: (
      edgeId: string,
      attrs: Record<string, unknown>,
      source: string,
      target: string,
    ) => void,
  ): void;

  /** Set a single attribute on a node. */
  setNodeAttribute(nodeId: string, attribute: string, value: unknown): void;

  /** Set a single attribute on an edge. */
  setEdgeAttribute(edgeId: string, attribute: string, value: unknown): void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Edge types that encode upstream (provenance) direction in MeatyWiki.
 *
 * An edge `A → B` of type `derived_from` means "A was derived from B".
 * Following upstream from A means traversing to B (expanding the `target`).
 */
export const UPSTREAM_EDGE_TYPES = new Set<string>([
  "derived_from",
  "references",
  "generated_by",
]);

const MIN_K = 1;
const MAX_K = 5;
const DEFAULT_K = 2;

// ---------------------------------------------------------------------------
// Internal BFS helpers
// ---------------------------------------------------------------------------

/**
 * Build adjacency maps that respect upstream semantics.
 *
 * For upstream-type edges (`derived_from`, `references`, `generated_by`):
 *   - outgoing (downstream) direction: source → target
 *     "A derived_from B" → following downstream from A reaches B
 *   - incoming (upstream) direction: target → source
 *     "A derived_from B" → following upstream from A reaches B
 *     (i.e., B is the provenance of A, so following A's upstream lineage
 *      means going to B — which is the edge's target in graphology)
 *
 * Note: `upstream` in the user-visible sense ("who/what is this derived
 * from?") corresponds to traversing edge.target when the current node is
 * edge.source. The adjacency maps below use the names `upstreamMap` and
 * `downstreamMap` from the perspective of the focal node:
 *   upstreamMap[node]   → nodes that are upstream of `node` (i.e., provenance)
 *   downstreamMap[node] → nodes downstream of `node` (i.e., consumers)
 */
function buildUpstreamAdjacency(graph: GraphologyLike): {
  upstreamMap: Map<string, string[]>;
  downstreamMap: Map<string, string[]>;
  allNeighborsMap: Map<string, string[]>;
} {
  const upstreamMap = new Map<string, string[]>();
  const downstreamMap = new Map<string, string[]>();
  const allNeighborsMap = new Map<string, string[]>();

  const ensureKey = (map: Map<string, string[]>, key: string) => {
    if (!map.has(key)) map.set(key, []);
  };

  graph.forEachEdge((_edgeId, attrs, source, target) => {
    const edgeType = typeof attrs["edge_type"] === "string" ? attrs["edge_type"] : "";
    if (!UPSTREAM_EDGE_TYPES.has(edgeType)) return;

    // source → target means source was derived_from/references/generated_by target
    // upstream of `source` is `target` (where it came from)
    ensureKey(upstreamMap, source);
    upstreamMap.get(source)!.push(target);

    // downstream of `target` is `source` (what was derived from it)
    ensureKey(downstreamMap, target);
    downstreamMap.get(target)!.push(source);

    // undirected neighbors (for flow and k-hop)
    ensureKey(allNeighborsMap, source);
    ensureKey(allNeighborsMap, target);
    allNeighborsMap.get(source)!.push(target);
    allNeighborsMap.get(target)!.push(source);
  });

  return { upstreamMap, downstreamMap, allNeighborsMap };
}

/**
 * BFS from `startId` using the provided adjacency map.
 * Returns all reachable node IDs including `startId`.
 */
function bfsAll(startId: string, adjacency: Map<string, string[]>): Set<string> {
  const visited = new Set<string>([startId]);
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) ?? [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return visited;
}

/**
 * Depth-limited BFS from `startId` using the provided adjacency map.
 * Returns all node IDs reachable within `maxHops` hops, including `startId`.
 */
function bfsKHop(
  startId: string,
  adjacency: Map<string, string[]>,
  maxHops: number,
): Set<string> {
  const visited = new Set<string>([startId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxHops) continue;

    const neighbors = adjacency.get(id) ?? [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push({ id: next, depth: depth + 1 });
      }
    }
  }

  return visited;
}

/**
 * Compute the set of visible node IDs for a given mode and focal node.
 * Returns `null` when the mode is `"off"` (all nodes should be visible).
 */
function computeVisibleNodes(
  graph: GraphologyLike,
  nodeId: string,
  mode: Exclude<FocusMode, "off">,
  k: number,
): Set<string> {
  const { upstreamMap, downstreamMap, allNeighborsMap } = buildUpstreamAdjacency(graph);

  switch (mode) {
    case "upstream":
      return bfsAll(nodeId, upstreamMap);

    case "downstream":
      return bfsAll(nodeId, downstreamMap);

    case "flow": {
      // Bidirectional — union of upstream and downstream reachable sets.
      const up = bfsAll(nodeId, upstreamMap);
      const down = bfsAll(nodeId, downstreamMap);
      for (const id of down) up.add(id);
      return up;
    }

    case "k-hop":
      return bfsKHop(nodeId, allNeighborsMap, k);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply a focus mode centred on `nodeId`.
 *
 * Mutates graphology `hidden` attributes in place:
 *   - Nodes NOT in the visible set get `hidden = true`.
 *   - Edges where BOTH endpoints are hidden also get `hidden = true`.
 *   - Nodes/edges in the visible set get `hidden = false`.
 *
 * The caller MUST call `sigma.refresh()` after this function returns to update
 * the WebGL canvas.
 *
 * For `mode === "off"`, delegates to `clearFocusMode`.
 *
 * @param graph   - Graphology graph instance (must be populated before calling).
 * @param nodeId  - ID of the focal node around which focus is applied.
 * @param mode    - One of `"off" | "flow" | "upstream" | "downstream" | "k-hop"`.
 * @param options - Optional parameters. Currently supports `k` for k-hop mode
 *                  (integer in [1, 5]; default 2).
 */
export function activateFocusMode(
  graph: GraphologyLike,
  nodeId: string,
  mode: FocusMode,
  options: FocusModeOptions = {},
): void {
  if (mode === "off") {
    clearFocusMode(graph);
    return;
  }

  const k = Math.min(MAX_K, Math.max(MIN_K, Math.round(options.k ?? DEFAULT_K)));
  const visibleNodes = computeVisibleNodes(graph, nodeId, mode, k);

  // Apply node visibility.
  graph.forEachNode((id) => {
    graph.setNodeAttribute(id, "hidden", !visibleNodes.has(id));
  });

  // Hide edges where both endpoints are hidden.
  graph.forEachEdge((edgeId, _attrs, source, target) => {
    const hidden = !visibleNodes.has(source) || !visibleNodes.has(target);
    graph.setEdgeAttribute(edgeId, "hidden", hidden);
  });
}

/**
 * Clear any active focus mode, making all nodes and edges visible.
 *
 * Mutates graphology `hidden` attributes in place (sets all to `false`).
 * The caller MUST call `sigma.refresh()` after this function returns.
 *
 * @param graph - Graphology graph instance.
 */
export function clearFocusMode(graph: GraphologyLike): void {
  graph.forEachNode((id) => {
    graph.setNodeAttribute(id, "hidden", false);
  });
  graph.forEachEdge((edgeId) => {
    graph.setEdgeAttribute(edgeId, "hidden", false);
  });
}
