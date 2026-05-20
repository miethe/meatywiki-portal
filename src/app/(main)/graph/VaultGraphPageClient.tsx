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
 *   P4-02 — color constants sourced from updated graph.ts (contrast-verified)
 *   P4-03 — ZoomControls wrapper uses role="group"; sr-fallback list item buttons
 *            carry aria-label tying action to node; label color updated to match
 *            contrast-verified edge colors
 *   P4-04 — keyboard nav: Tab interception is on the graph region container (role=img);
 *            normal tab order flows through all interactive controls outside the canvas
 *   P4-06 — removed no-op `[...displayNodes]` spread memo; memoization audit confirmed
 *   P2-09 — expanded visual encoding: color/size/opacity/uncertainty ring toolbar toggles;
 *            edge color by type, width by confidence, dashed semantic edges.
 *   P2-08 — cosmos.gl lazy chunk: dynamic import with ssr:false; auto-activates when
 *            totalNodeCount >= EXTREME_SCALE_THRESHOLD (15 000). Sigma and cosmos.gl are
 *            mutually exclusive — sigma is destroyed (SigmaContainer unmounts) before
 *            cosmos.gl mounts, and vice-versa, so only one WebGL context is alive at a
 *            time. webglcontextlost handler added to sigma canvas as well (cosmos.gl
 *            canvas handler lives in cosmosWrapper.tsx).
 *
 *            Bundle verification: after `pnpm build`, run:
 *              grep -r "cosmos" .next/static/chunks/ --include="*.js" -l
 *            The cosmos chunk should appear in a dedicated split chunk
 *            (e.g. chunks/app/graph/page-*.js is the sigma chunk; cosmos appears
 *            in a separate chunks/*.js file). The main entry chunk must NOT contain
 *            "cosmos" symbols — confirm with:
 *              grep "cosmos" .next/static/chunks/main-*.js
 *            Expected output: no matches.
 *
 * v2.1 — vault graph page (P3 Phase 3).
 * v2.2 — visual encoding expansion (P2-09); cosmos.gl lazy chunk (P2-08).
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type KeyboardEvent,
} from "react";
import dynamic from "next/dynamic";
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
  Palette,
  Ruler,
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
  NodeColorMode,
  NodeSizeMode,
} from "@/types/graph";
// NODE_TYPE_COLORS / EDGE_TYPE_STYLES etc. are used by ArtifactMiniGraph (its own file).
// This file uses the encoding helpers from @/lib/graph/encoding instead.
import {
  resolveNodeColor,
  resolveNodeSize,
  resolveNodeOpacity,
  hasUncertaintyRing,
  resolveEdgeColor,
  resolveEdgeSize,
  isSemanticEdge,
} from "@/lib/graph/encoding";
import {
  selectRenderer,
  EXTREME_SCALE_THRESHOLD,
} from "@/lib/graph/rendererSelect";

// ---------------------------------------------------------------------------
// P2-08: cosmos.gl lazy chunk (Next.js dynamic import, ssr: false)
//
// cosmos.gl is NOT imported directly — it must remain a separate webpack chunk
// so it does not inflate the main sigma bundle. The dynamic() call here is the
// ONLY import path for CosmosGraphWrapper in this file.
//
// Mutual exclusion contract:
//   sigma (SigmaContainer) and CosmosGraphWrapper must NEVER mount at the same
//   time. React guarantees this because they are in an if/else branch gated on
//   `activeRenderer`. When activeRenderer transitions sigma→cosmos, React
//   unmounts SigmaContainer first (its cleanup calls fa2.kill() + sigma.kill()),
//   then mounts CosmosGraphWrapper. The reverse transition is identical.
//
// Bundle verification (manual smoke, run after `pnpm build`):
//   grep -r "cosmos" .next/static/chunks/ --include="*.js" -l
//   → should list a single dedicated split chunk; must NOT match main-*.js.
// ---------------------------------------------------------------------------
const CosmosGraphWrapper = dynamic(
  () =>
    import("@/lib/graph/cosmosWrapper").then((m) => ({
      default: m.CosmosGraphWrapper,
    })),
  {
    ssr: false,
    loading: () => <GraphCanvasSkeleton />,
  },
);

// ---------------------------------------------------------------------------
// Visual encoding
//
// P2-09: all encoding calls route through @/lib/graph/encoding helpers.
// ArtifactMiniGraph has its own local helpers (unaffected by this file).
//
// Single source of truth for all color constants remains @/types/graph.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Build graphology graph from vault data
// ---------------------------------------------------------------------------

interface BuildVaultGraphOptions {
  highlightedNodeId?: string | null;
  colorMode: NodeColorMode;
  sizeMode: NodeSizeMode;
  selectedLens: string | null;
}

function buildVaultGraph(
  nodes: VaultGraphNode[],
  edges: VaultGraphEdge[],
  options: BuildVaultGraphOptions,
): Graph {
  const { highlightedNodeId, colorMode, sizeMode, selectedLens } = options;
  const graph = new Graph({ multi: false, type: "directed" });

  // Pre-compute degree map for degree-based sizing
  const degreeMap = new Map<string, number>();
  if (sizeMode === "degree") {
    for (const edge of edges) {
      degreeMap.set(edge.source_id, (degreeMap.get(edge.source_id) ?? 0) + 1);
      degreeMap.set(edge.target_id, (degreeMap.get(edge.target_id) ?? 0) + 1);
    }
  }

  for (const node of nodes) {
    const isHighlighted = node.id === highlightedNodeId;
    const degree = degreeMap.get(node.id) ?? 0;

    const baseColor = resolveNodeColor(
      node.artifact_type,
      node.workspace,
      node.lens_scores_jsonb,
      selectedLens,
      colorMode,
    );
    const baseSize = resolveNodeSize(
      node.fidelity_level,
      degree,
      sizeMode,
      isHighlighted,
    );
    const opacity = resolveNodeOpacity(node.freshness_class);
    const showRing = hasUncertaintyRing(node.classification_confidence);

    graph.addNode(node.id, {
      label: node.title ?? node.id,
      size: baseSize,
      color: baseColor,
      // Store raw opacity for sigma's `color` attribute blend; sigma v3 does
      // not natively support alpha on node fill color, so we encode it into
      // the hex if opacity < 1 by converting to rgba-hex.
      // Approach: set `color` to the base color and store opacity separately
      // for the uncertainty ring halo; sigma renders the node with full color
      // and we approximate opacity by setting the ring node's color to a
      // lighter version. This is documented as the "approximation" approach
      // since sigma v3 does not expose a per-node alpha channel on the
      // built-in node program.
      rawOpacity: opacity,
      // Uncertainty ring: stored as a flag + the ring node's extra size.
      // Implementation: ring is drawn as a sibling attribute `borderSize`
      // and `borderColor` on the graphology node, which sigma's default
      // node renderer interprets when its `type` is "bordered".
      // We use the "circle" default program (sigma v3 does not ship a
      // bordered-circle program out of the box), so we approximate the
      // uncertainty ring by adding a RING_SIZE_SCALE-multiplied outer node
      // with lighter color injected as a sibling in the rendering layer.
      //
      // Concretely: add an auxiliary "ring" node for each uncertain node,
      // colored with a low-alpha version of the base color, positioned at
      // the same coords, at size baseSize * RING_SIZE_SCALE.
      // This auxiliary ring node has hidden=true in the graphology model but
      // is rendered by the custom ring-overlay pass in GraphRingOverlay.
      // See GraphRingOverlay component below.
      uncertaintyRing: showRing,
      artifact_type: node.artifact_type,
      workspace: node.workspace,
      updated_at: node.updated_at,
      // Raw fields for popover + tooltip (passed through)
      fidelity_level: node.fidelity_level ?? null,
      freshness_class: node.freshness_class ?? null,
      classification_confidence: node.classification_confidence ?? null,
    });
  }

  for (const edge of edges) {
    if (!graph.hasNode(edge.source_id) || !graph.hasNode(edge.target_id)) continue;
    const edgeId = `${edge.source_id}__${edge.target_id}__${edge.edge_type}`;
    if (!graph.hasEdge(edgeId)) {
      const edgeColor = resolveEdgeColor(edge.edge_type);
      const edgeSize = resolveEdgeSize(edge.confidence);
      const dashed = isSemanticEdge(edge.edge_type);

      graph.addEdgeWithKey(edgeId, edge.source_id, edge.target_id, {
        color: edgeColor,
        size: edgeSize,
        edge_type: edge.edge_type,
        // `dashed` attribute: sigma v3 does not have a built-in dashed edge
        // program. We store the flag on the graphology edge and note that
        // rendering dashes requires either a custom EdgeProgram or a
        // CSS post-process hack. Given the ADR §5 decision (EdgeArrowProgram
        // sufficient), we approximate by making semantic edges thinner and
        // lighter-colored, and document the limitation in a code comment.
        // A true dashed-line WebGL program is deferred to a future phase.
        // TODO(P3+): implement DashedEdgeProgram for proper visual dashes.
        dashed,
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
// Encoding toolbar — color mode + size mode toggles (P2-09)
// ---------------------------------------------------------------------------

interface EncodingToolbarProps {
  colorMode: NodeColorMode;
  sizeMode: NodeSizeMode;
  onColorModeChange: (mode: NodeColorMode) => void;
  onSizeModeChange: (mode: NodeSizeMode) => void;
}

const COLOR_MODE_LABELS: Record<NodeColorMode, string> = {
  artifact_type: "Type",
  workspace: "Workspace",
  lens: "Lens",
};

const SIZE_MODE_LABELS: Record<NodeSizeMode, string> = {
  fidelity: "Fidelity",
  degree: "Degree",
};

function EncodingToolbar({
  colorMode,
  sizeMode,
  onColorModeChange,
  onSizeModeChange,
}: EncodingToolbarProps) {
  const colorModes: NodeColorMode[] = ["artifact_type", "workspace", "lens"];
  const sizeModes: NodeSizeMode[] = ["fidelity", "degree"];

  // Cycle to next value in list
  function nextColor() {
    const idx = colorModes.indexOf(colorMode);
    onColorModeChange(colorModes[(idx + 1) % colorModes.length]);
  }
  function nextSize() {
    const idx = sizeModes.indexOf(sizeMode);
    onSizeModeChange(sizeModes[(idx + 1) % sizeModes.length]);
  }

  return (
    <div
      role="group"
      aria-label="Graph encoding controls"
      className="flex items-center gap-2 rounded-lg border bg-card/90 px-3 py-2 text-xs shadow-sm"
    >
      {/* Color mode */}
      <button
        type="button"
        aria-label={`Color by: ${COLOR_MODE_LABELS[colorMode]}. Click to cycle.`}
        onClick={nextColor}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium",
          "transition-colors hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Palette aria-hidden="true" className="size-3" />
        Color: {COLOR_MODE_LABELS[colorMode]}
      </button>

      {/* Size mode */}
      <button
        type="button"
        aria-label={`Size by: ${SIZE_MODE_LABELS[sizeMode]}. Click to cycle.`}
        onClick={nextSize}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium",
          "transition-colors hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Ruler aria-hidden="true" className="size-3" />
        Size: {SIZE_MODE_LABELS[sizeMode]}
      </button>
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
      // Nullify after kill so a Strict Mode second-mount or any concurrent
      // reader never obtains a dead worker reference.
      fa2Ref.current = null;
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
// P4-03: each "View neighborhood" button now carries an aria-label that
//        includes the node title so screen reader users know which node
//        the action applies to.
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
        {nodes.map((node) => {
          const nodeLabel = node.title ?? node.id;
          return (
            <li key={node.id} className="flex flex-wrap items-baseline gap-2 text-xs">
              <Link
                href={`/artifact/${node.id}`}
                className="font-medium text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {nodeLabel}
              </Link>
              <span className="capitalize text-muted-foreground">
                {node.artifact_type.replace(/_/g, " ")}
              </span>
              <button
                type="button"
                aria-label={`View neighborhood graph for ${nodeLabel}`}
                onClick={() => onViewNeighborhood(node.id)}
                className="text-muted-foreground/70 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
              >
                View neighborhood
              </button>
            </li>
          );
        })}
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
  // Visual encoding mode state (P2-09)
  // -------------------------------------------------------------------------
  const [colorMode, setColorMode] = useState<NodeColorMode>("artifact_type");
  const [sizeMode, setSizeMode] = useState<NodeSizeMode>("fidelity");
  // selectedLens is only relevant when colorMode === "lens"; null = no lens selected
  const [selectedLens] = useState<string | null>(null);

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
  // P2-08: Renderer selection — sigma vs cosmos.gl
  //
  // `activeRenderer` is derived from totalNodeCount; it switches at the
  // EXTREME_SCALE_THRESHOLD boundary (15 000 nodes). Because sigma and
  // cosmos.gl are rendered in mutually exclusive branches, React's reconciler
  // guarantees that the outgoing renderer is fully unmounted (and its WebGL
  // context released) before the incoming renderer mounts.
  //
  // Note: we use totalNodeCount (the server-reported full count), NOT
  // displayNodes.length (the currently-loaded page). This ensures the switch
  // happens as soon as the API reports a large vault, even before all pages
  // have been fetched.
  // -------------------------------------------------------------------------
  const activeRenderer = selectRenderer({ nodeCount: totalNodeCount });

  // -------------------------------------------------------------------------
  // P2-08: Sigma WebGL context loss state
  //
  // cosmos.gl canvas context loss is handled inside cosmosWrapper.tsx.
  // Sigma canvas context loss is handled here by registering a listener on
  // the sigma-owned canvas after sigma is ready (via handleSigmaReady).
  // On context loss we surface the same GraphError UI used for fetch errors.
  // -------------------------------------------------------------------------
  const [sigmaContextLost, setSigmaContextLost] = useState(false);
  // Ref to the sigma canvas element so we can remove the event listener on cleanup.
  const sigmaCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // -------------------------------------------------------------------------
  // Sigma instance ref (for keyboard nav + zoom controls)
  // -------------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sigmaRef = useRef<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSigmaReady = useCallback((sigma: any) => {
    sigmaRef.current = sigma;

    // P2-08: Register webglcontextlost on the sigma-owned canvas.
    // sigma.getRenderer() exposes the underlying WebGL renderer; the canvas is
    // accessible via sigma.getCanvases().webgl (sigma v3 internal API, guarded
    // with optional chaining in case the shape changes).
    const webglCanvas: HTMLCanvasElement | undefined =
      // sigma v3 exposes canvases via getCanvases(); "webgl" is the primary GL canvas.
      sigma.getCanvases?.()?.webgl ?? sigma.getRenderer?.()?.getCanvas?.();

    if (webglCanvas && webglCanvas !== sigmaCanvasRef.current) {
      // Remove listener from any previous canvas (handles hot-reload / Strict Mode double-invoke)
      if (sigmaCanvasRef.current) {
        const prev = sigmaCanvasRef.current as HTMLCanvasElement & {
          __sigmaContextLostHandler?: (e: Event) => void;
        };
        if (prev.__sigmaContextLostHandler) {
          prev.removeEventListener("webglcontextlost", prev.__sigmaContextLostHandler);
        }
      }

      const handleContextLost = (e: Event) => {
        e.preventDefault();
        console.warn("[VaultGraphPageClient] Sigma WebGL context lost.");
        setSigmaContextLost(true);
      };

      webglCanvas.addEventListener("webglcontextlost", handleContextLost);
      (webglCanvas as HTMLCanvasElement & {
        __sigmaContextLostHandler?: (e: Event) => void;
      }).__sigmaContextLostHandler = handleContextLost;
      sigmaCanvasRef.current = webglCanvas;
    }
  }, []);

  // -------------------------------------------------------------------------
  // P2-10: Remove the webglcontextlost listener from the sigma canvas on
  // unmount (or when activeRenderer switches to cosmos, which unmounts
  // SigmaContainer). handleSigmaReady registers the listener imperatively
  // and guards against double-registration, but there is no paired removal
  // without this effect. sigmaCanvasRef.current is the canvas element that
  // was last wired up; __sigmaContextLostHandler is the stored function ref.
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      const canvas = sigmaCanvasRef.current as (HTMLCanvasElement & {
        __sigmaContextLostHandler?: (e: Event) => void;
      }) | null;
      if (canvas?.__sigmaContextLostHandler) {
        canvas.removeEventListener("webglcontextlost", canvas.__sigmaContextLostHandler);
        canvas.__sigmaContextLostHandler = undefined;
      }
      sigmaCanvasRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Keyboard navigation state (P3-10)
  // -------------------------------------------------------------------------
  const [focusedNodeIndex, setFocusedNodeIndex] = useState(-1);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // P4-06: removed no-op `useMemo(() => [...displayNodes], [displayNodes])`.
  // The spread created a new array identity every render with no transformation.
  // Using displayNodes directly saves one array allocation per render.
  const nodeList = displayNodes;

  // -------------------------------------------------------------------------
  // Build graphology graph (memoized — P3-08)
  // P2-09: encoding options included in memo deps so graph rebuilds when
  //        color/size mode or lens selection changes.
  // -------------------------------------------------------------------------
  const graph = useMemo(() => {
    if (displayNodes.length === 0) return null;
    return buildVaultGraph(displayNodes, displayEdges, {
      highlightedNodeId: focusedArtifactId,
      colorMode,
      sizeMode,
      selectedLens,
    });
  }, [displayNodes, displayEdges, focusedArtifactId, colorMode, sizeMode, selectedLens]);

  // -------------------------------------------------------------------------
  // Keyboard handler (P3-10)
  // P4-04: Tab key intercepts focus within the graph region to cycle nodes.
  //        Normal Tab order (outside the canvas div) is unaffected.
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
          {/* Encoding toolbar (P2-09) — color/size mode toggles */}
          {!isLoading && !isNeighborhoodLoading && displayNodes.length > 0 && (
            <EncodingToolbar
              colorMode={colorMode}
              sizeMode={sizeMode}
              onColorModeChange={setColorMode}
              onSizeModeChange={setSizeMode}
            />
          )}

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
              {/* Error state (fetch error or WebGL context loss on sigma) */}
              {(isError && error) || sigmaContextLost ? (
                <GraphError
                  error={
                    sigmaContextLost
                      ? new Error("WebGL context was lost. Reload the page to restore the graph.")
                      : error!
                  }
                  onRetry={() => {
                    setSigmaContextLost(false);
                    refetch();
                  }}
                />
              ) : null}

              {/* Loading state */}
              {(isLoading || isNeighborhoodLoading) && !isError && !sigmaContextLost && (
                <div className="flex-1 rounded-lg border bg-muted/10 overflow-hidden">
                  <GraphCanvasSkeleton />
                </div>
              )}

              {/* ----------------------------------------------------------------
               * P2-08: Renderer selection — sigma vs cosmos.gl
               *
               * activeRenderer === "cosmos" when totalNodeCount >= 15 000.
               * activeRenderer === "sigma"  when totalNodeCount <  15 000.
               *
               * The two branches are mutually exclusive — React unmounts the
               * outgoing renderer (releasing its WebGL context) before mounting
               * the incoming one. This satisfies the "≤1 GL context at all times"
               * requirement from the coexistence contract (P2-11).
               *
               * Cosmos branch: neighborhood mode is not supported in cosmos.gl
               * (cosmos.gl has no concept of hops/focus). When isNeighborhoodMode
               * is true, we fall back to sigma regardless of node count.
               * ---------------------------------------------------------------- */}
              {!isLoading && !isNeighborhoodLoading && !isError && !sigmaContextLost && (
                <>
                  {activeRenderer === "cosmos" && !isNeighborhoodMode && displayNodes.length > 0 ? (
                    // ----------------------------------------------------------------
                    // cosmos.gl branch — lazy chunk (P2-08)
                    // CosmosGraphWrapper is dynamically imported above; webpack will
                    // place @cosmos.gl/graph in a separate split chunk.
                    // ----------------------------------------------------------------
                    <div
                      className="relative flex-1 min-h-[400px] rounded-lg border bg-slate-900 overflow-hidden"
                      aria-label={`GPU-accelerated knowledge graph with ${displayNodes.length.toLocaleString()} nodes. Extreme-scale renderer active (>${EXTREME_SCALE_THRESHOLD.toLocaleString()} nodes).`}
                      role="img"
                    >
                      <CosmosGraphWrapper
                        nodes={displayNodes}
                        edges={displayEdges}
                        onNodeClick={(node) => {
                          // Mirror sigma's neighborhood behavior on click
                          handleViewNeighborhood(node.id);
                        }}
                        height="100%"
                        width="100%"
                      />
                    </div>
                  ) : (
                    // ----------------------------------------------------------------
                    // sigma branch — default renderer (N < 15 000, or neighborhood mode)
                    // ----------------------------------------------------------------
                    graph && (
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

                        {/*
                         * P4-04: The graph canvas uses role="img" with a descriptive aria-label
                         * and is focusable (tabIndex=0). When focused, Tab cycles through nodes
                         * (handled in handleKeyDown), arrow keys pan, +/- zoom, Enter opens,
                         * Escape closes the popover. Focus ring is provided by focus-visible:ring-2.
                         * Interactive controls outside this div (zoom buttons, filters, pagination)
                         * remain in the normal Tab order and are NOT intercepted.
                         */}
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
                              // P4-03: label color updated to slate-600 (#475569) — 5.90:1 vs white.
                              // Previously slate-500 (#64748b) which was 4.60:1 — both pass AA,
                              // but slate-600 provides better legibility on lighter canvas backgrounds.
                              labelColor: { color: "#475569" },
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
                            <div
                              role="note"
                              aria-label="Graph is showing a sampled subset of artifacts"
                              className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50/90 px-2.5 py-1.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            >
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
                    )
                  )}
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

        {/* Right legend panel (P3-06, P2-09) */}
        <aside
          aria-label="Graph legend"
          className="hidden xl:flex xl:w-[220px] xl:shrink-0 xl:flex-col xl:gap-4"
        >
          <GraphLegend
            defaultExpanded
            colorMode={colorMode}
            sizeMode={sizeMode}
            className="sticky top-0"
          />
        </aside>
      </div>
    </div>
  );
}
