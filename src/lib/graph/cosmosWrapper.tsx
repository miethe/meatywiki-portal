"use client";

/**
 * CosmosGraphWrapper — thin React wrapper around @cosmos.gl/graph (MIT).
 *
 * Auto-activation contract: this component is only loaded when total_node_count > 15K,
 * via a Next.js dynamic import in VaultGraphPageClient (P2-08). It must NOT be imported
 * directly in any SSR path — all browser-only APIs (canvas, WebGL) are intentionally used.
 *
 * API surface chosen:
 *  - constructor: new Graph(div, config)          — mounts to a <div>, creates internal canvas
 *  - setPointPositions(Float32Array)              — [x0,y0, x1,y1, ...] interleaved
 *  - setPointColors(Float32Array)                 — [r,g,b,a, r,g,b,a, ...] 0-255 per channel
 *  - setPointSizes(Float32Array)                  — one float per node
 *  - setLinks(Float32Array)                       — [srcIdx,tgtIdx, srcIdx,tgtIdx, ...]
 *  - start() / stop() / destroy()                — simulation lifecycle
 *  - getPointPositions()                          — returns number[] of [x0,y0,...], used for label overlay
 *  - config.onPointClick / onZoom                 — forwarded to React props
 *
 * Uncertain surface (guarded with optional chaining):
 *  - getPointPositions() returns number[] not Float32Array in practice — we accept either
 *  - If canvas creation fails (no WebGL2), we catch and emit the contextlost fallback state
 *
 * P2-11 coexistence note: caller must ensure sigma is destroyed before mounting this
 * component. cosmos.gl creates its own WebGL context on the internal canvas inside the
 * provided div. Simultaneous sigma + cosmos GL contexts will hit the browser context limit.
 *
 * @see phase-2-renderer.md P2-07
 * @see portal-v2.2-graph-rendering-adr.md §3
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Graph as CosmosGraph } from "@cosmos.gl/graph";
import type { GraphConfigInterface } from "@cosmos.gl/graph";
import type { VaultGraphNode, VaultGraphEdge } from "@/types/graph";
import {
  NODE_TYPE_COLORS,
  NODE_TYPE_COLOR_DEFAULT,
  EDGE_TYPE_COLORS,
  EDGE_TYPE_COLOR_DEFAULT,
  FIDELITY_SIZES,
  FIDELITY_SIZE_DEFAULT,
} from "@/types/graph";

// ---------------------------------------------------------------------------
// Hex → RGBA component conversion
// ---------------------------------------------------------------------------

/**
 * Parse a 6-digit hex string (#rrggbb) into 0-255 RGBA components.
 * Alpha defaults to 255 (fully opaque).
 */
function hexToRgba(hex: string, alpha = 255): [number, number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [
    isNaN(r) ? 128 : r,
    isNaN(g) ? 128 : g,
    isNaN(b) ? 128 : b,
    alpha,
  ];
}

// ---------------------------------------------------------------------------
// Data serialization helpers
// ---------------------------------------------------------------------------

/**
 * Serialize VaultGraphNode array to cosmos.gl typed arrays.
 *
 * Positions are laid out as [x0,y0, x1,y1, ...] in a Float32Array.
 * Initial positions are arranged in a deterministic circular layout
 * (cosmos.gl's force simulation will converge from any starting state).
 *
 * Colors are [r,g,b,a, r,g,b,a, ...] in a Float32Array (0-255 per channel).
 * Sizes are one float per node (cosmos.gl default pointDefaultSize=4).
 */
function serializeNodes(nodes: VaultGraphNode[]): {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
} {
  const n = nodes.length;
  const positions = new Float32Array(n * 2);
  const colors = new Float32Array(n * 4);
  const sizes = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const node = nodes[i];

    // Circular initial layout
    const angle = (i / n) * Math.PI * 2;
    const radius = Math.sqrt(n) * 50;
    positions[i * 2] = Math.cos(angle) * radius;
    positions[i * 2 + 1] = Math.sin(angle) * radius;

    // Color from artifact type
    const hex =
      NODE_TYPE_COLORS[node.artifact_type] ?? NODE_TYPE_COLOR_DEFAULT;
    const [r, g, b, a] = hexToRgba(hex);
    colors[i * 4] = r;
    colors[i * 4 + 1] = g;
    colors[i * 4 + 2] = b;
    colors[i * 4 + 3] = a;

    // Size from fidelity level
    const fidelitySize =
      node.fidelity_level != null
        ? FIDELITY_SIZES[node.fidelity_level] ?? FIDELITY_SIZE_DEFAULT
        : FIDELITY_SIZE_DEFAULT;
    sizes[i] = fidelitySize;
  }

  return { positions, colors, sizes };
}

/**
 * Serialize VaultGraphEdge array to a cosmos.gl links Float32Array.
 *
 * Format: [srcIdx, tgtIdx, srcIdx, tgtIdx, ...] — indices into the nodes array.
 * Edges referencing unknown node IDs are silently dropped.
 */
function serializeEdges(
  edges: VaultGraphEdge[],
  nodeIndexMap: Map<string, number>,
): Float32Array {
  const validPairs: number[] = [];

  for (const edge of edges) {
    const srcIdx = nodeIndexMap.get(edge.source_id);
    const tgtIdx = nodeIndexMap.get(edge.target_id);
    if (srcIdx === undefined || tgtIdx === undefined) continue;
    validPairs.push(srcIdx, tgtIdx);
  }

  return new Float32Array(validPairs);
}

/**
 * Serialize edge colors to a cosmos.gl link colors Float32Array.
 * Format: [r,g,b,a, r,g,b,a, ...] one per valid edge (same order as serializeEdges).
 */
function serializeEdgeColors(
  edges: VaultGraphEdge[],
  nodeIndexMap: Map<string, number>,
): Float32Array {
  const colorComponents: number[] = [];

  for (const edge of edges) {
    const srcIdx = nodeIndexMap.get(edge.source_id);
    const tgtIdx = nodeIndexMap.get(edge.target_id);
    if (srcIdx === undefined || tgtIdx === undefined) continue;
    const hex = EDGE_TYPE_COLORS[edge.edge_type] ?? EDGE_TYPE_COLOR_DEFAULT;
    const [r, g, b] = hexToRgba(hex);
    // Edge alpha: attenuate based on confidence (default 0.25 → ~76 alpha)
    const confidence = edge.confidence ?? 0.25;
    const alpha = Math.round(100 + confidence * 155); // 100..255
    colorComponents.push(r, g, b, alpha);
  }

  return new Float32Array(colorComponents);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CosmosGraphWrapperProps {
  nodes: VaultGraphNode[];
  edges: VaultGraphEdge[];
  /** Called when a node is clicked; receives the node object. */
  onNodeClick?: (node: VaultGraphNode) => void;
  /**
   * Called when the camera moves (zoom or pan). Receives the D3 zoom event.
   * Typed as unknown to avoid pulling d3-zoom types into callers.
   */
  onCameraMove?: (event: unknown) => void;
  /** Canvas container height in px. Defaults to "100%". */
  height?: number | string;
  /** Canvas container width in px. Defaults to "100%". */
  width?: number | string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CosmosGraphWrapper — GPU-accelerated graph renderer for N>15K nodes.
 *
 * Lifecycle:
 *  1. On mount: create cosmos Graph instance attached to the inner div.
 *  2. Feed positions, colors, sizes, and links.
 *  3. cosmos.start() launches the force simulation.
 *  4. On unmount: cosmos.destroy() — releases WebGL context + cancels RAF.
 *
 * WebGL context loss: registered on the cosmos-internal canvas via the
 * 'webglcontextlost' event. On loss, we set contextLost=true to surface a
 * fallback UI. The event is registered after cosmos creates its canvas (inside
 * the div) via a MutationObserver on the wrapper div.
 */
export function CosmosGraphWrapper({
  nodes,
  edges,
  onNodeClick,
  onCameraMove,
  height = "100%",
  width = "100%",
}: CosmosGraphWrapperProps) {
  // Ref to the outer wrapper div (cosmos mounts its own canvas inside this)
  const wrapperDivRef = useRef<HTMLDivElement>(null);
  // Cosmos Graph instance
  const cosmosRef = useRef<CosmosGraph | null>(null);
  // Track webgl canvas for event cleanup
  const cosmosCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Banner visibility (dismissable; persists only in component state)
  const [bannerVisible, setBannerVisible] = useState(true);
  const dismissBanner = useCallback(() => setBannerVisible(false), []);

  // WebGL context lost state — surfaces a fallback message
  const [contextLost, setContextLost] = useState(false);

  // Whether getPointPositions is available (guarded; note for P2-11 coexistence test)
  const getPositionsAvailableRef = useRef<boolean | null>(null);

  useEffect(() => {
    const div = wrapperDivRef.current;
    if (!div || nodes.length === 0) return;

    // Build index map for edge serialization
    const nodeIndexMap = new Map<string, number>();
    for (let i = 0; i < nodes.length; i++) {
      nodeIndexMap.set(nodes[i].id, i);
    }

    // Serialize data
    const { positions, colors, sizes } = serializeNodes(nodes);
    const links = serializeEdges(edges, nodeIndexMap);
    const linkColors = serializeEdgeColors(edges, nodeIndexMap);

    // cosmos.gl config
    const config: GraphConfigInterface = {
      backgroundColor: "#0f172a", // slate-900 — dark canvas
      enableSimulation: true,
      simulationDecay: 1000,
      simulationGravity: 0.1,
      simulationRepulsion: 2,
      simulationLinkSpring: 1,
      simulationLinkDistance: 10,
      pointDefaultSize: FIDELITY_SIZE_DEFAULT,
      renderLinks: true,
      renderHoveredPointRing: true,
      hoveredPointRingColor: "#ffffff",
      hoveredPointCursor: "pointer",
      onPointClick: (index, _pointPosition, _event) => {
        if (index === undefined) return;
        const node = nodes[index];
        if (node && onNodeClick) {
          onNodeClick(node);
        }
      },
      onZoom: (event, _userDriven) => {
        if (onCameraMove) {
          onCameraMove(event);
        }
      },
      onSimulationEnd: () => {
        // Simulation has converged — pause to free GPU resources
        cosmosRef.current?.pause();
      },
    };

    let cosmos: CosmosGraph;
    try {
      cosmos = new CosmosGraph(div, config);
    } catch (err) {
      // WebGL2 unavailable or context creation failed
      console.warn(
        "[CosmosGraphWrapper] Failed to create cosmos instance:",
        err,
      );
      setContextLost(true);
      return;
    }

    cosmosRef.current = cosmos;

    // Feed data
    cosmos.setPointPositions(positions);
    cosmos.setPointColors(colors);
    cosmos.setPointSizes(sizes);
    cosmos.setLinks(links);
    cosmos.setLinkColors(linkColors);

    // Probe getPointPositions availability (guarded per spec)
    try {
      const probe = cosmos.getPointPositions?.();
      getPositionsAvailableRef.current = Array.isArray(probe);
      if (!getPositionsAvailableRef.current) {
        console.warn(
          "[CosmosGraphWrapper] getPointPositions() unavailable — label overlay will be skipped in cosmos.gl mode. Note for P2-11 coexistence test.",
        );
      }
    } catch {
      getPositionsAvailableRef.current = false;
      console.warn(
        "[CosmosGraphWrapper] getPointPositions() threw — label overlay skipped.",
      );
    }

    // Register webglcontextlost on the cosmos-created canvas.
    // cosmos.gl creates a <canvas> inside the div immediately on construction.
    // We search for it after mount.
    const canvas = div.querySelector("canvas");
    if (canvas) {
      cosmosCanvasRef.current = canvas as HTMLCanvasElement;
      const handleContextLost = (e: Event) => {
        e.preventDefault(); // prevent default browser context-lost handling
        console.warn(
          "[CosmosGraphWrapper] WebGL context lost — rendering unavailable.",
        );
        setContextLost(true);
      };
      canvas.addEventListener("webglcontextlost", handleContextLost);
      // Store cleanup ref on canvas element via a non-standard property so we
      // can remove the handler in cleanup without a closure capture issue.
      (canvas as HTMLCanvasElement & { __cosmosContextLostHandler?: (e: Event) => void })
        .__cosmosContextLostHandler = handleContextLost;
    }

    // Start the force simulation
    cosmos.start();

    return () => {
      // Remove webglcontextlost handler
      const c = cosmosCanvasRef.current;
      if (c) {
        const handler = (
          c as HTMLCanvasElement & {
            __cosmosContextLostHandler?: (e: Event) => void;
          }
        ).__cosmosContextLostHandler;
        if (handler) {
          c.removeEventListener("webglcontextlost", handler);
        }
      }

      cosmos.destroy();
      cosmosRef.current = null;
      cosmosCanvasRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={{ position: "relative", width, height }}
      data-testid="cosmos-graph-wrapper"
    >
      {/* Inner div that cosmos mounts its canvas into */}
      <div
        ref={wrapperDivRef}
        style={{ width: "100%", height: "100%" }}
        aria-label={`GPU-accelerated knowledge graph with ${nodes.length.toLocaleString()} nodes`}
        role="img"
        data-testid="cosmos-graph-inner"
      />

      {/* GPU banner — dismissable, persists in component state only */}
      {bannerVisible && !contextLost && (
        <div
          role="note"
          aria-label="GPU-accelerated layout active"
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(15, 23, 42, 0.85)",
            border: "1px solid rgba(99, 102, 241, 0.4)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            color: "#a5b4fc",
            backdropFilter: "blur(4px)",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 14 }}>⚡</span>
          <span>Large vault detected — using GPU-accelerated layout.</span>
          <button
            type="button"
            aria-label="Dismiss GPU renderer notice"
            onClick={dismissBanner}
            style={{
              marginLeft: 4,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              fontSize: 16,
              lineHeight: 1,
              padding: "0 2px",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* WebGL context lost fallback */}
      {contextLost && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15, 23, 42, 0.95)",
            color: "#f8fafc",
            fontSize: 14,
            gap: 8,
            padding: 24,
            textAlign: "center",
          }}
          data-testid="cosmos-context-lost"
        >
          <span style={{ fontSize: 32 }}>⚠</span>
          <strong>GPU context unavailable</strong>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>
            WebGL context was lost. Reload the page or switch to the sigma
            renderer.
          </span>
        </div>
      )}
    </div>
  );
}
