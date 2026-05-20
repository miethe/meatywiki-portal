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
 *   P4-01 — node_id deep-link: useEffect centers camera + soft-focus on mount
 *   P4-02 — Cmd-K search overlay (GraphSearchOverlay, client Fuse.js + server FTS5)
 *   P4-03 — search result selection → amber ring nodeReducer + camera animate + q chip
 *   P4-04 — rubber-band multi-select lasso (pointer events + viewportToGraph rect)
 *   P4-05 — right-click context menu (single-node 8 actions; multi-select 5 actions)
 *   P4-06 — viewpoints library: 7 default presets + user views in SavedViewsMenu
 *   P4-07 — full URL state model (buildUrl/parseUrl, ceiling guard, copy link, reset view)
 *   P4-08 — static/dynamic mode toggle (FA2 on-demand, 5s idle snapshot, reduced-motion)
 *   P4-09 — PNG/SVG export via sigma canvas toDataURL + legend overlay
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
import { useGraphFilterState } from "@/hooks/useGraphFilterState";
import { useArtifactNeighborhood } from "@/hooks/useArtifactNeighborhood";
import { FilterSidebar } from "@/components/graph/FilterSidebar";
import { GraphFilters, GRAPH_FILTERS_DEFAULT, type GraphFiltersValues } from "@/components/graph/GraphFilters";
import { GraphFilterChips } from "@/components/graph/GraphFilterChips";
import type { FilterDimKey } from "@/components/graph/filterChipFormatters";
import { SavedViewsMenu } from "@/components/graph/SavedViewsMenu";
import type { SavedView } from "@/lib/graph/savedViews";
import { DegradedFallback } from "@/components/graph/DegradedFallback";
import type { FallbackView } from "@/components/graph/DegradedFallback";
import { GraphCanvasOverlay } from "@/components/graph/GraphCanvasOverlay";
import { GraphLegend } from "@/components/shared/GraphLegend";
import type {
  VaultGraphNode,
  VaultGraphEdge,
  NodeColorMode,
  NodeSizeMode,
} from "@/types/graph";
// NODE_TYPE_COLORS / EDGE_TYPE_STYLES etc. are used by ArtifactMiniGraph (its own file).
// This file uses the encoding helpers from @/lib/graph/encoding instead.
import { useClientFilters } from "@/hooks/useClientFilters";
import { useGraphSearch } from "@/hooks/useGraphSearch";
import { useGroupingMode } from "@/hooks/useGroupingMode";
import { useClusterAssignment } from "@/hooks/useClusterAssignment";
import {
  useClusterExpandCollapse,
  isSuperNode,
  clusterIdFromSuperNode,
} from "@/hooks/useClusterExpandCollapse";
import { ClusterHalos } from "@/components/graph/ClusterHalos";
import {
  createRampedModuleForce,
  isCentroidForceModeActive,
} from "@/lib/graph/createModuleForce";
import { GraphGroupingSelector } from "@/components/graph/GraphGroupingSelector";
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
import { GraphSearchOverlay, recordRecentNode } from "@/components/graph/GraphSearchOverlay";
import type { GraphSearchResult } from "@/components/graph/GraphSearchOverlay";
import { GraphContextMenu } from "@/components/graph/GraphContextMenu";
import { GraphShareModal } from "@/components/graph/GraphShareModal";
import {
  buildUrl,
  parseUrl,
  type GraphMode,
  type FocusMode as UrlFocusMode,
} from "@/lib/graph/urlState";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  Share2,
  Download,
  Layers,
  Activity,
} from "lucide-react";

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
  /** P3-11: called when user clicks a super-node to expand the collapsed cluster. */
  onExpandCluster: (clusterId: string) => void;
  /** P4-08: expose FA2 worker ref so parent can start/stop for static/dynamic toggle */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onFa2WorkerReady?: (worker: any) => void;
}

function GraphEvents({ nodes, onHover, onSelect, focusedNodeId, onExpandCluster, onFa2WorkerReady }: GraphEventsProps) {
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
    // P4-08: expose worker to parent for static/dynamic mode toggle
    onFa2WorkerReady?.(fa2);

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
      // Clear parent ref too
      onFa2WorkerReady?.(null);
    };
  }, [sigma, onFa2WorkerReady]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // P3-11: super-node click expands the collapsed cluster.
        if (isSuperNode(node)) {
          onExpandCluster(clusterIdFromSuperNode(node));
          return;
        }
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
  /** P3-04: client-side filter dims (8–14); applied without refetch. */
  filterValues: GraphFiltersValues;
  /** P3-05: free-text query from GraphFiltersValues.q. */
  searchQuery: string;
  /** P3-05: callback when server FTS5 fallback is needed (or null to cancel). */
  onServerSearchNeededAction: (q: string | null) => void;
  /** P3-09: active grouping mode; drives cluster_id assignment on each node. */
  groupingMode: import("@/lib/graph/groupingModes").GroupingMode;
  /** P3-11: called when user clicks a super-node to expand the collapsed cluster. */
  onExpandCluster: (clusterId: string) => void;
  /** P4-08: expose FA2 worker ref for static/dynamic mode toggle */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onFa2WorkerReady?: (worker: any) => void;
}

function GraphCanvasInner({
  nodes,
  focusedNodeId,
  onHover,
  onSelect,
  onSigmaReady,
  filterValues,
  searchQuery,
  onServerSearchNeededAction,
  groupingMode,
  onExpandCluster,
  onFa2WorkerReady,
}: GraphCanvasInnerProps) {
  const sigma = useSigma();
  useEffect(() => { onSigmaReady(sigma); }, [sigma, onSigmaReady]);

  // P3-04: apply client-side dims 8–14 by toggling graphology `hidden` attr.
  // useClientFilters must be called inside SigmaContainer so useSigma() resolves.
  useClientFilters(filterValues);

  // P3-05: hybrid free-text search — Fuse.js (≤2K nodes) + server FTS5 fallback.
  // Must be called inside SigmaContainer so useSigma() resolves.
  useGraphSearch({ query: searchQuery, nodes, onServerSearchNeededAction });

  // P3-09: assign cluster_id to each node based on the active grouping mode.
  // Called inside SigmaContainer so useSigma() resolves correctly.
  useClusterAssignment(groupingMode);

  // P3-10: centroid-pull force via RAF loop (workspace + project modes only).
  //
  // FA2 runs as a Web Worker (graphology-layout-forceatlas2/worker) and does not
  // expose a mid-tick plugin-force API. We therefore run a separate RAF loop that
  // reads graphology node positions (which FA2 updates through graphology's shared
  // attribute store), applies centroid forces, and re-writes positions. The loop
  // self-terminates after the FA2 settle timeout (~1.5–2.5 s) by tracking the
  // running flag below.
  useEffect(() => {
    if (!isCentroidForceModeActive(groupingMode)) return;

    const graph = sigma.getGraph();
    if (!graph || graph.order === 0) return;

    const force = createRampedModuleForce(graph, { targetStrength: 0.3, rampMs: 500 });
    force.start();

    let rafId: number;
    let running = true;

    const loop = () => {
      if (!running) return;
      force.tick();
      sigma.refresh();
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    // Match FA2 settle time: stop the RAF loop when FA2 would have settled.
    // (FA2 itself is started in GraphEvents; we mirror the settle window here.)
    const isLarge = graph.order > 500;
    const settleMs = isLarge ? 1500 : 2500;
    const stopTimer = setTimeout(() => {
      running = false;
      force.stop();
    }, settleMs + 200); // +200ms grace past FA2 settle

    return () => {
      running = false;
      force.stop();
      cancelAnimationFrame(rafId);
      clearTimeout(stopTimer);
    };
  }, [sigma, groupingMode]);

  return (
    <GraphEvents
      nodes={nodes}
      onHover={onHover}
      onSelect={onSelect}
      focusedNodeId={focusedNodeId}
      onExpandCluster={onExpandCluster}
      onFa2WorkerReady={onFa2WorkerReady}
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
  // P3-03: 16-dimension filter state — URL-backed via useGraphFilterState.
  // Server dims (1-7) are wired to useVaultGraph; client dims (8-14) pass
  // through to GraphFilters and will be consumed by P3-04's client filter.
  // -------------------------------------------------------------------------
  const {
    values: graphFilterValues,
    setFilter: setGraphFilter,
    isPending: isFilterPending,
    resetAll: resetAllFilters,
  } = useGraphFilterState();

  // -------------------------------------------------------------------------
  // P3-05: server FTS5 search query state.
  // useGraphSearch calls onServerSearchNeeded when a server fallback is
  // required; we store the query here and pass it to useVaultGraph so a
  // re-fetch is triggered with the `?q=` param.
  // -------------------------------------------------------------------------
  const [serverSearchQuery, setServerSearchQuery] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Vault graph data — server-side filter dims passed so refetch triggers.
  // P3-05: serverSearchQuery (FTS5 fallback) included in params.
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
  } = useVaultGraph({
    ws:           graphFilterValues.ws,
    types:        graphFilterValues.types,
    edges:        graphFilterValues.edges,
    freshness:    graphFilterValues.freshness,
    project:      graphFilterValues.project,
    domain:       graphFilterValues.domain,
    date_from:    graphFilterValues.date_from,
    date_to:      graphFilterValues.date_to,
    updated_from: graphFilterValues.updated_from,
    updated_to:   graphFilterValues.updated_to,
    // P3-05: only pass to API when server fallback is active; undefined otherwise.
    q:            serverSearchQuery ?? undefined,
  });

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

  // -------------------------------------------------------------------------
  // P3-03: Derive facet option lists from loaded nodes.
  //
  // The v2.2 VaultGraphResponse does not carry facet aggregates (follow-up
  // work required on backend — see P3-03 deferred note). We derive distinct
  // values from the loaded node attributes. This gives correct counts for the
  // currently-loaded page(s); counts will grow as further pages load.
  // -------------------------------------------------------------------------
  const filterOptions = useMemo(() => {
    const projectSet  = new Map<string, number>();
    const domainSet   = new Map<string, number>();
    const tagsSet     = new Map<string, number>();

    for (const node of nodes) {
      for (const p of (node.project ?? [])) {
        projectSet.set(p, (projectSet.get(p) ?? 0) + 1);
      }
      for (const d of (node.domain ?? [])) {
        domainSet.set(d, (domainSet.get(d) ?? 0) + 1);
      }
      for (const t of (node.tags ?? [])) {
        tagsSet.set(t, (tagsSet.get(t) ?? 0) + 1);
      }
    }

    return {
      project: Array.from(projectSet.entries()).map(([value, count]) => ({
        value,
        label: value,
        count,
      })),
      domain: Array.from(domainSet.entries()).map(([value, count]) => ({
        value,
        label: value,
        count,
      })),
      tags: Array.from(tagsSet.entries()).map(([value, count]) => ({
        value,
        label: value,
        count,
      })),
    };
  }, [nodes]);

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
  // Saved views — active camera preset name (P3-06)
  // Tracks which named camera preset is currently active so SavedViewsMenu can
  // snapshot it. Camera is applied imperatively via sigmaRef; we mirror the
  // name here so we can serialize it into a saved view.
  // -------------------------------------------------------------------------
  const [activeCameraPreset, setActiveCameraPreset] = useState<string | null>("default");

  // -------------------------------------------------------------------------
  // P3-09: Grouping mode — URL-backed via useGroupingMode.
  // -------------------------------------------------------------------------
  const { mode: groupingMode, setMode: setGroupingMode } = useGroupingMode();

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
  // P3-11: Cluster expand/collapse state machine.
  //
  // Must be declared AFTER the `graph` useMemo above so TypeScript can see the
  // graph type. Passed `graph` so the hook can read cluster_id attributes and
  // write clusterHidden + super-nodes. `graph` is null before the first render
  // and in cosmos renderer mode (where clustering is a visual no-op).
  // -------------------------------------------------------------------------
  const {
    expanded: expandedClusters,
    expand: expandCluster,
    collapse: collapseCluster,
    syncClusters,
  } = useClusterExpandCollapse(graph);

  // Sync clusters whenever grouping mode changes (new cluster_id assignments
  // land via useClusterAssignment inside SigmaContainer).
  useEffect(() => {
    if (graph && groupingMode !== "none" && groupingMode !== "semantic_cluster") {
      syncClusters(graph);
    }
  }, [graph, groupingMode, syncClusters]);

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
  // Saved views — apply view handler (P3-06)
  // -------------------------------------------------------------------------
  const handleApplyView = useCallback(
    (view: SavedView) => {
      // Apply filter state
      setGraphFilter(view.filter);

      // Apply camera preset (animates sigma camera imperatively)
      if (view.cameraPreset && sigmaRef.current) {
        // Camera preset application: animate to the named preset state.
        // The named preset string maps to cameraPresets entries (see cameraPresets.ts).
        // We use a direct camera reset to "default" for the common case; the full
        // cameraPresets map integration requires the graph reference which lives in
        // GraphEventsController. For now we reset the camera on view apply and log
        // the intended preset — full preset dispatch can be wired when P3-09 ships
        // and both graph + sigma refs are exposed at this level.
        if (view.cameraPreset === "default") {
          sigmaRef.current.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 400 });
        } else {
          // For non-default named presets, reset to default and log.
          // Full preset dispatch requires graph ref; deferred until P3-09 refactor.
          sigmaRef.current.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 400 });
          console.info(
            `[SavedViews] Camera preset "${view.cameraPreset}" requested — full preset dispatch deferred to P3-09.`,
          );
        }
        setActiveCameraPreset(view.cameraPreset);
      }

      // P3-09: apply grouping mode from saved view
      if (view.grouping) {
        setGroupingMode(
          view.grouping as import("@/lib/graph/groupingModes").GroupingMode,
        );
      } else {
        setGroupingMode("none");
      }
    },
    [setGraphFilter, setGroupingMode],
  );

  // -------------------------------------------------------------------------
  // Mobile filters drawer
  // -------------------------------------------------------------------------
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // -------------------------------------------------------------------------
  // P3-07: Filter sidebar open state (controlled so chips can open it).
  // We start uncontrolled (FilterSidebar uses its own breakpoint default),
  // but chips clicking "Focus filter panel" forces it open.
  // -------------------------------------------------------------------------
  const [sidebarOpen, setSidebarOpen] = useState<boolean | undefined>(undefined);

  // P3-07: onFocusFilterPanel — opens sidebar and scrolls to the dim anchor.
  const handleFocusFilterPanel = useCallback((key: FilterDimKey) => {
    setSidebarOpen(true);
    // Defer to next frame so the sidebar has time to open before scrollIntoView.
    requestAnimationFrame(() => {
      const anchor = document.querySelector(`[data-filter-dim="${key}"]`);
      anchor?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  // -------------------------------------------------------------------------
  // Active filter count badge
  // -------------------------------------------------------------------------
  // P3-03: count active server-side dims (dims 1-7 + free-text).
  // Client dims (8-14) will be added by P3-04.
  const activeFilterCount = (
    (graphFilterValues.ws.length        > 0 ? 1 : 0) +
    (graphFilterValues.types.length     > 0 ? 1 : 0) +
    (graphFilterValues.edges.length     > 0 ? 1 : 0) +
    (graphFilterValues.freshness.length > 0 ? 1 : 0) +
    (graphFilterValues.project.length   > 0 ? 1 : 0) +
    (graphFilterValues.domain.length    > 0 ? 1 : 0) +
    (graphFilterValues.date_from || graphFilterValues.date_to ||
     graphFilterValues.updated_from || graphFilterValues.updated_to ? 1 : 0) +
    (graphFilterValues.q                     ? 1 : 0)
  );

  // -------------------------------------------------------------------------
  // P3-08: hasActiveFilters — true when any dim deviates from its default.
  // Derived from activeFilterCount (already includes all server dims + q).
  // Client dims (8-14) are not yet counted; they will extend this in P3-04.
  // -------------------------------------------------------------------------
  const hasActiveFilters = activeFilterCount > 0;

  // -------------------------------------------------------------------------
  // P3-08: onClearAll — resets all filter state to GRAPH_FILTERS_DEFAULT.
  // -------------------------------------------------------------------------
  const handleOverlayClearAll = resetAllFilters;

  // -------------------------------------------------------------------------
  // P3-07: onClearDim — resets one filter dimension to its default value.
  // Multi-key dims (date_range uses date_from as primary key) need special handling.
  // -------------------------------------------------------------------------
  const handleClearFilterDim = useCallback((key: FilterDimKey) => {
    if (key === "date_from") {
      // date_range dim covers 4 keys: date_from, date_to, updated_from, updated_to
      setGraphFilter({
        date_from:    GRAPH_FILTERS_DEFAULT.date_from,
        date_to:      GRAPH_FILTERS_DEFAULT.date_to,
        updated_from: GRAPH_FILTERS_DEFAULT.updated_from,
        updated_to:   GRAPH_FILTERS_DEFAULT.updated_to,
      });
    } else if (key === "fscore_min") {
      setGraphFilter({
        fscore_min: GRAPH_FILTERS_DEFAULT.fscore_min,
        fscore_max: GRAPH_FILTERS_DEFAULT.fscore_max,
      });
    } else if (key === "conf_min") {
      setGraphFilter({
        conf_min: GRAPH_FILTERS_DEFAULT.conf_min,
        conf_max: GRAPH_FILTERS_DEFAULT.conf_max,
      });
    } else {
      // Single-key dims — cast is safe: key is a valid FilterDimKey
      setGraphFilter({ [key]: GRAPH_FILTERS_DEFAULT[key] } as Partial<GraphFiltersValues>);
    }
  }, [setGraphFilter]);

  // -------------------------------------------------------------------------
  // P4-07: URL state integration — router + pathname for buildUrl/parseUrl
  // -------------------------------------------------------------------------
  const router = useRouter();
  const pathname = usePathname();

  // -------------------------------------------------------------------------
  // P4-08: Static / dynamic mode
  //
  // Default: static (respects prefers-reduced-motion: reduce).
  // URL param: mode=static|dynamic
  // -------------------------------------------------------------------------
  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : true;

  const [graphMode, setGraphMode] = useState<GraphMode>(() => {
    // Hydrate from URL on first mount
    if (typeof window === "undefined") return "static";
    const { state } = parseUrl(window.location.search);
    if (state.mode === "dynamic" && !prefersReducedMotion) return "dynamic";
    return "static";
  });

  // Auto-snapshot: capture layout to layoutCache after 5s idle in dynamic→static
  const idleSnapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fa2WorkerRef = useRef<import("graphology-layout-forceatlas2/worker").default | null>(null);

  // Capture reference to the FA2 worker from GraphEvents (set via callback)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFa2WorkerReady = useCallback((worker: any) => {
    fa2WorkerRef.current = worker;
  }, []);

  function handleToggleMode() {
    setGraphMode((prev) => {
      const next = prev === "static" ? "dynamic" : "static";
      if (next === "dynamic") {
        // Start FA2
        fa2WorkerRef.current?.start();
        // Clear any pending idle snapshot
        if (idleSnapshotTimerRef.current) {
          clearTimeout(idleSnapshotTimerRef.current);
          idleSnapshotTimerRef.current = null;
        }
      } else {
        // Stop FA2 + schedule idle snapshot in 5s
        fa2WorkerRef.current?.stop();
        idleSnapshotTimerRef.current = setTimeout(() => {
          // Positions are already in sigma/graphology; sigma.refresh() persists them
          sigmaRef.current?.refresh();
        }, 5000);
      }
      return next;
    });
  }

  // Cleanup idle timer on unmount
  useEffect(() => {
    return () => {
      if (idleSnapshotTimerRef.current) clearTimeout(idleSnapshotTimerRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // P4-01: Deep-link node_id — center camera + soft focus k=1 on mount
  //
  // Runs once on mount after sigma is ready. sigmaRef.current is populated
  // by handleSigmaReady which fires from GraphCanvasInner's useEffect.
  // We watch sigmaRef + displayNodes (wait for graph to load) rather than
  // just mount, because sigma may not have display data until after layout.
  // -------------------------------------------------------------------------
  const deepLinkAppliedRef = useRef(false);

  useEffect(() => {
    if (deepLinkAppliedRef.current) return;
    if (!sigmaRef.current) return;
    if (displayNodes.length === 0) return;

    const { state: urlState } = parseUrl(
      typeof window !== "undefined" ? window.location.search : "",
    );
    const targetId = urlState.node_id;
    if (!targetId) return;

    const sigma = sigmaRef.current;
    const graphInstance = sigma.getGraph?.();
    if (!graphInstance?.hasNode(targetId)) return;

    deepLinkAppliedRef.current = true;

    // (a) Center camera on target node
    const displayData = sigma.getNodeDisplayData(targetId);
    if (displayData) {
      const reducedMotion = prefersReducedMotion;
      if (reducedMotion) {
        sigma.getCamera().setState({ x: displayData.x, y: displayData.y, ratio: 0.5 });
      } else {
        sigma.getCamera().animate(
          { x: displayData.x, y: displayData.y, ratio: 0.5 },
          { duration: 400 },
        );
      }
    }

    // (b) Soft focus: k=1 neighborhood at full opacity, dim others to 0.5
    const neighbors = new Set<string>(graphInstance.neighbors(targetId));
    neighbors.add(targetId);

    sigma.setSetting("nodeReducer", (nodeId: string, data: Record<string, unknown>) => {
      if (neighbors.has(nodeId)) return data;
      return { ...data, opacity: 0.5 };
    });
    sigma.refresh();

    // Apply focus mode in URL state if present
    if (urlState.focus_mode && urlState.focus_mode !== "off") {
      // Defer to next tick so graph is stable
      setTimeout(() => {
        setFocusedArtifactId(targetId);
        const node = displayNodes.find((n) => n.id === targetId);
        setFocusedArtifactTitle(node?.title ?? null);
      }, 0);
    }
  }, [sigmaRef, displayNodes, prefersReducedMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // P4-04: Multi-select state + rubber-band lasso
  // -------------------------------------------------------------------------
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());

  // Lasso state
  const [lasso, setLasso] = useState<{
    active: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only start lasso on primary button (left-click) when not on a node
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // Don't start lasso if clicking on a UI overlay element
      if (target.closest("button, a, [role=button]")) return;

      setLasso({
        active: false, // becomes true once drag threshold is exceeded
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });
    },
    [],
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!lasso) return;
      const dx = Math.abs(e.clientX - lasso.startX);
      const dy = Math.abs(e.clientY - lasso.startY);
      const threshold = 5;
      setLasso((prev) => prev && {
        ...prev,
        active: prev.active || (dx > threshold || dy > threshold),
        currentX: e.clientX,
        currentY: e.clientY,
      });
    },
    [lasso],
  );

  const handleCanvasPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!lasso || !lasso.active) {
        setLasso(null);
        return;
      }

      // Compute rect in container-local coords
      if (!canvasContainerRef.current || !sigmaRef.current) {
        setLasso(null);
        return;
      }

      const rect = canvasContainerRef.current.getBoundingClientRect();
      const x1 = Math.min(lasso.startX, e.clientX) - rect.left;
      const x2 = Math.max(lasso.startX, e.clientX) - rect.left;
      const y1 = Math.min(lasso.startY, e.clientY) - rect.top;
      const y2 = Math.max(lasso.startY, e.clientY) - rect.top;

      const sigma = sigmaRef.current;
      const graph = sigma.getGraph?.();
      if (!graph) {
        setLasso(null);
        return;
      }

      // Convert viewport corners to graph space
      const topLeft = sigma.viewportToGraph({ x: x1, y: y1 });
      const bottomRight = sigma.viewportToGraph({ x: x2, y: y2 });

      const minGraphX = Math.min(topLeft.x, bottomRight.x);
      const maxGraphX = Math.max(topLeft.x, bottomRight.x);
      const minGraphY = Math.min(topLeft.y, bottomRight.y);
      const maxGraphY = Math.max(topLeft.y, bottomRight.y);

      const selected = new Set<string>();
      graph.forEachNode((nodeId: string) => {
        const display = sigma.getNodeDisplayData(nodeId);
        if (!display) return;
        if (
          display.x >= minGraphX &&
          display.x <= maxGraphX &&
          display.y >= minGraphY &&
          display.y <= maxGraphY
        ) {
          selected.add(nodeId);
        }
      });

      setSelectedNodeIds((prev) => {
        if (e.shiftKey) {
          const next = new Set(prev);
          for (const id of selected) next.add(id);
          return next;
        }
        return selected;
      });

      // Apply amber ring to selected nodes
      if (selected.size > 0) {
        sigma.setSetting("nodeReducer", (nodeId: string, data: Record<string, unknown>) => {
          if (selected.has(nodeId)) {
            return { ...data, borderColor: "#d97706", borderSize: 3 };
          }
          return data;
        });
        sigma.refresh();
      }

      setLasso(null);
    },
    [lasso],
  );

  // -------------------------------------------------------------------------
  // P4-05: Context menu state
  // -------------------------------------------------------------------------
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);

  const handleContextMenuAction = {
    onFocusMode: useCallback((mode: UrlFocusMode, nodeId: string) => {
      setFocusedArtifactId(nodeId);
      const node = displayNodes.find((n) => n.id === nodeId);
      setFocusedArtifactTitle(node?.title ?? null);
    }, [displayNodes, setFocusedArtifactId, setFocusedArtifactTitle]),

    onAddToFocus: useCallback((nodeId: string) => {
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        next.add(nodeId);
        return next;
      });
    }, []),

    onLockToFocus: useCallback((nodeId: string) => {
      const urlStr = buildUrl(pathname, {
        node_id: nodeId,
        focus_mode: "upstream",
        focus_k: 2,
        mode: graphMode,
      });
      void navigator.clipboard.writeText(
        typeof window !== "undefined" ? window.location.origin + urlStr : urlStr
      );
    }, [pathname, graphMode]),

    onSelectNeighbors: useCallback((nodeId: string) => {
      if (!sigmaRef.current) return;
      const graph = sigmaRef.current.getGraph?.();
      if (!graph) return;
      const neighbors = new Set<string>(graph.neighbors(nodeId));
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        for (const id of neighbors) next.add(id);
        return next;
      });
    }, []),

    onFilterToSelection: useCallback((nodeIds: string[]) => {
      // Set node IDs as a transient filter — wired as workspace filter if all same workspace
      // For now, set q to the first node title as a lightweight proxy
      const first = displayNodes.find((n) => nodeIds.includes(n.id));
      if (first?.title) setGraphFilter({ q: first.title });
    }, [displayNodes, setGraphFilter]),

    onCompareLensScores: useCallback((..._args: [string[]]) => {
      // TODO: wire to compare panel when it ships in P5
      void _args;
      console.info("[P4-05] Compare lens scores — deferred to P5");
    }, []),
  };

  // -------------------------------------------------------------------------
  // P4-02: Search overlay state
  // -------------------------------------------------------------------------
  const [searchOpen, setSearchOpen] = useState(false);

  // Global keyboard shortcut: Cmd-K / Ctrl-K opens search overlay
  useEffect(() => {
    function handler(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "/" && !searchOpen) {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [searchOpen]);

  // P4-03: Handle search result selection
  const handleSearchResultSelect = useCallback(
    (result: GraphSearchResult) => {
      // Record in recent
      recordRecentNode({
        id: result.id,
        title: result.title,
        artifact_type: result.artifact_type,
      });

      // Populate q in FilterState → adds chip
      setGraphFilter({ q: result.title ?? result.id });

      // Animate camera to node if it's in the graph
      if (result.inGraph && sigmaRef.current) {
        const sigma = sigmaRef.current;
        const displayData = sigma.getNodeDisplayData(result.id);
        if (displayData) {
          if (prefersReducedMotion) {
            sigma.getCamera().setState({ x: displayData.x, y: displayData.y, ratio: 0.5 });
          } else {
            sigma.getCamera().animate(
              { x: displayData.x, y: displayData.y, ratio: 0.5 },
              { duration: 400 },
            );
          }
        }
        // Apply amber ring to matched node
        sigma.setSetting("nodeReducer", (nodeId: string, data: Record<string, unknown>) => {
          if (nodeId === result.id) {
            return { ...data, borderColor: "#d97706", borderSize: 3 };
          }
          return data;
        });
        sigma.refresh();
      }
    },
    [setGraphFilter, prefersReducedMotion],
  );

  // -------------------------------------------------------------------------
  // P4-07: Share modal + copy link
  // -------------------------------------------------------------------------
  const [shareModalOpen, setShareModalOpen] = useState(false);

  function buildCurrentUrl(): { url: string; isCeilingGuard: boolean } {
    if (typeof window === "undefined") return { url: "", isCeilingGuard: false };
    const fullUrl = buildUrl(pathname, {
      node_id: focusedArtifactId ?? undefined,
      grouping: groupingMode as import("@/lib/graph/urlState").GroupingMode,
      mode: graphMode,
      filters: {
        ws: graphFilterValues.ws,
        types: graphFilterValues.types,
        edges: graphFilterValues.edges,
        freshness: graphFilterValues.freshness,
        project: graphFilterValues.project,
        domain: graphFilterValues.domain,
        date_from: graphFilterValues.date_from ?? undefined,
        date_to: graphFilterValues.date_to ?? undefined,
        q: graphFilterValues.q ?? undefined,
        fidelity_min: graphFilterValues.fidelity_min ?? undefined,
        conf_min: graphFilterValues.conf_min ?? undefined,
        conf_max: graphFilterValues.conf_max ?? undefined,
      },
    });
    const isCeilingGuard = fullUrl.includes("state_hash=");
    return { url: window.location.origin + fullUrl, isCeilingGuard };
  }

  function handleResetView() {
    resetAllFilters();
    setGraphMode("static");
    setFocusedArtifactId(null);
    setFocusedArtifactTitle(null);
    setSelectedNodeIds(new Set());
    router.replace(pathname);
  }

  // -------------------------------------------------------------------------
  // P4-09: PNG/SVG export
  // -------------------------------------------------------------------------
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPng = useCallback(async () => {
    if (!sigmaRef.current) return;
    setIsExporting(true);
    try {
      const sigma = sigmaRef.current;
      // Try sigma v3 capturePNG() first; fall back to toDataURL on the webgl canvas.
      // sigmaRef.current is typed as `any` (established convention in this file).
      let dataUrl: string | null = null;
      if (typeof sigma.capturePNG === "function") {
        dataUrl = (await sigma.capturePNG()) as string;
      } else {
        const canvas = sigma.getCanvases?.()?.webgl ?? sigma.getRenderer?.()?.getCanvas?.();
        if (canvas) dataUrl = canvas.toDataURL("image/png");
      }
      if (dataUrl) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `graph-export-${Date.now()}.png`;
        a.click();
      }
    } catch (err) {
      console.warn("[P4-09] PNG export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleExportSvg = useCallback(async () => {
    if (!sigmaRef.current) return;
    setIsExporting(true);
    try {
      const sigma = sigmaRef.current;
      const graph = sigma.getGraph?.();
      if (!graph) return;

      // Build minimal SVG from node positions
      const dims = sigma.getDimensions();
      const W = dims.width;
      const H = dims.height;

      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n`;
      svgContent += `<rect width="${W}" height="${H}" fill="#0f172a"/>\n`;

      // Edges
      graph.forEachEdge((_edgeId: string, attrs: Record<string, unknown>, src: string, tgt: string) => {
        const s = sigma.graphToViewport(sigma.getNodeDisplayData(src) ?? { x: 0, y: 0 });
        const t = sigma.graphToViewport(sigma.getNodeDisplayData(tgt) ?? { x: 0, y: 0 });
        const color = (attrs.color as string) ?? "#64748b";
        svgContent += `<line x1="${s.x.toFixed(1)}" y1="${s.y.toFixed(1)}" x2="${t.x.toFixed(1)}" y2="${t.y.toFixed(1)}" stroke="${color}" stroke-width="1" stroke-opacity="0.4"/>\n`;
      });

      // Nodes
      graph.forEachNode((nodeId: string, attrs: Record<string, unknown>) => {
        const disp = sigma.graphToViewport(sigma.getNodeDisplayData(nodeId) ?? { x: 0, y: 0 });
        const color = (attrs.color as string) ?? "#6366f1";
        const size = ((attrs.size as number) ?? 5);
        const label = (attrs.label as string) ?? nodeId;
        svgContent += `<circle cx="${disp.x.toFixed(1)}" cy="${disp.y.toFixed(1)}" r="${size}" fill="${color}"/>\n`;
        if (size > 6) {
          svgContent += `<text x="${disp.x.toFixed(1)}" y="${(disp.y + size + 10).toFixed(1)}" font-size="8" fill="#e2e8f0" text-anchor="middle" font-family="sans-serif">${label.slice(0, 20)}</text>\n`;
        }
      });

      svgContent += `</svg>`;
      const blob = new Blob([svgContent], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `graph-export-${Date.now()}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("[P4-09] SVG export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Currently focused node label (for screen-reader live region)
  // -------------------------------------------------------------------------
  const currentFocusedNode = focusedNodeId
    ? nodeList.find((n) => n.id === focusedNodeId)
    : null;

  // -------------------------------------------------------------------------
  // Lasso rect geometry for CSS overlay
  // -------------------------------------------------------------------------
  const lassoRect = lasso?.active
    ? {
        left: Math.min(lasso.startX, lasso.currentX),
        top: Math.min(lasso.startY, lasso.currentY),
        width: Math.abs(lasso.currentX - lasso.startX),
        height: Math.abs(lasso.currentY - lasso.startY),
      }
    : null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const { url: shareUrl, isCeilingGuard: shareIsCeilingGuard } = shareModalOpen
    ? buildCurrentUrl()
    : { url: "", isCeilingGuard: false };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      {/* P4-02: Cmd-K search overlay */}
      <GraphSearchOverlay
        open={searchOpen}
        onCloseAction={() => setSearchOpen(false)}
        loadedNodes={displayNodes}
        onSelectResultAction={handleSearchResultSelect}
      />

      {/* P4-05: Right-click context menu */}
      {contextMenu && (() => {
        const nodeInfo = displayNodes.find((n) => n.id === contextMenu.nodeId);
        if (!nodeInfo) return null;
        return (
          <GraphContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            node={{
              id: nodeInfo.id,
              title: nodeInfo.title,
              artifact_type: nodeInfo.artifact_type,
              workspace: nodeInfo.workspace,
            }}
            selectedNodeIds={selectedNodeIds}
            allLoadedNodes={displayNodes.map((n) => ({
              id: n.id,
              title: n.title,
              artifact_type: n.artifact_type,
              workspace: n.workspace,
            }))}
            onCloseAction={() => setContextMenu(null)}
            onFocusModeAction={handleContextMenuAction.onFocusMode}
            onAddToFocusAction={handleContextMenuAction.onAddToFocus}
            onLockToFocusAction={handleContextMenuAction.onLockToFocus}
            onSelectNeighborsAction={handleContextMenuAction.onSelectNeighbors}
            onFilterToSelectionAction={handleContextMenuAction.onFilterToSelection}
            onCompareLensScoresAction={handleContextMenuAction.onCompareLensScores}
          />
        );
      })()}

      {/* P4-07: Share modal */}
      <GraphShareModal
        open={shareModalOpen}
        onCloseAction={() => setShareModalOpen(false)}
        url={shareUrl}
        isCeilingGuardActive={shareIsCeilingGuard}
        viewDescription={`${graphMode} mode · ${activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""} active` : "no filters"}`}
      />

      {/* P4-04: Lasso selection rectangle overlay (fixed, pointer-events:none) */}
      {lassoRect && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: lassoRect.left,
            top: lassoRect.top,
            width: lassoRect.width,
            height: lassoRect.height,
            border: "2px dashed #d97706",
            backgroundColor: "rgba(217,119,6,0.06)",
            pointerEvents: "none",
            zIndex: 30,
          }}
        />
      )}

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
            activeFilterCount={activeFilterCount}
            open={sidebarOpen}
            onOpenChange={setSidebarOpen}
            searchValue={graphFilterValues.q}
            onSearchChange={(q) => setGraphFilter({ q })}
            onClearAll={resetAllFilters}
            // v2.1 legacy props — retained for FilterSidebar compat; the actual
            // filtering is now driven by useGraphFilterState server dims.
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeTypesChange={setNodeTypes}
            onEdgeTypesChange={setEdgeTypes}
          >
            {/* P3-03: subtle loading indicator during debounce/refetch window */}
            {isFilterPending && (
              <div
                aria-live="polite"
                aria-label="Updating graph…"
                className="px-3 py-1.5 text-[10px] text-muted-foreground animate-pulse"
              >
                Updating…
              </div>
            )}
            <GraphFilters
              values={graphFilterValues}
              onChange={(next) => setGraphFilter(next)}
              // Facet options: API spec v2.2 VaultGraphResponse does not include
              // facet aggregates. Options are derived client-side from loaded nodes.
              options={filterOptions}
            />
          </FilterSidebar>
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
          {/* P3-07: Filter chip strip — above toolbar, visible when any filter is active */}
          {!isNeighborhoodMode && (
            <GraphFilterChips
              values={graphFilterValues}
              onClearDim={handleClearFilterDim}
              onClearAll={handleOverlayClearAll}
              onFocusFilterPanel={handleFocusFilterPanel}
            />
          )}

          {/* Toolbar row: encoding toggles (P2-09) + saved views (P3-06) + P4 controls */}
          {!isLoading && !isNeighborhoodLoading && displayNodes.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <EncodingToolbar
                colorMode={colorMode}
                sizeMode={sizeMode}
                onColorModeChange={setColorMode}
                onSizeModeChange={setSizeMode}
              />
              {/* P3-09: Grouping selector */}
              <GraphGroupingSelector
                mode={groupingMode}
                onChange={setGroupingMode}
              />
              {/* Saved views menu (P3-06) — passes live grouping so it is captured in snapshots */}
              <SavedViewsMenu
                currentFilter={graphFilterValues}
                currentCameraPreset={activeCameraPreset}
                currentGrouping={groupingMode}
                onApplyView={handleApplyView}
              />

              {/* P4-02: Search button (keyboard shortcut Cmd-K) */}
              <button
                type="button"
                aria-label="Search graph (Cmd-K)"
                onClick={() => setSearchOpen(true)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <Search aria-hidden="true" className="size-3" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden rounded bg-muted px-1 text-[9px] text-muted-foreground lg:inline">⌘K</kbd>
              </button>

              {/* P4-08: Static / Dynamic mode toggle */}
              <button
                type="button"
                aria-pressed={graphMode === "dynamic"}
                aria-label={`Graph mode: ${graphMode}. Click to switch to ${graphMode === "static" ? "dynamic" : "static"}.`}
                onClick={handleToggleMode}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
                  "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  graphMode === "dynamic"
                    ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {graphMode === "dynamic" ? (
                  <Activity aria-hidden="true" className="size-3 text-primary" />
                ) : (
                  <Layers aria-hidden="true" className="size-3" />
                )}
                <span className="hidden sm:inline">{graphMode === "static" ? "Static" : "Dynamic"}</span>
              </button>

              {/* P4-09: Export PNG */}
              <button
                type="button"
                aria-label={isExporting ? "Exporting…" : "Export graph as PNG"}
                onClick={handleExportPng}
                disabled={isExporting}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                <Download aria-hidden="true" className="size-3" />
                <span className="hidden sm:inline">PNG</span>
              </button>

              {/* P4-09: Export SVG */}
              <button
                type="button"
                aria-label={isExporting ? "Exporting…" : "Export graph as SVG"}
                onClick={handleExportSvg}
                disabled={isExporting}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                <Download aria-hidden="true" className="size-3" />
                <span className="hidden sm:inline">SVG</span>
              </button>

              {/* P4-07: Share / copy link */}
              <button
                type="button"
                aria-label="Share this graph view"
                onClick={() => setShareModalOpen(true)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <Share2 aria-hidden="true" className="size-3" />
                <span className="hidden sm:inline">Share</span>
              </button>

              {/* P4-07: Reset view */}
              {(activeFilterCount > 0 || focusedArtifactId || graphMode !== "static") && (
                <button
                  type="button"
                  aria-label="Reset all filters and view state"
                  onClick={handleResetView}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground",
                    "transition-colors hover:bg-accent hover:text-foreground",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  Reset view
                </button>
              )}

              {/* P4-04: Selection count badge */}
              {selectedNodeIds.size > 0 && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 rounded-full bg-amber-500"
                  />
                  {selectedNodeIds.size} selected
                  <button
                    type="button"
                    aria-label="Clear selection"
                    onClick={() => setSelectedNodeIds(new Set())}
                    className="ml-1 rounded p-0.5 hover:bg-amber-200/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <X aria-hidden="true" className="size-2.5" />
                  </button>
                </div>
              )}
            </div>
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
                          ref={canvasContainerRef}
                          role="img"
                          aria-label={`Knowledge graph with ${displayNodes.length} nodes and ${displayEdges.length} edges. Use Tab to cycle nodes, arrow keys to pan, plus/minus to zoom, Enter to open detail.${selectedNodeIds.size > 0 ? ` ${selectedNodeIds.size} nodes selected.` : ""}`}
                          tabIndex={0}
                          onKeyDown={handleKeyDown}
                          onPointerDown={handleCanvasPointerDown}
                          onPointerMove={handleCanvasPointerMove}
                          onPointerUp={handleCanvasPointerUp}
                          onContextMenu={(e) => {
                            // P4-05: context menu on right-click
                            e.preventDefault();
                            // Find if there's a node near the click point
                            if (!sigmaRef.current) return;
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const vx = e.clientX - rect.left;
                            const vy = e.clientY - rect.top;
                            const graphCoord = sigmaRef.current.viewportToGraph({ x: vx, y: vy });
                            // Find closest node within 20px
                            const graph = sigmaRef.current.getGraph?.();
                            if (!graph) return;
                            let closest: string | null = null;
                            let minDist = Infinity;
                            graph.forEachNode((nodeId: string) => {
                              const d = sigmaRef.current.getNodeDisplayData(nodeId);
                              if (!d) return;
                              const dx = d.x - graphCoord.x;
                              const dy = d.y - graphCoord.y;
                              const dist = Math.sqrt(dx * dx + dy * dy);
                              if (dist < minDist) { minDist = dist; closest = nodeId; }
                            });
                            if (closest) {
                              // If the node isn't in the selection, make it the sole selection
                              if (!selectedNodeIds.has(closest)) {
                                setSelectedNodeIds(new Set([closest]));
                              }
                              setContextMenu({ x: e.clientX, y: e.clientY, nodeId: closest });
                            }
                          }}
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
                              filterValues={graphFilterValues}
                              searchQuery={graphFilterValues.q}
                              onServerSearchNeededAction={setServerSearchQuery}
                              groupingMode={groupingMode}
                              onExpandCluster={expandCluster}
                              onFa2WorkerReady={handleFa2WorkerReady}
                            />
                          </SigmaContainer>

                          {/* P3-12: SVG convex-hull cluster halos (sigma-only).
                           * Mounted only when sigma is the active renderer AND a
                           * grouping mode that produces clusters is active.
                           * ClusterHalos is no-op in cosmos renderer mode (cosmos
                           * branch above never mounts this). */}
                          {sigmaRef.current && graph && groupingMode !== "none" && groupingMode !== "semantic_cluster" && (
                            <ClusterHalos
                              sigma={sigmaRef.current}
                              graph={graph}
                              expanded={expandedClusters}
                              onCollapseCluster={collapseCluster}
                            />
                          )}

                          {/* P3-08: canvas overlay (loading / empty / error) */}
                          <GraphCanvasOverlay
                            loading={isFilterPending}
                            error={null}
                            nodeCount={displayNodes.length}
                            hasActiveFilters={hasActiveFilters}
                            onClearAll={handleOverlayClearAll}
                          />

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
