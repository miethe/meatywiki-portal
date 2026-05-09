"use client";

/**
 * VaultGraphPageClient — sigma.js-powered vault graph canvas + interactions.
 *
 * Exported as a named component so page.tsx can dynamically import it with
 * ssr: false (sigma requires window/WebGL).
 *
 * Covers tasks:
 *   P3-01 — page scaffold, graph fetch, loading spinner, breadcrumb/title
 *   P3-02 — artifact type filter sidebar
 *   P3-03 — edge type filter sidebar
 *   P3-04 — pagination, "N of M" label, "Next page" button
 *   P3-05 — click-to-focus neighborhood filter + "Back to vault"
 *   P3-06 — hover tooltips, click popovers, GraphLegend, taxonomy link
 *   P3-07 — degraded fallback list view toggle
 *   P3-08 — memoization, FA2 layout, sampling transparency
 *   P3-10 — keyboard navigation (Tab nodes, arrow pan, +/- zoom, Enter, Escape)
 *   P3-11 — ARIA labels, skip link, sr-only fallback list
 *
 * v2.1 — vault graph page (P3 Phase 3).
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
import {
  SigmaContainer,
  useRegisterEvents,
  useSigma,
} from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import Graph from "graphology";
import circularLayout from "graphology-layout/circular";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  ExternalLink,
  Network,
  ArrowLeft,
  AlertTriangle,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useVaultGraph, VAULT_GRAPH_NODE_CAP } from "@/hooks/useVaultGraph";
import { useArtifactNeighborhood } from "@/hooks/useArtifactNeighborhood";
import { FilterSidebar } from "@/components/graph/FilterSidebar";
import { DegradedFallback } from "@/components/graph/DegradedFallback";
import type { FallbackView } from "@/components/graph/DegradedFallback";
import { GraphLegend } from "@/components/shared/GraphLegend";
import type {
  VaultGraphNode,
  VaultGraphEdge,
  GraphNodeType,
} from "@/types/graph";
import {
  NODE_TYPE_COLORS,
  NODE_TYPE_COLOR_DEFAULT,
  EDGE_TYPE_STYLES,
  EDGE_STYLE_COLORS,
} from "@/types/graph";

// ---------------------------------------------------------------------------
// Visual encoding helpers (mirrors ArtifactMiniGraph)
// ---------------------------------------------------------------------------

function getNodeColor(artifactType: string): string {
  return NODE_TYPE_COLORS[artifactType] ?? NODE_TYPE_COLOR_DEFAULT;
}

function getNodeSize(artifactType: string): number {
  // Concepts/Syntheses slightly larger to indicate knowledge weight
  if (artifactType === "concept") return 14;
  if (artifactType === "synthesis") return 13;
  return 10;
}

function getEdgeColor(edgeType: string): string {
  const style = EDGE_TYPE_STYLES[edgeType] ?? "solid";
  return EDGE_STYLE_COLORS[style];
}

function getEdgeSize(edgeType: string): number {
  return edgeType === "contains" ? 3 : 1.5;
}

// ---------------------------------------------------------------------------
// Build graphology graph from vault data
// ---------------------------------------------------------------------------

function buildVaultGraph(
  nodes: VaultGraphNode[],
  edges: VaultGraphEdge[],
  highlightedNodeId?: string | null,
): Graph {
  const graph = new Graph({ multi: false, type: "directed" });

  for (const node of nodes) {
    const isHighlighted = node.id === highlightedNodeId;
    graph.addNode(node.id, {
      label: node.title ?? node.id,
      size: isHighlighted ? getNodeSize(node.artifact_type) * 1.5 : getNodeSize(node.artifact_type),
      color: getNodeColor(node.artifact_type),
      artifact_type: node.artifact_type,
      workspace: node.workspace,
      updated_at: node.updated_at,
      borderColor: isHighlighted ? "#ffffff" : undefined,
      borderSize: isHighlighted ? 3 : 0,
    });
  }

  for (const edge of edges) {
    if (!graph.hasNode(edge.source_id) || !graph.hasNode(edge.target_id)) continue;
    const edgeId = `${edge.source_id}__${edge.target_id}__${edge.edge_type}`;
    if (!graph.hasEdge(edgeId)) {
      graph.addEdgeWithKey(edgeId, edge.source_id, edge.target_id, {
        color: getEdgeColor(edge.edge_type),
        size: getEdgeSize(edge.edge_type),
        edge_type: edge.edge_type,
      });
    }
  }

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
  const formatted = tooltip.updatedAt
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
      style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
    >
      <p className="truncate font-semibold text-foreground">
        {tooltip.title ?? tooltip.nodeId}
      </p>
      <p className="mt-0.5 capitalize text-muted-foreground">
        {tooltip.artifactType.replace(/_/g, " ")}
      </p>
      {formatted && (
        <p className="mt-0.5 text-muted-foreground/70">Updated {formatted}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Click popover (P3-06)
// ---------------------------------------------------------------------------

interface PopoverData {
  nodeId: string;
  title: string | null;
  artifactType: string;
  workspace: string;
  updatedAt: string | null;
  x: number;
  y: number;
}

interface GraphPopoverProps {
  popover: PopoverData;
  onClose: () => void;
  onViewNeighborhood: (nodeId: string) => void;
}

function GraphPopover({ popover, onClose, onViewNeighborhood }: GraphPopoverProps) {
  const formatted = popover.updatedAt
    ? new Date(popover.updatedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

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
      className="absolute z-40 w-64 rounded-lg border bg-popover p-4 shadow-lg focus:outline-none"
      style={{ left: popover.x + 14, top: popover.y - 14 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight text-foreground">
          {popover.title ?? popover.nodeId}
        </p>
        <button
          type="button"
          aria-label="Close artifact popover"
          onClick={onClose}
          className={cn(
            "shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-70 hover:opacity-100",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
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
          <dd className="min-w-0 capitalize text-foreground">{popover.workspace}</dd>
        </div>
        {formatted && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">Updated</dt>
            <dd className="min-w-0 text-foreground">{formatted}</dd>
          </div>
        )}
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
        <button
          type="button"
          onClick={() => {
            onViewNeighborhood(popover.nodeId);
            onClose();
          }}
          aria-label={`View neighborhood graph for ${popover.title ?? popover.nodeId}`}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Network aria-hidden="true" className="size-3" />
          View neighborhood
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zoom controls
// ---------------------------------------------------------------------------

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
}

function ZoomControls({ onZoomIn, onZoomOut, onFitView }: ZoomControlsProps) {
  return (
    <div
      className="absolute bottom-3 right-3 z-20 flex flex-col gap-1"
      aria-label="Graph zoom controls"
    >
      {(
        [
          { fn: onZoomIn, label: "Zoom in", icon: <ZoomIn aria-hidden="true" className="size-3.5" /> },
          { fn: onZoomOut, label: "Zoom out", icon: <ZoomOut aria-hidden="true" className="size-3.5" /> },
          { fn: onFitView, label: "Fit graph to view", icon: <Maximize2 aria-hidden="true" className="size-3.5" /> },
        ] as const
      ).map(({ fn, label, icon }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          onClick={fn}
          className={cn(
            "flex size-7 items-center justify-center rounded-md border bg-background shadow-sm",
            "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton for the graph canvas area
// ---------------------------------------------------------------------------

function GraphCanvasSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading knowledge graph"
      className="flex h-full items-center justify-center"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative size-16">
          {/* Pulsing concentric rings */}
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
          <div className="absolute inset-2 rounded-full bg-primary/10 animate-pulse" />
          <Network
            aria-hidden="true"
            className="absolute inset-0 m-auto size-7 text-muted-foreground/40"
          />
        </div>
        <p className="text-sm text-muted-foreground">Loading vault graph…</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sigma inner component — FA2 layout + event registration
// ---------------------------------------------------------------------------

interface GraphEventsProps {
  nodes: VaultGraphNode[];
  onHover: (tooltip: TooltipData | null) => void;
  onSelect: (popover: PopoverData | null) => void;
  focusedNodeId: string | null;
}

function GraphEvents({ nodes, onHover, onSelect, focusedNodeId }: GraphEventsProps) {
  const sigma = useSigma();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fa2Ref = useRef<any>(null);

  const nodeMap = useMemo(() => {
    const map = new Map<string, VaultGraphNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  // Start FA2 layout, stop after settling
  useEffect(() => {
    const graph = sigma.getGraph();
    if (graph.order === 0) return;

    // For large graphs, use lighter FA2 settings to maintain FPS
    const isLarge = graph.order > 500;

    const fa2 = new FA2Layout(graph, {
      settings: {
        barnesHutOptimize: isLarge,
        barnesHutTheta: isLarge ? 0.8 : 0.5,
        gravity: 1,
        scalingRatio: 2,
        slowDown: isLarge ? 20 : 10,
      },
    });
    fa2.start();
    fa2Ref.current = fa2;

    // Settle time: shorter for large graphs to save CPU
    const settleMs = isLarge ? 1500 : 2500;
    const timer = setTimeout(() => {
      fa2.stop();
      sigma.refresh();
    }, settleMs);

    return () => {
      clearTimeout(timer);
      fa2.kill();
    };
  }, [sigma]);

  // Camera pan to focused node (keyboard nav)
  useEffect(() => {
    if (!focusedNodeId) return;
    const graph = sigma.getGraph();
    if (!graph.hasNode(focusedNodeId)) return;
    const displayData = sigma.getNodeDisplayData(focusedNodeId);
    if (!displayData) return;
    sigma.getCamera().animate(
      { x: displayData.x, y: displayData.y, ratio: 0.5 },
      { duration: 300 },
    );
  }, [focusedNodeId, sigma]);

  const registerEvents = useRegisterEvents();

  useEffect(() => {
    registerEvents({
      enterNode: ({ node }: { node: string }) => {
        const nd = nodeMap.get(node);
        const displayData = sigma.getNodeDisplayData(node);
        if (!nd || !displayData) return;
        const { x, y } = sigma.graphToViewport({ x: displayData.x, y: displayData.y });
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
        const { x, y } = sigma.graphToViewport({ x: displayData.x, y: displayData.y });
        onSelect({
          nodeId: node,
          title: nd.title,
          artifactType: nd.artifact_type,
          workspace: nd.workspace,
          updatedAt: nd.updated_at,
          x,
          y,
        });
      },
      clickStage: () => onSelect(null),
    });
  }, [registerEvents, sigma, nodeMap, onHover, onSelect]);

  return null;
}

// ---------------------------------------------------------------------------
// Canvas inner (inside SigmaContainer)
// ---------------------------------------------------------------------------

interface GraphCanvasInnerProps {
  nodes: VaultGraphNode[];
  focusedNodeId: string | null;
  onHover: (t: TooltipData | null) => void;
  onSelect: (p: PopoverData | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSigmaReady: (s: any) => void;
}

function GraphCanvasInner({
  nodes,
  focusedNodeId,
  onHover,
  onSelect,
  onSigmaReady,
}: GraphCanvasInnerProps) {
  const sigma = useSigma();
  useEffect(() => { onSigmaReady(sigma); }, [sigma, onSigmaReady]);
  return (
    <GraphEvents
      nodes={nodes}
      onHover={onHover}
      onSelect={onSelect}
      focusedNodeId={focusedNodeId}
    />
  );
}

// ---------------------------------------------------------------------------
// Neighborhood header — "Viewing neighborhood of [title]" (P3-05)
// ---------------------------------------------------------------------------

interface NeighborhoodHeaderProps {
  title: string | null;
  nodeId: string;
  onBack: () => void;
}

function NeighborhoodHeader({ title, nodeId, onBack }: NeighborhoodHeaderProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card/80 px-4 py-2.5 shadow-sm">
      <button
        type="button"
        aria-label="Back to vault graph"
        onClick={onBack}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground",
          "transition-colors hover:bg-accent hover:text-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        <span>All artifacts</span>
      </button>
      <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground/40" />
      <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
        <span className="text-muted-foreground">Neighborhood of </span>
        <span className="truncate">{title ?? nodeId}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// "N of M" pagination bar (P3-04)
// ---------------------------------------------------------------------------

interface PaginationBarProps {
  loaded: number;
  total: number;
  hasMore: boolean;
  isFetchingMore: boolean;
  onNextPage: () => void;
  sampled: boolean;
}

function PaginationBar({
  loaded,
  total,
  hasMore,
  isFetchingMore,
  onNextPage,
  sampled,
}: PaginationBarProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card/80 px-4 py-2"
      aria-label="Graph pagination"
    >
      <p className="text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
        {sampled ? (
          <>
            Showing a sample of{" "}
            <strong className="font-semibold text-foreground">
              {loaded.toLocaleString()}
            </strong>{" "}
            artifacts
          </>
        ) : (
          <>
            Showing{" "}
            <strong className="font-semibold text-foreground">
              {loaded.toLocaleString()}
            </strong>{" "}
            of{" "}
            <strong className="font-semibold text-foreground">
              {total.toLocaleString()}
            </strong>{" "}
            nodes
          </>
        )}
      </p>

      {hasMore && (
        <button
          type="button"
          onClick={onNextPage}
          disabled={isFetchingMore}
          aria-label={
            isFetchingMore ? "Loading more nodes…" : "Load next page of graph nodes"
          }
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          {isFetchingMore ? (
            <>
              <svg
                aria-hidden="true"
                className="size-3.5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Loading…
            </>
          ) : (
            "Next page"
          )}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function GraphError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 py-16 text-center"
    >
      <AlertTriangle aria-hidden="true" className="size-8 text-destructive/70" />
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
          "inline-flex items-center rounded-md border border-destructive/40 px-4 py-2 text-xs font-medium text-destructive",
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
// Mobile filter drawer
// ---------------------------------------------------------------------------

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  nodeTypes: import("@/types/graph").GraphNodeType[];
  edgeTypes: import("@/types/graph").GraphEdgeType[];
  onNodeTypesChange: (types: import("@/types/graph").GraphNodeType[]) => void;
  onEdgeTypesChange: (types: import("@/types/graph").GraphEdgeType[]) => void;
  onClearAll: () => void;
}

function MobileFilterDrawer({
  isOpen,
  onClose,
  nodeTypes,
  edgeTypes,
  onNodeTypesChange,
  onEdgeTypesChange,
  onClearAll,
}: MobileFilterDrawerProps) {
  if (!isOpen) return null;
  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Graph filters"
        className="fixed inset-y-0 left-0 z-40 flex w-[280px] max-w-[85vw] flex-col border-r bg-card md:hidden"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal aria-hidden="true" className="size-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold">Filters</span>
          </div>
          <button
            type="button"
            aria-label="Close filters"
            onClick={onClose}
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-md",
              "text-muted-foreground transition-colors hover:bg-accent",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <FilterSidebar
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeTypesChange={onNodeTypesChange}
            onEdgeTypesChange={onEdgeTypesChange}
            onClearAll={onClearAll}
            alwaysVisible
          />
        </div>
        <div className="shrink-0 border-t p-3">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "w-full inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium",
              "transition-colors hover:bg-accent",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            Apply & close
          </button>
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Screen-reader fallback list (P3-11)
// ---------------------------------------------------------------------------

function ScreenReaderFallback({
  nodes,
  onViewNeighborhood,
}: {
  nodes: VaultGraphNode[];
  onViewNeighborhood: (nodeId: string) => void;
}) {
  return (
    <section
      aria-labelledby="sr-graph-heading"
      className="mt-3 border-t pt-3"
    >
      <h3
        id="sr-graph-heading"
        className="text-xs font-semibold text-muted-foreground"
      >
        Knowledge graph — {nodes.length.toLocaleString()} artifact
        {nodes.length !== 1 ? "s" : ""} (screen-reader list)
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground/70">
        This list is a screen-reader alternative to the interactive graph canvas.
      </p>
      <ul role="list" aria-label="Graph nodes" className="mt-2 flex flex-col gap-1">
        {nodes.map((node) => (
          <li key={node.id} className="flex flex-wrap items-baseline gap-2 text-xs">
            <Link
              href={`/artifact/${node.id}`}
              className="font-medium text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              {node.title ?? node.id}
            </Link>
            <span className="capitalize text-muted-foreground">
              {node.artifact_type.replace(/_/g, " ")}
            </span>
            <button
              type="button"
              onClick={() => onViewNeighborhood(node.id)}
              className="text-muted-foreground/70 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
            >
              View neighborhood
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main exported client component
// ---------------------------------------------------------------------------

export function VaultGraphPageClient() {
  // -------------------------------------------------------------------------
  // Vault graph data + filter state (P3-01, P3-02, P3-03)
  // -------------------------------------------------------------------------
  const {
    nodes,
    edges,
    totalNodeCount,
    sampled,
    degraded,
    isLoading,
    isFetchingMore,
    hasMore,
    isError,
    error,
    refetch,
    fetchNextPage,
    nodeTypes,
    edgeTypes,
    setNodeTypes,
    setEdgeTypes,
    clearFilters,
  } = useVaultGraph();

  // -------------------------------------------------------------------------
  // Neighborhood focus mode (P3-05)
  // -------------------------------------------------------------------------
  const [focusedArtifactId, setFocusedArtifactId] = useState<string | null>(null);
  const [focusedArtifactTitle, setFocusedArtifactTitle] = useState<string | null>(null);
  const isNeighborhoodMode = focusedArtifactId !== null;

  const { data: neighborhoodData, isLoading: isNeighborhoodLoading } =
    useArtifactNeighborhood(focusedArtifactId, { hops: 2 });

  // Resolve nodes/edges for current view (vault or neighborhood)
  const displayNodes: VaultGraphNode[] = useMemo(() => {
    if (isNeighborhoodMode && neighborhoodData) {
      return neighborhoodData.nodes.map((n) => ({
        id: n.id,
        title: n.title,
        artifact_type: n.artifact_type,
        workspace: n.workspace,
        updated_at: n.updated_at,
      }));
    }
    return nodes;
  }, [isNeighborhoodMode, neighborhoodData, nodes]);

  const displayEdges: VaultGraphEdge[] = useMemo(() => {
    if (isNeighborhoodMode && neighborhoodData) {
      return neighborhoodData.edges;
    }
    return edges;
  }, [isNeighborhoodMode, neighborhoodData, edges]);

  const handleViewNeighborhood = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      setFocusedArtifactId(nodeId);
      setFocusedArtifactTitle(node?.title ?? null);
    },
    [nodes],
  );

  const handleBackToVault = useCallback(() => {
    setFocusedArtifactId(null);
    setFocusedArtifactTitle(null);
  }, []);

  // -------------------------------------------------------------------------
  // Degraded fallback view toggle (P3-07)
  // -------------------------------------------------------------------------
  const [fallbackView, setFallbackView] = useState<FallbackView>("graph");

  // Auto-switch to list when severely degraded
  useEffect(() => {
    if (totalNodeCount >= VAULT_GRAPH_NODE_CAP * 2) {
      setFallbackView("list");
    }
  }, [totalNodeCount]);

  // -------------------------------------------------------------------------
  // Tooltip + popover state (P3-06)
  // -------------------------------------------------------------------------
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [popover, setPopover] = useState<PopoverData | null>(null);

  // -------------------------------------------------------------------------
  // Sigma instance ref (for keyboard nav + zoom controls)
  // -------------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sigmaRef = useRef<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSigmaReady = useCallback((sigma: any) => {
    sigmaRef.current = sigma;
  }, []);

  // -------------------------------------------------------------------------
  // Keyboard navigation state (P3-10)
  // -------------------------------------------------------------------------
  const [focusedNodeIndex, setFocusedNodeIndex] = useState(-1);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // Sorted node list for keyboard cycling
  const nodeList = useMemo(() => [...displayNodes], [displayNodes]);

  // -------------------------------------------------------------------------
  // Build graphology graph (memoized — P3-08)
  // -------------------------------------------------------------------------
  const graph = useMemo(() => {
    if (displayNodes.length === 0) return null;
    return buildVaultGraph(displayNodes, displayEdges, focusedArtifactId);
  }, [displayNodes, displayEdges, focusedArtifactId]);

  // -------------------------------------------------------------------------
  // Keyboard handler (P3-10)
  // -------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!sigmaRef.current || nodeList.length === 0) return;
      const camera = sigmaRef.current.getCamera();

      switch (e.key) {
        case "Tab": {
          e.preventDefault();
          const dir = e.shiftKey ? -1 : 1;
          const next = (focusedNodeIndex + dir + nodeList.length) % nodeList.length;
          setFocusedNodeIndex(next);
          setFocusedNodeId(nodeList[next]?.id ?? null);
          break;
        }
        case "ArrowUp":
          e.preventDefault();
          camera.animate({ y: camera.getState().y - 0.05 }, { duration: 100 });
          break;
        case "ArrowDown":
          e.preventDefault();
          camera.animate({ y: camera.getState().y + 0.05 }, { duration: 100 });
          break;
        case "ArrowLeft":
          e.preventDefault();
          camera.animate({ x: camera.getState().x - 0.05 }, { duration: 100 });
          break;
        case "ArrowRight":
          e.preventDefault();
          camera.animate({ x: camera.getState().x + 0.05 }, { duration: 100 });
          break;
        case "+":
        case "=":
          e.preventDefault();
          camera.animate({ ratio: camera.getState().ratio / 1.5 }, { duration: 150 });
          break;
        case "-":
          e.preventDefault();
          camera.animate({ ratio: camera.getState().ratio * 1.5 }, { duration: 150 });
          break;
        case "Enter":
          if (focusedNodeId) {
            window.location.href = `/artifact/${focusedNodeId}`;
          }
          break;
        case "Escape":
          setPopover(null);
          break;
      }
    },
    [focusedNodeIndex, focusedNodeId, nodeList],
  );

  // -------------------------------------------------------------------------
  // Zoom control callbacks
  // -------------------------------------------------------------------------
  const handleZoomIn = useCallback(() => {
    const camera = sigmaRef.current?.getCamera();
    if (!camera) return;
    camera.animate({ ratio: camera.getState().ratio / 1.5 }, { duration: 200 });
  }, []);

  const handleZoomOut = useCallback(() => {
    const camera = sigmaRef.current?.getCamera();
    if (!camera) return;
    camera.animate({ ratio: camera.getState().ratio * 1.5 }, { duration: 200 });
  }, []);

  const handleFitView = useCallback(() => {
    sigmaRef.current?.getCamera().animate({ x: 0, y: 0, ratio: 1, angle: 0 }, { duration: 300 });
    sigmaRef.current?.refresh();
  }, []);

  // -------------------------------------------------------------------------
  // Mobile filters drawer
  // -------------------------------------------------------------------------
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // -------------------------------------------------------------------------
  // Active filter count badge
  // -------------------------------------------------------------------------
  const activeFilterCount = nodeTypes.length + edgeTypes.length;

  // -------------------------------------------------------------------------
  // Currently focused node label (for screen-reader live region)
  // -------------------------------------------------------------------------
  const currentFocusedNode = focusedNodeId
    ? nodeList.find((n) => n.id === focusedNodeId)
    : null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      {/* Mobile filter drawer */}
      <MobileFilterDrawer
        isOpen={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeTypesChange={setNodeTypes}
        onEdgeTypesChange={setEdgeTypes}
        onClearAll={clearFilters}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Breadcrumb + page header (P3-01)                                    */}
      {/* ------------------------------------------------------------------ */}
      <header className="flex flex-wrap items-start justify-between gap-3 shrink-0">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="w-full">
          <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <li>
              <Link
                href="/"
                className="hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="size-3" />
            </li>
            {isNeighborhoodMode ? (
              <>
                <li>
                  <button
                    type="button"
                    onClick={handleBackToVault}
                    className="hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Knowledge Graph
                  </button>
                </li>
                <li aria-hidden="true">
                  <ChevronRight className="size-3" />
                </li>
                <li>
                  <span aria-current="page" className="text-foreground">
                    {focusedArtifactTitle ?? focusedArtifactId ?? "Neighborhood"}
                  </span>
                </li>
              </>
            ) : (
              <li>
                <span aria-current="page" className="text-foreground">
                  Knowledge Graph
                </span>
              </li>
            )}
          </ol>
        </nav>

        {/* Title + subtitle */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isNeighborhoodMode
              ? "Artifact Neighborhood"
              : "Knowledge Graph"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading || isNeighborhoodLoading
              ? "Loading graph…"
              : isNeighborhoodMode
              ? `Connections for ${focusedArtifactTitle ?? focusedArtifactId}`
              : `${totalNodeCount.toLocaleString()} artifact${totalNodeCount !== 1 ? "s" : ""} in vault`}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Mobile filter button */}
          <button
            type="button"
            aria-label={
              activeFilterCount > 0
                ? `Open filters (${activeFilterCount} active)`
                : "Open filters"
            }
            onClick={() => setMobileFiltersOpen(true)}
            className={cn(
              "md:hidden inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium",
              "transition-colors hover:bg-accent",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activeFilterCount > 0 && "border-primary text-primary",
            )}
          >
            <SlidersHorizontal aria-hidden="true" className="size-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span
                aria-hidden="true"
                className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground"
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Neighborhood mode header (P3-05)                                    */}
      {/* ------------------------------------------------------------------ */}
      {isNeighborhoodMode && (
        <NeighborhoodHeader
          title={focusedArtifactTitle}
          nodeId={focusedArtifactId ?? ""}
          onBack={handleBackToVault}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Degradation banner + view toggle when above threshold (P3-07)       */}
      {/* ------------------------------------------------------------------ */}
      {degraded && !isNeighborhoodMode && (
        <DegradedFallback
          sampled={sampled}
          aboveCap={displayNodes.length >= VAULT_GRAPH_NODE_CAP}
          totalNodeCount={totalNodeCount}
          nodes={displayNodes}
          activeView={fallbackView}
          onViewChange={setFallbackView}
          onViewNeighborhood={handleViewNeighborhood}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Three-column body: filter | canvas | legend                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 min-h-0 gap-4 items-stretch">
        {/* Left filter sidebar (P3-02, P3-03) — hidden on mobile */}
        {!isNeighborhoodMode && (
          <FilterSidebar
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeTypesChange={setNodeTypes}
            onEdgeTypesChange={setEdgeTypes}
            onClearAll={clearFilters}
          />
        )}

        {/* Main canvas area */}
        <section
          aria-label={
            isNeighborhoodMode
              ? `Neighborhood graph for ${focusedArtifactTitle ?? "artifact"}`
              : "Vault knowledge graph"
          }
          aria-busy={isLoading || isNeighborhoodLoading}
          className="flex flex-1 min-w-0 flex-col gap-3"
        >
          {/* Pagination bar (P3-04) — shown above graph */}
          {!isNeighborhoodMode && !isLoading && displayNodes.length > 0 && (
            <PaginationBar
              loaded={displayNodes.length}
              total={totalNodeCount}
              hasMore={hasMore}
              isFetchingMore={isFetchingMore}
              onNextPage={fetchNextPage}
              sampled={sampled}
            />
          )}

          {/* Graph canvas — shown when view is "graph" or neighborhood mode */}
          {(!degraded || isNeighborhoodMode || fallbackView === "graph") && (
            <>
              {/* Error state */}
              {isError && error && (
                <GraphError error={error} onRetry={refetch} />
              )}

              {/* Loading state */}
              {(isLoading || isNeighborhoodLoading) && !isError && (
                <div className="flex-1 rounded-lg border bg-muted/10 overflow-hidden">
                  <GraphCanvasSkeleton />
                </div>
              )}

              {/* Sigma graph canvas */}
              {!isLoading && !isNeighborhoodLoading && !isError && graph && (
                <>
                  {/* Skip link to sr fallback (P3-11) */}
                  <a
                    href="#graph-sr-fallback"
                    className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:left-2 focus:top-2 focus:rounded focus:bg-background focus:px-2 focus:py-1 focus:text-xs focus:font-medium focus:shadow"
                  >
                    Skip to graph node list
                  </a>

                  {/* Live region for keyboard-focused node label (P3-10) */}
                  <div
                    aria-live="polite"
                    aria-atomic="true"
                    className="sr-only"
                  >
                    {currentFocusedNode
                      ? `Focused: ${currentFocusedNode.title ?? currentFocusedNode.id}`
                      : ""}
                  </div>

                  <div
                    role="img"
                    aria-label={`Knowledge graph with ${displayNodes.length} nodes and ${displayEdges.length} edges. Use Tab to cycle nodes, arrow keys to pan, plus/minus to zoom, Enter to open detail.`}
                    tabIndex={0}
                    onKeyDown={handleKeyDown}
                    className={cn(
                      "relative flex-1 min-h-[400px] rounded-lg border bg-muted/10 overflow-hidden",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    )}
                  >
                    <SigmaContainer
                      graph={graph}
                      style={{ width: "100%", height: "100%" }}
                      settings={{
                        renderEdgeLabels: false,
                        defaultEdgeType: "arrow",
                        labelFont: "Inter, sans-serif",
                        labelSize: 10,
                        labelColor: { color: "#64748b" },
                        minCameraRatio: 0.05,
                        maxCameraRatio: 20,
                        // For large graphs, reduce label rendering
                        labelDensity: displayNodes.length > 500 ? 0.07 : 0.1,
                        labelGridCellSize: displayNodes.length > 500 ? 150 : 100,
                      }}
                    >
                      <GraphCanvasInner
                        nodes={displayNodes}
                        focusedNodeId={focusedNodeId}
                        onHover={setTooltip}
                        onSelect={setPopover}
                        onSigmaReady={handleSigmaReady}
                      />
                    </SigmaContainer>

                    <ZoomControls
                      onZoomIn={handleZoomIn}
                      onZoomOut={handleZoomOut}
                      onFitView={handleFitView}
                    />

                    {/* Tooltip (P3-06) */}
                    {tooltip && !popover && <GraphTooltip tooltip={tooltip} />}

                    {/* Popover (P3-06) */}
                    {popover && (
                      <GraphPopover
                        popover={popover}
                        onClose={() => setPopover(null)}
                        onViewNeighborhood={handleViewNeighborhood}
                      />
                    )}

                    {/* Sampling indicator */}
                    {sampled && !isNeighborhoodMode && (
                      <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50/90 px-2.5 py-1.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        <AlertTriangle aria-hidden="true" className="size-3" />
                        Showing a sample
                      </div>
                    )}
                  </div>

                  {/* Screen-reader fallback list (P3-11) */}
                  <div id="graph-sr-fallback">
                    <ScreenReaderFallback
                      nodes={displayNodes}
                      onViewNeighborhood={handleViewNeighborhood}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Taxonomy reference link (P3-06) */}
          <p className="text-[11px] text-muted-foreground/60">
            Node shapes + colors follow the{" "}
            <a
              href="/docs/architecture/artifact-taxonomy-reference"
              className="underline underline-offset-2 hover:text-muted-foreground transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
            >
              artifact taxonomy reference
            </a>
            .
          </p>
        </section>

        {/* Right legend panel (P3-06) */}
        <aside
          aria-label="Graph legend"
          className="hidden xl:flex xl:w-[220px] xl:shrink-0 xl:flex-col xl:gap-4"
        >
          <GraphLegend defaultExpanded className="sticky top-0" />
        </aside>
      </div>
    </div>
  );
}
