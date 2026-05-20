"use client";

/**
 * ClusterHalos — SVG overlay that renders convex-hull halos over sigma cluster groups.
 *
 * Mounted as an absolutely-positioned SVG on top of the sigma canvas (same dimensions).
 * For each non-collapsed cluster with ≥3 member nodes, it computes the 2D convex hull
 * of member positions in graph-coordinates, then maps each hull point to viewport
 * coordinates via `sigma.graphToViewport()`. The resulting polygon is rendered with
 * a fill-opacity of 0.06 and stroke-opacity of 0.3, making it subtle but legible.
 *
 * Convex hull algorithm: Andrew's monotone chain (O(N log N)), ~45 lines.
 * No external dep — pure TypeScript inline.
 *
 * Cluster colors: stable HSL hash of cluster_id (same palette as super-nodes, sourced
 * from clusterColor() in useClusterExpandCollapse).
 *
 * Performance:
 *   - Recomputed on every sigma `afterRender` event.
 *   - Debounced 50ms during FA2 motion to avoid frame-rate contention.
 *   - Hull algorithm: O(N log N) per cluster; at 10K nodes / 10 clusters ≈ 1K
 *     members/cluster, this is ~10ms worst-case — acceptable per frame budget.
 *
 * Interaction:
 *   - Polygon: pointer-events enabled; click → collapse(clusterId) via P3-11 hook.
 *   - Cluster label text: pointer-events: none (decorative only).
 *
 * Sigma-only:
 *   This component is NOT mounted in cosmos renderer mode. The parent (VaultGraphPageClient)
 *   conditionally mounts it only in the sigma branch. No-op safety guard is included.
 *
 * v2.2 — graph explorer P3-12 (SVG convex-hull cluster halos).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { Sigma } from "sigma";
import type Graph from "graphology";
import { clusterColor, isSuperNode } from "@/hooks/useClusterExpandCollapse";

// ---------------------------------------------------------------------------
// Convex hull — Andrew's monotone chain algorithm (~45 lines)
// ---------------------------------------------------------------------------

type Point = { x: number; y: number };

function cross(O: Point, A: Point, B: Point): number {
  return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

/**
 * Compute the convex hull of a set of 2D points using Andrew's monotone chain.
 * Returns points in counter-clockwise order.
 * Returns [] for < 3 points (caller should skip hull rendering).
 * Returns the points themselves for exactly 3 (already a triangle).
 */
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points;

  const sorted = [...points].sort((a, b) =>
    a.x !== b.x ? a.x - b.x : a.y - b.y,
  );

  // Build lower hull.
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  // Build upper hull.
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Remove last point of each half (duplicates of start of the other).
  lower.pop();
  upper.pop();

  return [...lower, ...upper];
}

// ---------------------------------------------------------------------------
// Inflate hull outward by `padding` pixels (in viewport coords)
// ---------------------------------------------------------------------------

function inflatePoly(points: Point[], padding: number): Point[] {
  if (points.length < 3) return points;
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return points.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: p.x + (dx / len) * padding, y: p.y + (dy / len) * padding };
  });
}

// ---------------------------------------------------------------------------
// Cluster hull data computed each render
// ---------------------------------------------------------------------------

interface ClusterHullData {
  clusterId: string;
  hullViewport: Point[];
  centroidViewport: Point;
  color: string;
  label: string;
  memberCount: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ClusterHalosProps {
  /** Live sigma instance (must be mounted). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sigma: any; // sigma v3 — typed as any to avoid version-specific import
  /** The graphology graph (same instance sigma holds). */
  graph: Graph;
  /** Set of currently-expanded cluster IDs (from useClusterExpandCollapse). */
  expanded: Set<string>;
  /**
   * Called when a halo polygon is clicked — triggers collapse of that cluster.
   * The parent wires this to `collapse(clusterId)` from useClusterExpandCollapse.
   */
  onCollapseCluster: (clusterId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClusterHalos({
  sigma,
  graph,
  expanded,
  onCollapseCluster,
}: ClusterHalosProps) {
  const [hulls, setHulls] = useState<ClusterHullData[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<SVGSVGElement | null>(null);

  // -------------------------------------------------------------------------
  // Recompute hulls from current graph state + sigma viewport transform
  // -------------------------------------------------------------------------

  const recompute = useCallback(() => {
    if (!sigma || !graph) {
      setHulls([]);
      return;
    }

    // Group non-super, non-clusterHidden member nodes by cluster_id.
    const clusterPoints = new Map<string, Point[]>();
    const clusterLabels = new Map<string, string>();

    graph.forEachNode((id, attrs) => {
      const clusterId: string | null | undefined = attrs.cluster_id;
      if (!clusterId) return;
      if (isSuperNode(id)) return;
      // Skip member nodes that are collapsed (clusterHidden).
      if (attrs.clusterHidden) return;
      // Skip cluster IDs that are not in the expanded set.
      if (!expanded.has(clusterId)) return;

      const graphX: number = attrs.x ?? 0;
      const graphY: number = attrs.y ?? 0;

      // Convert graph coords → viewport coords.
      const vp = sigma.graphToViewport({ x: graphX, y: graphY });

      const pts = clusterPoints.get(clusterId);
      if (pts) {
        pts.push(vp);
      } else {
        clusterPoints.set(clusterId, [vp]);
        // Use cluster_id as the label (prettified slightly).
        clusterLabels.set(
          clusterId,
          clusterId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        );
      }
    });

    const nextHulls: ClusterHullData[] = [];

    clusterPoints.forEach((pts, clusterId) => {
      // Require ≥ 3 members for a meaningful hull.
      if (pts.length < 3) return;

      const hull = convexHull(pts);
      if (hull.length < 3) return;

      // Inflate outward by 18px so the halo doesn't clip the node circles.
      const inflated = inflatePoly(hull, 18);

      // Compute centroid in viewport coords for the label.
      const cx = inflated.reduce((s, p) => s + p.x, 0) / inflated.length;
      const cy = inflated.reduce((s, p) => s + p.y, 0) / inflated.length;

      nextHulls.push({
        clusterId,
        hullViewport: inflated,
        centroidViewport: { x: cx, y: cy },
        color: clusterColor(clusterId),
        label: clusterLabels.get(clusterId) ?? clusterId,
        memberCount: pts.length,
      });
    });

    setHulls(nextHulls);
  }, [sigma, graph, expanded]);

  // -------------------------------------------------------------------------
  // Subscribe to sigma `afterRender` — debounced 50ms.
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!sigma) return;

    const handler = () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        recompute();
      }, 50);
    };

    sigma.on("afterRender", handler);

    // Trigger an initial compute in case sigma is already rendered.
    handler();

    return () => {
      sigma.off("afterRender", handler);
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [sigma, recompute]);

  // Also recompute when expanded set or graph changes (cluster assignment update).
  useEffect(() => {
    recompute();
  }, [recompute, expanded]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (hulls.length === 0) return null;

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 5,
        overflow: "visible",
      }}
    >
      {hulls.map(({ clusterId, hullViewport, centroidViewport, color, label }) => {
        const points = hullViewport
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" ");

        return (
          <g key={clusterId}>
            {/* Halo polygon — click triggers collapse */}
            <polygon
              points={points}
              fill={color}
              fillOpacity={0.06}
              stroke={color}
              strokeOpacity={0.3}
              strokeWidth={1.5}
              strokeLinejoin="round"
              style={{ pointerEvents: "auto", cursor: "pointer" }}
              onClick={() => onCollapseCluster(clusterId)}
              aria-label={`Cluster ${label} — click to collapse`}
              role="button"
            />
            {/* Cluster label anchored to hull centroid */}
            <text
              x={centroidViewport.x}
              y={centroidViewport.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fontFamily="system-ui, sans-serif"
              fill={color}
              fillOpacity={0.7}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
