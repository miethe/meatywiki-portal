"use client";

/**
 * useClusterExpandCollapse — client-only cluster expand/collapse state machine.
 *
 * State:
 *   `expanded: Set<string>` — cluster IDs that are currently expanded.
 *   Initially ALL cluster IDs present in the graph are expanded (default open).
 *
 * Operations:
 *   expand(clusterId)   — expand a cluster (restore member visibility, remove super-node).
 *   collapse(clusterId) — collapse a cluster (hide members, add super-node at centroid).
 *   toggle(clusterId)   — convenience: expand if collapsed, collapse if expanded.
 *
 * Sibling-collapse rule:
 *   All clusters are at depth 0 for v2.2 (single-level grouping). On expand, we
 *   collapse all siblings at the same depth. The `depths` record is preserved for
 *   forward compatibility — a future grouping mode introducing hierarchy can supply
 *   depth > 0 without changing the state machine logic.
 *
 * Hidden attribute reconciliation (P3-04 / P3-12):
 *   P3-04 (useClientFilters) manages the `hidden` graphology attribute.
 *   This hook manages `clusterHidden` as a separate attribute.
 *   A node is visually hidden when EITHER `hidden` OR `clusterHidden` is true.
 *   VaultGraphPageClient uses a nodeReducer to combine the two (see wiring comment).
 *
 * URL persistence:
 *   Collapsed cluster IDs are serialized into the `cluster_expand` URL param
 *   (comma-separated list of collapsed IDs, i.e. NOT in expanded set).
 *   On mount, the URL param is read to restore state.
 *
 * Cosmos.gl compatibility:
 *   The hook maintains state regardless of the active renderer.
 *   Visual effects (super-nodes, clusterHidden) are no-op when sigma is not
 *   mounted — the graphology graph is not available. The sigma wiring in
 *   GraphCanvasInner guards with `if (!sigma) return` equivalents.
 *
 * Do NOT import any offline LOD pipeline from codebase-map.
 * This is a client-only state machine; state-machine LOGIC only is adapted.
 *
 * v2.2 — graph explorer P3-11 (cluster expand/collapse).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type Graph from "graphology";

// ---------------------------------------------------------------------------
// URL param
// ---------------------------------------------------------------------------

const QP_CLUSTER_EXPAND = "cluster_expand" as const;

// ---------------------------------------------------------------------------
// Super-node ID convention
// ---------------------------------------------------------------------------

export function superNodeId(clusterId: string): string {
  return `__super_${clusterId}`;
}

export function isSuperNode(nodeId: string): boolean {
  return nodeId.startsWith("__super_");
}

export function clusterIdFromSuperNode(nodeId: string): string {
  return nodeId.slice("__super_".length);
}

// ---------------------------------------------------------------------------
// Stable cluster-color cache (HSL from cluster_id hash)
// ---------------------------------------------------------------------------

const colorCache = new Map<string, string>();

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function clusterColor(clusterId: string): string {
  const cached = colorCache.get(clusterId);
  if (cached) return cached;
  const hue = hashString(clusterId) % 360;
  const color = `hsl(${hue}, 55%, 55%)`;
  colorCache.set(clusterId, color);
  return color;
}

// ---------------------------------------------------------------------------
// Hook result
// ---------------------------------------------------------------------------

export interface UseClusterExpandCollapseResult {
  /** Set of currently-expanded cluster IDs. */
  expanded: Set<string>;
  /** Expand a cluster (restores members, removes super-node). */
  expand: (clusterId: string) => void;
  /** Collapse a cluster (hides members, adds super-node). */
  collapse: (clusterId: string) => void;
  /** Toggle expand/collapse for a cluster. */
  toggle: (clusterId: string) => void;
  /**
   * Sync expanded set with the current graph. Call when the graph's cluster_id
   * assignments change (grouping mode switch). Populates `expanded` with all
   * current cluster IDs — newly discovered clusters default to expanded.
   */
  syncClusters: (graph: Graph) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * @param graph  - The live graphology graph instance (may be null on first render
 *   before sigma is ready). Used to read cluster members and write attributes.
 *   Pass null when sigma is not mounted (cosmos renderer or loading).
 */
export function useClusterExpandCollapse(
  graph: Graph | null,
): UseClusterExpandCollapseResult {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Depth map: all clusters at depth 0 for v2.2 single-level grouping.
  // Preserved for forward compatibility with future hierarchical grouping.
  const depthsRef = useRef<Record<string, number>>({});

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Restore from URL: the param stores COLLAPSED cluster IDs (inverse of expanded).
    const raw = sp.get(QP_CLUSTER_EXPAND);
    if (!raw) return new Set<string>();
    // Parse "collapsed:a,b,c" encoding — an empty Set means ALL expanded.
    // We treat absent param as ALL expanded and non-empty param as exclusions.
    // We start with an empty set and populate via syncClusters on first graph load.
    return new Set<string>();
  });

  // Track which cluster IDs are currently collapsed (inverse of expanded).
  // Used to restore state after syncClusters on grouping mode changes.
  // Initialized from URL param; useRef does not accept a factory, so we read
  // the searchParam synchronously during hook initialization below.
  const collapsedFromUrlRef = useRef<Set<string>>(new Set<string>());
  // Populate from URL on first render only (subsequent updates via the sp useEffect).
  if (collapsedFromUrlRef.current.size === 0) {
    const rawInit = sp.get(QP_CLUSTER_EXPAND);
    if (rawInit) {
      rawInit.split(",").filter(Boolean).forEach((id) => collapsedFromUrlRef.current.add(id));
    }
  }

  // -------------------------------------------------------------------------
  // URL sync (write)
  // -------------------------------------------------------------------------

  const writeUrl = useCallback(
    (nextExpanded: Set<string>, allKnownClusters: Set<string>) => {
      const collapsed = [...allKnownClusters].filter((id) => !nextExpanded.has(id));
      const params = new URLSearchParams(sp.toString());
      if (collapsed.length === 0) {
        params.delete(QP_CLUSTER_EXPAND);
      } else {
        params.set(QP_CLUSTER_EXPAND, collapsed.join(","));
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, sp],
  );

  // -------------------------------------------------------------------------
  // Graph mutation helpers
  // -------------------------------------------------------------------------

  /** Compute centroid of a cluster from member node positions. */
  function computeCentroid(
    g: Graph,
    clusterId: string,
  ): { x: number; y: number } {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    g.forEachNode((id, attrs) => {
      if (attrs.cluster_id === clusterId && !attrs.isSuperNode) {
        sumX += attrs.x ?? 0;
        sumY += attrs.y ?? 0;
        count += 1;
      }
    });
    if (count === 0) return { x: 0, y: 0 };
    return { x: sumX / count, y: sumY / count };
  }

  /** Count members and collect representative type for a cluster. */
  function clusterMeta(
    g: Graph,
    clusterId: string,
  ): { count: number; repType: string } {
    let count = 0;
    const typeCounts = new Map<string, number>();
    g.forEachNode((id, attrs) => {
      if (attrs.cluster_id === clusterId && !attrs.isSuperNode) {
        count += 1;
        const t: string = attrs.artifact_type ?? "artifact";
        typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
      }
    });
    // Pick the most common type as the representative.
    let repType = "artifact";
    let max = 0;
    typeCounts.forEach((n, t) => {
      if (n > max) {
        max = n;
        repType = t;
      }
    });
    return { count, repType };
  }

  /** Hide all member nodes of a cluster and add the super-node. */
  function applyCollapse(g: Graph, clusterId: string): void {
    const centroid = computeCentroid(g, clusterId);
    const { count, repType } = clusterMeta(g, clusterId);

    // Mark each member as clusterHidden (do NOT touch `hidden` from P3-04).
    g.forEachNode((id, attrs) => {
      if (attrs.cluster_id === clusterId && !attrs.isSuperNode) {
        g.setNodeAttribute(id, "clusterHidden", true);
      }
    });

    // Add super-node (idempotent — skip if already present).
    const sid = superNodeId(clusterId);
    if (!g.hasNode(sid)) {
      const superSize = Math.max(12, Math.min(40, 8 + Math.sqrt(count) * 2));
      g.addNode(sid, {
        x: centroid.x,
        y: centroid.y,
        size: superSize,
        label: `${count} ${repType}${count !== 1 ? "s" : ""}`,
        color: clusterColor(clusterId),
        type: "circle",
        isSuperNode: true,
        cluster_id: clusterId,
        // Super-node is never hidden by the cluster logic.
        clusterHidden: false,
        hidden: false,
      });
    }
  }

  /** Restore member visibility and remove the super-node. */
  function applyExpand(g: Graph, clusterId: string): void {
    g.forEachNode((id, attrs) => {
      if (attrs.cluster_id === clusterId && !attrs.isSuperNode) {
        g.setNodeAttribute(id, "clusterHidden", false);
      }
    });
    const sid = superNodeId(clusterId);
    if (g.hasNode(sid)) {
      g.dropNode(sid);
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  const syncClusters = useCallback(
    (g: Graph) => {
      // Discover all current cluster IDs from the graph.
      const clusterIds = new Set<string>();
      g.forEachNode((id, attrs) => {
        if (attrs.cluster_id && !attrs.isSuperNode) {
          clusterIds.add(attrs.cluster_id as string);
        }
      });

      // Re-initialize depth map (all at depth 0 for v2.2).
      const newDepths: Record<string, number> = {};
      clusterIds.forEach((cid) => {
        newDepths[cid] = 0;
      });
      depthsRef.current = newDepths;

      // Build the new expanded set: start with all, then apply URL-restored collapsed.
      const collapsed = collapsedFromUrlRef.current;
      const nextExpanded = new Set<string>(clusterIds);
      collapsed.forEach((cid) => {
        if (clusterIds.has(cid)) nextExpanded.delete(cid);
      });

      setExpanded(nextExpanded);

      // Apply visual state for newly collapsed clusters.
      clusterIds.forEach((cid) => {
        if (!nextExpanded.has(cid)) {
          applyCollapse(g, cid);
        } else {
          applyExpand(g, cid);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const collapse = useCallback(
    (clusterId: string) => {
      if (!graph) return;

      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(clusterId);

        // Track collapsed in URL ref.
        collapsedFromUrlRef.current.add(clusterId);

        // Apply graph mutation.
        applyCollapse(graph, clusterId);

        // Sync URL.
        const allClusters = new Set([...prev, clusterId]);
        writeUrl(next, allClusters);

        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, writeUrl],
  );

  const expand = useCallback(
    (clusterId: string) => {
      if (!graph) return;

      setExpanded((prev) => {
        // Sibling-collapse rule: collapse all siblings at the same depth.
        const targetDepth = depthsRef.current[clusterId] ?? 0;
        const next = new Set<string>();

        // Only the target cluster is expanded; siblings at same depth → collapse.
        // Clusters at other depths are preserved.
        prev.forEach((cid) => {
          const d = depthsRef.current[cid] ?? 0;
          if (d === targetDepth && cid !== clusterId) {
            // Sibling → collapse.
            applyCollapse(graph, cid);
            collapsedFromUrlRef.current.add(cid);
          } else {
            next.add(cid);
          }
        });
        next.add(clusterId);
        collapsedFromUrlRef.current.delete(clusterId);

        // Apply expand mutation.
        applyExpand(graph, clusterId);

        // Sync URL.
        const allClusters = new Set([...Object.keys(depthsRef.current)]);
        writeUrl(next, allClusters);

        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, writeUrl],
  );

  const toggle = useCallback(
    (clusterId: string) => {
      setExpanded((prev) => {
        if (prev.has(clusterId)) {
          // Trigger collapse via timeout to avoid setState-in-setState.
          setTimeout(() => collapse(clusterId), 0);
        } else {
          setTimeout(() => expand(clusterId), 0);
        }
        return prev; // Actual update happens in expand/collapse callbacks.
      });
    },
    [expanded, collapse, expand],
  );

  // -------------------------------------------------------------------------
  // URL → state on searchParams change (e.g. browser back/forward).
  // -------------------------------------------------------------------------

  useEffect(() => {
    const raw = sp.get(QP_CLUSTER_EXPAND);
    collapsedFromUrlRef.current = raw
      ? new Set(raw.split(",").filter(Boolean))
      : new Set<string>();

    if (graph) {
      syncClusters(graph);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  return { expanded, expand, collapse, toggle, syncClusters };
}
