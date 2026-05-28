"use client";

/**
 * GraphRenderer3D — 3d-force-graph wrapper for the Portal vault graph.
 *
 * Renders a pre-positioned 3D graph using server-precomputed x/y/z coordinates.
 * Force simulation is disabled (cooldownTicks: 0, dagMode: null) so nodes snap
 * to their server layout immediately.
 *
 * Node appearance:
 *   - Radius proportional to fidelity_level (F0=3, F1=4, F2=5, F3=7, F4=9)
 *   - Color uses --mw-graph-accent (high confidence) → dim (low confidence)
 *
 * Edge appearance:
 *   - Color mapped to edge confidence: accent for high (≥0.7), dim for low
 *
 * Navigation (Phase 5):
 *   NAV-001 — OrbitControls tuning (minDistance, maxDistance, damping)
 *   NAV-002 — WASD/Arrow keyboard navigation (container-scoped, RAF loop)
 *   NAV-003 — Node hover + link highlight (nodeColor/linkColor accessors + tooltip overlay)
 *   NAV-004 — Node click + selection + camera transition (single/shift multi-select)
 *
 * WebGL context isolation contract (Phase 4, Risk 1):
 *   This component must be rendered in an exclusive branch with a React `key`
 *   prop on the mount point. When `key` changes, React fully unmounts the old
 *   renderer (3d-force-graph calls `_destructor()` in cleanup) before mounting
 *   the new one — ensuring only one WebGL context is alive at a time.
 *
 * Implements: REND-002 (portal-v2.5-graph-immersive, Phase 4)
 *             NAV-001–NAV-004 (portal-v2.5-graph-immersive, Phase 5)
 *             MOBILE-001 (portal-v2.5-graph-immersive, Phase 6)
 */

import { useEffect, useRef, memo, useCallback, useState } from "react";
import type { ForceGraph3DInstance } from "3d-force-graph";

// ---------------------------------------------------------------------------
// CSS color constants (match --mw-graph-* dark theme palette)
// ---------------------------------------------------------------------------
const COLOR_ACCENT = "#7c6af7";         // --mw-graph-accent
const COLOR_HIGH_CONFIDENCE = "#7c6af7";
const COLOR_LOW_CONFIDENCE = "#2a2a2e"; // --mw-graph-border (very dim)
const COLOR_MID_CONFIDENCE = "#4a4460"; // interpolated midpoint
/** Opacity-reduced version of border color for dimmed non-connected edges. */
const COLOR_EDGE_DIM = "rgba(42,42,46,0.2)"; // --mw-graph-edge-dim equivalent
/** Bright selected-node color — slightly lighter accent for clear differentiation. */
const COLOR_SELECTED = "#a89df9";

/**
 * Resolve a link color based on confidence value (0..1).
 */
function resolveLinkColor(confidence: number | undefined | null): string {
  const c = confidence ?? 0.25;
  if (c >= 0.7) return COLOR_HIGH_CONFIDENCE;
  if (c >= 0.3) return COLOR_MID_CONFIDENCE;
  return COLOR_LOW_CONFIDENCE;
}

// ---------------------------------------------------------------------------
// Fidelity → radius mapping
// ---------------------------------------------------------------------------
const FIDELITY_RADIUS: Record<string, number> = {
  F0: 3, F1: 4, F2: 5, F3: 7, F4: 9,
};
const RADIUS_DEFAULT = 5;

// ---------------------------------------------------------------------------
// NAV-002: WASD movement speed constants
// ---------------------------------------------------------------------------
const MOVE_SPEED_BASE = 0.008;
const MOVE_SPEED_MIN = 0.5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNode3D {
  id: string;
  title?: string | null;
  x: number;
  y: number;
  z: number;
  fidelity_level?: string | null;
}

export interface GraphEdge3D {
  source: string;
  target: string;
  edge_type?: string;
  confidence?: number | null;
}

export interface GraphRenderer3DProps {
  graphData: {
    nodes: GraphNode3D[];
    links: GraphEdge3D[];
  };
  containerRef?: React.RefObject<HTMLDivElement | null>;
  /**
   * NAV-004: Currently selected node IDs propagated from the parent page.
   * Used to persist highlight visually when switching selection via shift-click or
   * when the parent updates selection (e.g. from a sidebar list click).
   */
  selectedNodeIds?: Set<string>;
  /**
   * NAV-004: Called when the user clicks a node (single or shift+click) or
   * clicks background (clears). The parent should update its selectedNodeIds
   * state in response to keep the two in sync.
   */
  onSelectionChange?: (ids: string[]) => void;
}

// ---------------------------------------------------------------------------
// NAV-003: Hover tooltip state shape
// ---------------------------------------------------------------------------
interface HoverTooltip {
  title: string;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Utility: resolve source/target id from a 3d-force-graph link object.
// After graph render, 3d-force-graph resolves string IDs to node objects.
// We handle both the pre-resolved (string) and post-resolved (object with .id) shapes.
// ---------------------------------------------------------------------------
function resolveLinkEndId(end: unknown): string {
  if (typeof end === "string") return end;
  if (end && typeof end === "object" && "id" in end) return (end as { id: string }).id;
  return "";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function GraphRenderer3DInner({
  graphData,
  containerRef,
  selectedNodeIds,
  onSelectionChange,
}: GraphRenderer3DProps) {
  const ownContainerRef = useRef<HTMLDivElement>(null);
  const activeContainerRef = containerRef ?? ownContainerRef;
  const graphRef = useRef<ForceGraph3DInstance | null>(null);

  // NAV-002: key tracking + RAF
  const keysHeldRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);

  // ---------------------------------------------------------------------------
  // NAV-003: hover state in refs (read by nodeColor/linkColor every frame)
  // ---------------------------------------------------------------------------
  const hoveredNodeIdRef = useRef<string | null>(null);
  const hoveredNeighborIdsRef = useRef<Set<string>>(new Set());
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltip | null>(null);

  // ---------------------------------------------------------------------------
  // NAV-004: local selection ref mirrors the prop for accessor reading.
  // The ref is updated synchronously from both prop changes and local click
  // handlers so nodeColor reads the latest set without stale closures.
  // ---------------------------------------------------------------------------
  const localSelectedIdsRef = useRef<Set<string>>(new Set());

  // Keep localSelectedIdsRef in sync with the incoming prop.
  useEffect(() => {
    localSelectedIdsRef.current = selectedNodeIds ?? new Set();
  }, [selectedNodeIds]);

  // ---------------------------------------------------------------------------
  // NAV-002: RAF movement loop
  // ---------------------------------------------------------------------------
  const startMovementLoop = useCallback(() => {
    if (rafRef.current !== null) return;

    const loop = () => {
      const graph = graphRef.current;
      if (!graph) { rafRef.current = null; return; }

      const keys = keysHeldRef.current;
      const hasMovement =
        keys.has("w") || keys.has("arrowup") ||
        keys.has("s") || keys.has("arrowdown") ||
        keys.has("a") || keys.has("arrowleft") ||
        keys.has("d") || keys.has("arrowright");

      if (!hasMovement) { rafRef.current = null; return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const camera = (graph as any).camera() as {
        position: { x: number; y: number; z: number; length: () => number; add(v: unknown): unknown };
        up: { x: number; y: number; z: number };
        getWorldDirection: (v: unknown) => void;
      } | undefined;
      if (!camera) { rafRef.current = null; return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const THREE = (window as any).THREE as {
        Vector3: new () => {
          x: number; y: number; z: number;
          length(): number;
          normalize(): unknown;
          crossVectors(a: unknown, b: unknown): unknown;
          addScaledVector(v: unknown, s: number): unknown;
          add(v: unknown): unknown;
        };
      } | undefined;

      if (!THREE) { rafRef.current = requestAnimationFrame(loop); return; }

      const dist = camera.position.length();
      const speed = Math.max(MOVE_SPEED_MIN, dist * MOVE_SPEED_BASE);

      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      (forward as { normalize(): unknown }).normalize();

      const right = new THREE.Vector3();
      (right as { crossVectors(a: unknown, b: unknown): unknown }).crossVectors(forward, camera.up);
      (right as { normalize(): unknown }).normalize();

      const delta = new THREE.Vector3();
      if (keys.has("w") || keys.has("arrowup"))
        (delta as { addScaledVector(v: unknown, s: number): unknown }).addScaledVector(forward, speed);
      if (keys.has("s") || keys.has("arrowdown"))
        (delta as { addScaledVector(v: unknown, s: number): unknown }).addScaledVector(forward, -speed);
      if (keys.has("d") || keys.has("arrowright"))
        (delta as { addScaledVector(v: unknown, s: number): unknown }).addScaledVector(right, speed);
      if (keys.has("a") || keys.has("arrowleft"))
        (delta as { addScaledVector(v: unknown, s: number): unknown }).addScaledVector(right, -speed);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const controls = (graph as any).controls() as {
        target?: { add(v: unknown): unknown };
        update?: () => void;
      } | undefined;

      if (controls?.target) controls.target.add(delta);
      camera.position.add(delta);
      controls?.update?.();

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  // ---------------------------------------------------------------------------
  // Main graph setup effect
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = activeContainerRef.current;
    if (!container) return;

    let destroyed = false;

    import("3d-force-graph").then(({ default: ForceGraph3DConstructor }) => {
      if (destroyed || !container) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ForceGraph3D = ForceGraph3DConstructor as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const graph = new (ForceGraph3D as any)(container, {
        controlType: "orbit",
        rendererConfig: { antialias: true, alpha: false },
      }) as import("3d-force-graph").ForceGraph3DInstance;

      // NAV-001: OrbitControls tuning
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const controls = graph.controls() as any;
      if (controls) {
        controls.minDistance = 50;
        controls.maxDistance = 2000;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        // MOBILE-001: Touch gesture mapping
        //   ONE finger  → PAN (orbit-free pan so users can explore without spinning)
        //   TWO fingers → DOLLY_ROTATE (pinch-zoom + two-finger rotate)
        // THREE is the namespace for touch constants; accessed from window.THREE
        // (injected by 3d-force-graph alongside OrbitControls). We guard with
        // optional chaining to avoid failures if the constant is not yet exposed.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const THREE_TOUCH = (window as any).THREE?.TOUCH;
        if (THREE_TOUCH) {
          controls.touches = {
            ONE: THREE_TOUCH.PAN,
            TWO: THREE_TOUCH.DOLLY_ROTATE,
          };
        }
      }

      // MOBILE-001: Disable native browser touch-action on the three.js canvas
      // so OrbitControls receives all touch events uninterrupted. The CSS rule
      // in graph.css catches new canvases on subsequent mounts; this imperative
      // set handles the canvas that already exists after ForceGraph3D init.
      const threeCanvas = container.querySelector("canvas");
      if (threeCanvas) {
        threeCanvas.style.touchAction = "none";
      }

      graph
        .backgroundColor("#0d0d0f")
        .showNavInfo(false)
        .cooldownTicks(0)
        .dagMode(null as never)
        .nodeVal((node: Record<string, unknown>) => {
          const fidelity = node.fidelity_level as string | null | undefined;
          const radius = FIDELITY_RADIUS[fidelity ?? "F2"] ?? RADIUS_DEFAULT;
          return radius * radius;
        })
        // -----------------------------------------------------------------
        // NAV-003 + NAV-004: nodeColor accessor
        //
        // Priority order (highest wins):
        //   1. Selected → COLOR_SELECTED (bright accent variant)
        //   2. Hovered node itself → COLOR_ACCENT
        //   3. Neighbors of hovered → COLOR_ACCENT
        //   4. Non-connected while something is hovered → COLOR_LOW_CONFIDENCE (dim)
        //   5. Default (no hover, no selection) → COLOR_ACCENT
        // -----------------------------------------------------------------
        .nodeColor((node: Record<string, unknown>) => {
          const id = node.id as string;
          const selectedIds = localSelectedIdsRef.current;
          const hoveredId = hoveredNodeIdRef.current;

          if (selectedIds.has(id)) return COLOR_SELECTED;
          if (!hoveredId) return COLOR_ACCENT;
          if (id === hoveredId) return COLOR_ACCENT;
          if (hoveredNeighborIdsRef.current.has(id)) return COLOR_ACCENT;
          return COLOR_LOW_CONFIDENCE;
        })
        // -----------------------------------------------------------------
        // NAV-003: linkColor accessor
        // -----------------------------------------------------------------
        .linkColor((link: Record<string, unknown>) => {
          const hoveredId = hoveredNodeIdRef.current;
          if (hoveredId) {
            const src = resolveLinkEndId(link.source);
            const tgt = resolveLinkEndId(link.target);
            if (src !== hoveredId && tgt !== hoveredId) return COLOR_EDGE_DIM;
          }
          const confidence = link.confidence as number | null | undefined;
          return resolveLinkColor(confidence);
        })
        // -----------------------------------------------------------------
        // NAV-003: onNodeHover
        // -----------------------------------------------------------------
        .onNodeHover((node: Record<string, unknown> | null) => {
          if (!node) {
            hoveredNodeIdRef.current = null;
            hoveredNeighborIdsRef.current = new Set();
            setHoverTooltip(null);
            return;
          }

          const id = node.id as string;
          hoveredNodeIdRef.current = id;

          const neighbors = new Set<string>();
          const links = graph.graphData().links as Array<Record<string, unknown>>;
          for (const link of links) {
            const src = resolveLinkEndId(link.source);
            const tgt = resolveLinkEndId(link.target);
            if (src === id) neighbors.add(tgt);
            if (tgt === id) neighbors.add(src);
          }
          hoveredNeighborIdsRef.current = neighbors;

          const title = (node.title as string | null | undefined) ?? id;
          setHoverTooltip((prev) => ({
            title,
            x: prev?.x ?? 0,
            y: prev?.y ?? 0,
          }));
        })
        // -----------------------------------------------------------------
        // NAV-004: onNodeClick — selection + camera tween
        //
        // Single click:  replace selection with [node.id]
        // Shift+click:   additive toggle (add if absent, remove if present)
        //
        // Camera transition: cameraPosition(lookFrom, lookAt, durationMs)
        // We offset the camera position by 1.4× the node's world coords so the
        // camera is slightly behind the node (not at the same position).
        // The 500ms tween gives a smooth cinematic zoom-to-node.
        // -----------------------------------------------------------------
        .onNodeClick((node: Record<string, unknown>, event: MouseEvent) => {
          const id = node.id as string;
          const nx = (node.x as number) ?? 0;
          const ny = (node.y as number) ?? 0;
          const nz = (node.z as number) ?? 0;

          // Camera fly-to: position camera at 1.4× the node coords, looking at the node
          const ZOOM_FACTOR = 1.4;
          graph.cameraPosition(
            { x: nx * ZOOM_FACTOR, y: ny * ZOOM_FACTOR, z: nz * ZOOM_FACTOR },
            { x: nx, y: ny, z: nz },
            500,
          );

          // Update selection
          if (event.shiftKey) {
            const next = new Set(localSelectedIdsRef.current);
            if (next.has(id)) {
              next.delete(id);
            } else {
              next.add(id);
            }
            localSelectedIdsRef.current = next;
            onSelectionChange?.([...next]);
          } else {
            localSelectedIdsRef.current = new Set([id]);
            onSelectionChange?.([id]);
          }
        })
        // NAV-004: background click clears selection
        .onBackgroundClick(() => {
          localSelectedIdsRef.current = new Set();
          onSelectionChange?.([]);
        })
        .graphData({
          nodes: graphData.nodes as never[],
          links: graphData.links as never[],
        });

      graphRef.current = graph;
    });

    return () => {
      destroyed = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (graphRef.current) {
        graphRef.current._destructor();
        graphRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update graphData without re-creating the renderer.
  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.graphData({
      nodes: graphData.nodes as never[],
      links: graphData.links as never[],
    });
  }, [graphData]);

  // Update container dimensions.
  useEffect(() => {
    const container = activeContainerRef.current;
    if (!container || !graphRef.current) return;
    graphRef.current
      .width(container.clientWidth)
      .height(container.clientHeight);
  });

  // ---------------------------------------------------------------------------
  // NAV-002: Keyboard event wiring (container-scoped)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = activeContainerRef.current;
    if (!container) return;

    const MOVEMENT_KEYS = new Set([
      "w", "arrowup", "s", "arrowdown", "a", "arrowleft", "d", "arrowright",
    ]);

    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && active.closest("[data-floating-panel-content]")) return;
      const key = e.key.toLowerCase();
      if (!MOVEMENT_KEYS.has(key)) return;
      e.preventDefault();
      keysHeldRef.current.add(key);
      startMovementLoop();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.key.toLowerCase());
    };

    const handleClick = () => { container.focus(); };

    container.addEventListener("keydown", handleKeyDown);
    container.addEventListener("keyup", handleKeyUp);
    container.addEventListener("click", handleClick);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      container.removeEventListener("keyup", handleKeyUp);
      container.removeEventListener("click", handleClick);
      // Copy ref to local var per react-hooks/exhaustive-deps convention —
      // the Set instance is stable (same object) across renders so the .clear()
      // call is always on the correct Set.
      const keysHeld = keysHeldRef.current;
      keysHeld.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // NAV-003: Track mouse position for tooltip overlay placement
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = activeContainerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (hoveredNodeIdRef.current === null) return;
      const rect = container.getBoundingClientRect();
      setHoverTooltip((prev) =>
        prev
          ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }
          : null,
      );
    };

    container.addEventListener("mousemove", handleMouseMove);
    return () => container.removeEventListener("mousemove", handleMouseMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (containerRef) {
    return null;
  }

  return (
    <div
      ref={ownContainerRef}
      tabIndex={0}
      aria-label="3D vault graph — click to focus, then use WASD or arrow keys to navigate"
      aria-busy={graphData.nodes.length === 0}
      style={{
        width: "100%",
        height: "100%",
        background: "var(--mw-graph-bg, #0d0d0f)",
        outline: "none",
        position: "relative",
      }}
    >
      {/* NAV-003: Hover tooltip HTML overlay */}
      {hoverTooltip && (
        <div
          role="tooltip"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: hoverTooltip.x + 14,
            top: hoverTooltip.y - 10,
            pointerEvents: "none",
            zIndex: 30,
            background: "var(--mw-graph-surface, #1a1a1d)",
            color: "var(--mw-graph-text-primary, #e8e8ea)",
            border: "1px solid var(--mw-graph-border, #2a2a2e)",
            borderRadius: "6px",
            padding: "4px 10px",
            fontSize: "12px",
            fontWeight: 500,
            maxWidth: "220px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {hoverTooltip.title}
        </div>
      )}
    </div>
  );
}

export const GraphRenderer3D = memo(GraphRenderer3DInner);
GraphRenderer3D.displayName = "GraphRenderer3D";

export default GraphRenderer3D;
