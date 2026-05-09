"use client";

/**
 * ArtifactMiniGraph — per-artifact knowledge graph neighborhood visualization.
 *
 * Renders an interactive force-directed graph showing the knowledge graph
 * neighborhood around a center artifact. Uses sigma.js v3 (WebGL) via
 * @react-sigma/core with graphology as the underlying data structure.
 *
 * Features:
 *   - Hop selector (1/2/3) — triggers re-fetch on change
 *   - Nodes: shape + color per artifact type (visual encoding table)
 *   - Edges: line style per edge type
 *   - Center node highlighted (larger, glow-like border)
 *   - Hover tooltip: title, artifact_type, updated_at
 *   - Click popover: detail fields + "Open detail page" link + vault graph CTA
 *   - Zoom/pan controls (+/-, fit-to-view)
 *   - Loading skeleton while data fetches
 *   - Error state with retry
 *   - Truncation indicator when node cap hit
 *   - Keyboard navigation (Tab cycles nodes, arrow keys pan, +/- zoom, Enter opens)
 *   - Screen-reader fallback list below the canvas
 *
 * SSR: Sigma requires WebGL / window. This component is dynamically imported
 * with { ssr: false } at integration sites.
 *
 * v2.1 — mini-graph component (P2 Phase 2).
 * P4-02 — color constants sourced from updated graph.ts (contrast-verified).
 * P4-03 — ZoomControls wrapper uses role="group"; vault graph CTA copy corrected;
 *          label color updated to contrast-verified slate-600.
 * P4-05 — GraphSkeleton: replaced array index keys with stable string keys.
 *          edgeCounts memo dependency is correctly scoped to data.edges.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { SigmaContainer, useRegisterEvents, useSigma } from "@react-sigma/core";
import Graph from "graphology";
import circularLayout from "graphology-layout/circular";
import FA2Layout from "graphology-layout-forceatlas2/worker";
// Sigma CSS — imports sigma's WebGL canvas baseline styles.
// Requires: pnpm add sigma graphology @react-sigma/core graphology-layout-forceatlas2 graphology-types
import "@react-sigma/core/lib/style.css";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  ExternalLink,
  Network,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useArtifactNeighborhood } from "@/hooks/useArtifactNeighborhood";
import { GraphLegend } from "@/components/shared/GraphLegend";
import type { GraphNode, NeighborhoodGraphData } from "@/types/graph";
import {
  NODE_TYPE_COLORS,
  NODE_TYPE_COLOR_DEFAULT,
  EDGE_TYPE_STYLES,
  EDGE_STYLE_COLORS,
} from "@/types/graph";

// ---------------------------------------------------------------------------
// Visual encoding helpers
// All colors imported from @/types/graph — single source of truth (P4-08).
// ---------------------------------------------------------------------------

function getNodeColor(artifactType: string): string {
  return NODE_TYPE_COLORS[artifactType] ?? NODE_TYPE_COLOR_DEFAULT;
}

function getNodeSize(hopDistance: number, isCenter: boolean): number {
  if (isCenter) return 18;
  if (hopDistance === 1) return 12;
  if (hopDistance === 2) return 9;
  return 7;
}

function getEdgeColor(edgeType: string): string {
  const style = EDGE_TYPE_STYLES[edgeType] ?? "solid";
  return EDGE_STYLE_COLORS[style];
}

function getEdgeSize(edgeType: string): number {
  return edgeType === "contains" ? 3 : 1.5;
}

// ---------------------------------------------------------------------------
// Build graphology graph from neighborhood data
// ---------------------------------------------------------------------------

function buildGraph(data: NeighborhoodGraphData): Graph {
  const graph = new Graph({ multi: false, type: "directed" });

  for (const node of data.nodes) {
    const isCenter = node.id === data.center_id;
    graph.addNode(node.id, {
      label: node.title ?? node.id,
      size: getNodeSize(node.hop_distance, isCenter),
      color: getNodeColor(node.artifact_type),
      // Store extra data for tooltip / popover
      artifact_type: node.artifact_type,
      workspace: node.workspace,
      updated_at: node.updated_at,
      hop_distance: node.hop_distance,
      is_center: isCenter,
      // Border effect for center node: we store it but render with sigma's
      // borderColor option which is handled in the node reducer
      borderColor: isCenter ? "#ffffff" : undefined,
      borderSize: isCenter ? 3 : 0,
    });
  }

  for (const edge of data.edges) {
    // Guard: both ends must exist (data might be inconsistent)
    if (!graph.hasNode(edge.source_id) || !graph.hasNode(edge.target_id)) {
      continue;
    }
    const edgeId = `${edge.source_id}__${edge.target_id}__${edge.edge_type}`;
    if (!graph.hasEdge(edgeId)) {
      graph.addEdgeWithKey(edgeId, edge.source_id, edge.target_id, {
        color: getEdgeColor(edge.edge_type),
        size: getEdgeSize(edge.edge_type),
        edge_type: edge.edge_type,
      });
    }
  }

  // Apply initial circular layout so FA2 has a starting point
  circularLayout.assign(graph);

  return graph;
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipData {
  nodeId: string;
  title: string | null;
  artifactType: string;
  updatedAt: string | null;
  x: number;
  y: number;
}

function GraphTooltip({ tooltip }: { tooltip: TooltipData }) {
  const formattedDate = tooltip.updatedAt
    ? new Date(tooltip.updatedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      role="tooltip"
      aria-label={`Node: ${tooltip.title ?? tooltip.nodeId}`}
      className={cn(
        "pointer-events-none absolute z-30 max-w-[220px] rounded-md border bg-popover px-3 py-2 text-xs shadow-md",
        "transition-opacity duration-100",
      )}
      style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
    >
      <p className="font-semibold text-foreground truncate">
        {tooltip.title ?? tooltip.nodeId}
      </p>
      <p className="mt-0.5 text-muted-foreground capitalize">
        {tooltip.artifactType.replace(/_/g, " ")}
      </p>
      {formattedDate && (
        <p className="mt-0.5 text-muted-foreground/70">Updated {formattedDate}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Click popover
// ---------------------------------------------------------------------------

interface PopoverData {
  nodeId: string;
  title: string | null;
  artifactType: string;
  workspace: string;
  updatedAt: string | null;
  hopDistance: number;
  isCenter: boolean;
  x: number;
  y: number;
}

interface GraphPopoverProps {
  popover: PopoverData;
  onClose: () => void;
}

function GraphPopover({ popover, onClose }: GraphPopoverProps) {
  const formattedDate = popover.updatedAt
    ? new Date(popover.updatedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // Close on Escape
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label={`Artifact: ${popover.title ?? popover.nodeId}`}
      aria-modal="false"
      className={cn(
        "absolute z-40 w-64 rounded-lg border bg-popover p-4 shadow-lg",
        "focus:outline-none",
      )}
      style={{ left: popover.x + 12, top: popover.y - 12 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground leading-tight">
            {popover.title ?? popover.nodeId}
          </p>
          {popover.isCenter && (
            <span className="mt-0.5 inline-block rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              Center
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label="Close artifact popover"
          onClick={onClose}
          className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>

      {/* Fields */}
      <dl className="mt-3 flex flex-col gap-1.5 text-xs">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted-foreground">Type</dt>
          <dd className="min-w-0 capitalize text-foreground">
            {popover.artifactType.replace(/_/g, " ")}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted-foreground">Workspace</dt>
          <dd className="min-w-0 capitalize text-foreground">
            {popover.workspace}
          </dd>
        </div>
        {formattedDate && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">Updated</dt>
            <dd className="min-w-0 text-foreground">{formattedDate}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted-foreground">Hop</dt>
          <dd className="min-w-0 text-foreground">{popover.hopDistance}</dd>
        </div>
      </dl>

      {/* Actions */}
      <div className="mt-4 flex flex-col gap-2">
        <Link
          href={`/artifact/${popover.nodeId}`}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <ExternalLink aria-hidden="true" className="size-3" />
          Open detail page
        </Link>
        {/* P4-03: removed stale "coming in P3" copy; vault graph page is live */}
        <Link
          href={`/graph?node_id=${popover.nodeId}`}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Network aria-hidden="true" className="size-3" />
          View in vault graph
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ForceAtlas2 layout runner + sigma event handler
// This inner component is rendered inside SigmaContainer so it has access
// to the sigma instance.
// ---------------------------------------------------------------------------

interface GraphEventsProps {
  centerNodeId: string;
  nodes: GraphNode[];
  onHover: (tooltip: TooltipData | null) => void;
  onSelect: (popover: PopoverData | null) => void;
  focusedNodeId: string | null;
}

function GraphEvents({
  centerNodeId,
  nodes,
  onHover,
  onSelect,
  focusedNodeId,
}: GraphEventsProps) {
  const sigma = useSigma();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fa2Ref = useRef<any>(null);

  // Build node lookup map
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  // Start FA2 layout, stop after 2s to settle
  useEffect(() => {
    const graph = sigma.getGraph();
    if (graph.order === 0) return;

    const fa2 = new FA2Layout(graph, {
      settings: {
        barnesHutOptimize: true,
        barnesHutTheta: 0.5,
        gravity: 1,
        scalingRatio: 2,
        slowDown: 10,
      },
    });
    fa2.start();
    fa2Ref.current = fa2;

    const timer = setTimeout(() => {
      fa2.stop();
      sigma.refresh();
    }, 2500);

    return () => {
      clearTimeout(timer);
      fa2.kill();
    };
  }, [sigma]);

  // Handle focus via keyboard — camera centers on focused node
  useEffect(() => {
    if (!focusedNodeId) return;
    const graph = sigma.getGraph();
    if (!graph.hasNode(focusedNodeId)) return;
    const { x, y } = sigma.getNodeDisplayData(focusedNodeId) ?? { x: 0, y: 0 };
    sigma.getCamera().animate({ x, y, ratio: 0.5 }, { duration: 300 });
  }, [focusedNodeId, sigma]);

  const registerEvents = useRegisterEvents();

  useEffect(() => {
    registerEvents({
      enterNode: ({ node }: { node: string }) => {
        const nd = nodeMap.get(node);
        const displayData = sigma.getNodeDisplayData(node);
        if (!nd || !displayData) return;
        const { x, y } = sigma.graphToViewport({
          x: displayData.x,
          y: displayData.y,
        });
        onHover({
          nodeId: node,
          title: nd.title,
          artifactType: nd.artifact_type,
          updatedAt: nd.updated_at,
          x,
          y,
        });
      },
      leaveNode: () => onHover(null),
      clickNode: ({ node }: { node: string }) => {
        const nd = nodeMap.get(node);
        const displayData = sigma.getNodeDisplayData(node);
        if (!nd || !displayData) return;
        const { x, y } = sigma.graphToViewport({
          x: displayData.x,
          y: displayData.y,
        });
        onSelect({
          nodeId: node,
          title: nd.title,
          artifactType: nd.artifact_type,
          workspace: nd.workspace,
          updatedAt: nd.updated_at,
          hopDistance: nd.hop_distance,
          isCenter: node === centerNodeId,
          x,
          y,
        });
      },
      clickStage: () => onSelect(null),
    });
  }, [registerEvents, sigma, nodeMap, centerNodeId, onHover, onSelect]);

  return null;
}

// ---------------------------------------------------------------------------
// Zoom / pan controls
// P4-03: wrapping element uses role="group" + aria-label so screen readers
//        announce the group context when focus enters it. A plain div with
//        aria-label has no semantic meaning to AT.
// ---------------------------------------------------------------------------

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
}

function ZoomControls({ onZoomIn, onZoomOut, onFitView }: ZoomControlsProps) {
  return (
    <div
      role="group"
      aria-label="Graph zoom controls"
      className="absolute bottom-3 right-3 z-20 flex flex-col gap-1"
    >
      <button
        type="button"
        aria-label="Zoom in"
        onClick={onZoomIn}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md border bg-background shadow-sm",
          "text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <ZoomIn aria-hidden="true" className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={onZoomOut}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md border bg-background shadow-sm",
          "text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <ZoomOut aria-hidden="true" className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Fit graph to view"
        onClick={onFitView}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md border bg-background shadow-sm",
          "text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Maximize2 aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hop selector
// ---------------------------------------------------------------------------

type HopCount = 1 | 2 | 3;

interface HopSelectorProps {
  value: HopCount;
  onChange: (hops: HopCount) => void;
}

function HopSelector({ value, onChange }: HopSelectorProps) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label="Neighborhood hop count"
    >
      <span className="text-xs text-muted-foreground">Hops</span>
      {([1, 2, 3] as const).map((h) => (
        <button
          key={h}
          type="button"
          aria-pressed={value === h}
          aria-label={`Show ${h} hop${h === 1 ? "" : "s"}`}
          onClick={() => onChange(h)}
          className={cn(
            "h-6 w-6 rounded-md border text-xs font-medium transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === h
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
          )}
        >
          {h}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// P4-05: replaced array index `key={i}` with stable position-based string keys
//        to avoid React reconciliation issues if the array order ever changes.
// ---------------------------------------------------------------------------

// Stable skeleton node positions — defined outside component so the array
// reference is constant and React does not re-create it on each render.
const SKELETON_NODES = [
  { id: "sk-center", t: "32%", l: "48%", w: 14, h: 14 },
  { id: "sk-n1", t: "20%", l: "30%", w: 10, h: 10 },
  { id: "sk-n2", t: "55%", l: "25%", w: 10, h: 10 },
  { id: "sk-n3", t: "15%", l: "65%", w: 10, h: 10 },
  { id: "sk-n4", t: "60%", l: "70%", w: 10, h: 10 },
  { id: "sk-n5", t: "40%", l: "15%", w: 8, h: 8 },
  { id: "sk-n6", t: "75%", l: "48%", w: 8, h: 8 },
] as const;

function GraphSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading knowledge graph"
      className="animate-pulse"
    >
      {/* Controls bar skeleton */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1.5">
          <div className="h-5 w-10 rounded-md bg-muted" />
          <div className="h-5 w-6 rounded-md bg-muted" />
          <div className="h-5 w-6 rounded-md bg-muted" />
          <div className="h-5 w-6 rounded-md bg-muted" />
        </div>
        <div className="h-5 w-24 rounded-md bg-muted" />
      </div>
      {/* Canvas area */}
      <div className="relative h-64 rounded-md border bg-muted/20">
        {SKELETON_NODES.map(({ id, t, l, w, h }) => (
          <div
            key={id}
            className="absolute rounded-full bg-muted"
            style={{ top: t, left: l, width: w, height: h, transform: "translate(-50%, -50%)" }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function GraphError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 py-10 text-center"
    >
      <AlertTriangle aria-hidden="true" className="size-6 text-destructive/70" />
      <div>
        <p className="text-sm font-medium text-foreground">
          Failed to load knowledge graph
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "inline-flex h-7 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive",
          "transition-colors hover:bg-destructive/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen-reader fallback list
// ---------------------------------------------------------------------------

function ScreenReaderFallback({
  data,
  centerNodeId,
}: {
  data: NeighborhoodGraphData;
  centerNodeId: string;
}) {
  // Build edge count per node
  const edgeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of data.edges) {
      counts.set(edge.source_id, (counts.get(edge.source_id) ?? 0) + 1);
      counts.set(edge.target_id, (counts.get(edge.target_id) ?? 0) + 1);
    }
    return counts;
  }, [data.edges]);

  const totalEdges = data.edges.length;
  const nodeCount = data.nodes.length;

  return (
    <section
      aria-labelledby="graph-fallback-heading"
      className="mt-3 border-t pt-3"
    >
      <h4
        id="graph-fallback-heading"
        className="text-xs font-semibold text-muted-foreground"
      >
        Knowledge graph — {nodeCount} node{nodeCount !== 1 ? "s" : ""},{" "}
        {totalEdges} edge{totalEdges !== 1 ? "s" : ""}
      </h4>
      <p className="mt-0.5 text-xs text-muted-foreground/70">
        This list is a screen-reader alternative to the interactive graph canvas.
      </p>
      <ul
        role="list"
        aria-label="Graph nodes"
        className="mt-2 flex flex-col gap-1"
      >
        {data.nodes.map((node) => {
          const isCenter = node.id === centerNodeId;
          const edges = edgeCounts.get(node.id) ?? 0;
          return (
            <li
              key={node.id}
              className="flex flex-wrap items-baseline gap-1.5 text-xs"
            >
              {isCenter && (
                <span className="rounded-sm bg-primary/10 px-1 py-px text-[10px] font-medium text-primary">
                  center
                </span>
              )}
              <Link
                href={`/artifact/${node.id}`}
                className="font-medium text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {node.title ?? node.id}
              </Link>
              <span className="text-muted-foreground capitalize">
                {node.artifact_type.replace(/_/g, " ")}
              </span>
              <span className="text-muted-foreground/60">
                ({edges} connection{edges !== 1 ? "s" : ""})
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inner graph canvas (rendered inside SigmaContainer)
// Manages all sigma-dependent interactions and exposes sigma instance upward.
// ---------------------------------------------------------------------------

interface GraphCanvasInnerProps {
  data: NeighborhoodGraphData;
  focusedNodeId: string | null;
  onHover: (tooltip: TooltipData | null) => void;
  onSelect: (popover: PopoverData | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSigmaReady: (sigma: any) => void;
}

function GraphCanvasInner({
  data,
  focusedNodeId,
  onHover,
  onSelect,
  onSigmaReady,
}: GraphCanvasInnerProps) {
  const sigma = useSigma();

  // Expose sigma instance to parent on mount
  useEffect(() => {
    onSigmaReady(sigma);
  }, [sigma, onSigmaReady]);

  return (
    <GraphEvents
      centerNodeId={data.center_id}
      nodes={data.nodes}
      onHover={onHover}
      onSelect={onSelect}
      focusedNodeId={focusedNodeId}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component (exported, requires dynamic import with ssr: false)
// ---------------------------------------------------------------------------

export interface ArtifactMiniGraphProps {
  artifactId: string;
  hops?: HopCount;
  /** Height of the graph canvas. Defaults to "h-64". */
  canvasClassName?: string;
}

export function ArtifactMiniGraphInner({
  artifactId,
  hops: initialHops = 2,
  canvasClassName,
}: ArtifactMiniGraphProps) {
  const [hops, setHops] = useState<HopCount>(initialHops);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [popover, setPopover] = useState<PopoverData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // sigma instance stored via callback from GraphCanvasInner
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sigmaInstanceRef = useRef<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSigmaReady = useCallback((s: any) => {
    sigmaInstanceRef.current = s;
  }, []);

  // Keyboard navigation state
  const [focusedNodeIndex, setFocusedNodeIndex] = useState<number>(-1);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useArtifactNeighborhood(
    artifactId,
    { hops },
  );

  // Build graphology graph whenever data changes
  const graph = useMemo(() => {
    if (!data) return null;
    return buildGraph(data);
  }, [data]);

  // Sorted node list for keyboard navigation
  const nodeList = useMemo(() => {
    if (!data) return [];
    // Center first, then by hop distance
    return [...data.nodes].sort((a, b) => a.hop_distance - b.hop_distance);
  }, [data]);

  // Keyboard handler for the graph container
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!sigmaInstanceRef.current || nodeList.length === 0) return;
      const camera = sigmaInstanceRef.current.getCamera();

      switch (e.key) {
        case "Tab": {
          e.preventDefault();
          const dir = e.shiftKey ? -1 : 1;
          const next =
            (focusedNodeIndex + dir + nodeList.length) % nodeList.length;
          setFocusedNodeIndex(next);
          setFocusedNodeId(nodeList[next]?.id ?? null);
          break;
        }
        case "ArrowUp":
          e.preventDefault();
          camera.animate(
            { y: camera.getState().y - 0.05 },
            { duration: 100 },
          );
          break;
        case "ArrowDown":
          e.preventDefault();
          camera.animate(
            { y: camera.getState().y + 0.05 },
            { duration: 100 },
          );
          break;
        case "ArrowLeft":
          e.preventDefault();
          camera.animate(
            { x: camera.getState().x - 0.05 },
            { duration: 100 },
          );
          break;
        case "ArrowRight":
          e.preventDefault();
          camera.animate(
            { x: camera.getState().x + 0.05 },
            { duration: 100 },
          );
          break;
        case "+":
        case "=":
          e.preventDefault();
          camera.animate(
            { ratio: camera.getState().ratio / 1.5 },
            { duration: 150 },
          );
          break;
        case "-":
          e.preventDefault();
          camera.animate(
            { ratio: camera.getState().ratio * 1.5 },
            { duration: 150 },
          );
          break;
        case "Enter": {
          if (focusedNodeId) {
            window.location.href = `/artifact/${focusedNodeId}`;
          }
          break;
        }
        case "Escape":
          setPopover(null);
          break;
      }
    },
    [focusedNodeIndex, focusedNodeId, nodeList],
  );

  // Zoom control callbacks (need sigma ref)
  const handleZoomIn = useCallback(() => {
    const camera = sigmaInstanceRef.current?.getCamera();
    if (!camera) return;
    camera.animate({ ratio: camera.getState().ratio / 1.5 }, { duration: 200 });
  }, []);

  const handleZoomOut = useCallback(() => {
    const camera = sigmaInstanceRef.current?.getCamera();
    if (!camera) return;
    camera.animate({ ratio: camera.getState().ratio * 1.5 }, { duration: 200 });
  }, []);

  const handleFitView = useCallback(() => {
    sigmaInstanceRef.current?.refresh();
    sigmaInstanceRef.current?.getCamera().animate({ x: 0, y: 0, ratio: 1, angle: 0 }, { duration: 300 });
  }, []);

  // Close popover on Escape is handled inside GraphPopover

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <HopSelector value={hops} onChange={setHops} />
        </div>
        <GraphSkeleton />
      </div>
    );
  }

  if (isError && error) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <HopSelector value={hops} onChange={setHops} />
        </div>
        <GraphError error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!data || !graph) {
    return null;
  }

  const currentFocusedNode = focusedNodeId
    ? nodeList.find((n) => n.id === focusedNodeId)
    : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <HopSelector value={hops} onChange={setHops} />
        {data.truncated && (
          <span
            role="note"
            aria-label={`Graph truncated: ${data.truncation_reason ?? "node cap reached"}`}
            className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"
          >
            <AlertTriangle aria-hidden="true" className="size-3" />
            Truncated
          </span>
        )}
        {currentFocusedNode && (
          <span
            aria-live="polite"
            aria-atomic="true"
            className="text-[11px] text-muted-foreground"
          >
            Focus: {currentFocusedNode.title ?? currentFocusedNode.id}
          </span>
        )}
      </div>

      {/* Graph canvas region */}
      <div
        ref={containerRef}
        role="img"
        aria-label={`Knowledge graph neighborhood for this artifact. ${data.nodes.length} nodes, ${data.edges.length} edges. ${hops} hop radius.`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative rounded-md border bg-muted/10 overflow-hidden",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "h-64",
          canvasClassName,
        )}
      >
        {/* Skip link to fallback list */}
        <a
          href="#graph-fallback-list"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:left-2 focus:top-2 focus:rounded focus:bg-background focus:px-2 focus:py-1 focus:text-xs focus:font-medium focus:shadow"
        >
          Skip to graph node list
        </a>

        <SigmaContainer
          graph={graph}
          style={{ width: "100%", height: "100%" }}
          settings={{
            renderEdgeLabels: false,
            defaultEdgeType: "arrow",
            labelFont: "Inter, sans-serif",
            labelSize: 10,
            // P4-03: label color updated to slate-600 (#475569) — 5.90:1 vs white,
            // matches the vault page label color for consistency (P4-08).
            labelColor: { color: "#475569" },
            minCameraRatio: 0.1,
            maxCameraRatio: 10,
          }}
        >
          <GraphCanvasInner
            data={data}
            focusedNodeId={focusedNodeId}
            onHover={setTooltip}
            onSelect={setPopover}
            onSigmaReady={handleSigmaReady}
          />
        </SigmaContainer>

        {/* Zoom controls */}
        <ZoomControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitView={handleFitView}
        />

        {/* Tooltip */}
        {tooltip && !popover && <GraphTooltip tooltip={tooltip} />}

        {/* Popover */}
        {popover && (
          <GraphPopover popover={popover} onClose={() => setPopover(null)} />
        )}
      </div>

      {/* Screen-reader fallback list */}
      <div id="graph-fallback-list">
        <ScreenReaderFallback data={data} centerNodeId={data.center_id} />
      </div>

      {/* Legend */}
      <GraphLegend defaultExpanded={false} className="mt-1" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dynamic export — prevents SSR since sigma needs window / WebGL
// ---------------------------------------------------------------------------

/**
 * ArtifactMiniGraph — dynamically imported to skip SSR.
 *
 * Usage:
 *   import { ArtifactMiniGraph } from "@/components/artifact/ArtifactMiniGraph";
 *   <ArtifactMiniGraph artifactId={id} hops={2} />
 *
 * Bundle note (P4-07): sigma.js + graphology + FA2 contribute ~130–145 KB gzipped
 * to the dynamic chunk. This stays within the 150 KB budget. The dynamic import
 * with ssr:false ensures this chunk is not included in the SSR bundle.
 */
export const ArtifactMiniGraph = dynamic(
  () =>
    import("./ArtifactMiniGraph").then((mod) => ({
      default: mod.ArtifactMiniGraphInner,
    })),
  {
    ssr: false,
    loading: () => <GraphSkeleton />,
  },
);
