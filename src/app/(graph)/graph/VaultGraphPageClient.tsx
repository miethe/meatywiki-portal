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
  Crosshair,
  X,
  ExternalLink,
  Network,
  ArrowLeft,
  AlertTriangle,
  SlidersHorizontal,
  ChevronRight,
  Palette,
  Ruler,
  Filter,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useVaultGraph, VAULT_GRAPH_NODE_CAP } from "@/hooks/useVaultGraph";
import { useGraphFilterState } from "@/hooks/useGraphFilterState";
import { useArtifactNeighborhood } from "@/hooks/useArtifactNeighborhood";
// FilterSidebar removed — replaced by FloatingPanel (OVLY-002); component file untouched
import { FloatingPanel } from "@/components/graph/FloatingPanel";
import { GraphFilters, GRAPH_FILTERS_DEFAULT, type GraphFiltersValues } from "@/components/graph/GraphFilters";
import { GraphFilterChips } from "@/components/graph/GraphFilterChips";
import type { FilterDimKey } from "@/components/graph/filterChipFormatters";
import { GraphFilterSheet } from "@/components/graph/GraphFilterSheet";
import { FilterPanelContent } from "@/components/graph/FilterPanelContent";
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
  resolveNodeSize,
  resolveNodeOpacity,
  hasUncertaintyRing,
  resolveEdgeSize,
  isSemanticEdge,
} from "@/lib/graph/encoding";
import {
  resolveNodeColorWithPalette,
  resolveEdgeColorWithPalette,
} from "@/lib/graph/encoding-palette";
import type { ColorPalette } from "@/lib/graph/palette";
import { usePalette } from "@/lib/graph/palette-context";
import { GraphSettingsMenu } from "@/components/graph/GraphSettingsMenu";
import {
  selectRenderer,
  EXTREME_SCALE_THRESHOLD,
} from "@/lib/graph/rendererSelect";
import { GraphSearchOverlay, recordRecentNode } from "@/components/graph/GraphSearchOverlay";
import type { GraphSearchResult } from "@/components/graph/GraphSearchOverlay";
import { GraphContextMenu } from "@/components/graph/GraphContextMenu";
import { GraphShareModal } from "@/components/graph/GraphShareModal";
import { useAriaAnnouncer } from "@/components/graph/GraphAriaLive";
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
  HelpCircle,
} from "lucide-react";
import {
  GraphOnboardingOverlay,
  useOnboardingState,
} from "@/components/graph/GraphOnboardingOverlay";
import {
  measureDeviceSpeed,
  chooseGraphMode,
  buildOptInWarningCopy,
  type DegradeConfig,
} from "@/lib/graph/autoDegrade";
import { ANIMATION_TIMINGS } from "@/lib/graph/animationTimings";
import { useAnimationBudget } from "@/hooks/useAnimationBudget";
import InfoTooltip from "@/components/ui/info-tooltip";
import { TOOLTIP_COPY } from "@/lib/copy/tooltips";
import { FirstRunOffer } from "@/components/tour/FirstRunOffer";
import { useToast } from "@/hooks/use-toast";
import { fetchLayout3D, AutoDegradeError } from "@/lib/graph/layout3d";
import type { GraphNode3D, GraphEdge3D } from "@/components/graph/GraphRenderer3D";
import { useWebGLSupport } from "@/hooks/use-webgl-support";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// REND-002/REND-003: GraphRenderer3D lazy chunk (Next.js dynamic import, ssr: false)
//
// 3d-force-graph uses three.js and requires a browser WebGL context.
// Dynamic import keeps it out of the main bundle (separate chunk).
//
// Mutual exclusion contract (same as sigma/cosmos):
//   GraphRenderer3D and sigma/cosmos must NEVER mount at the same time.
//   The `key={graphRenderMode}` on each renderer mount point enforces this:
//   when graphRenderMode changes, React fully unmounts the old renderer
//   (triggering _destructor() / sigma.kill()) before mounting the new one.
//   Only one WebGL context is alive at any time.
// ---------------------------------------------------------------------------
const GraphRenderer3DLazy = dynamic(
  () => import("@/components/graph/GraphRenderer3D").then((m) => ({
    default: m.GraphRenderer3D,
  })),
  {
    ssr: false,
    loading: () => <Graph3DLoadingSkeleton />,
  },
);

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
// Camera-zoom-aware node sizing helper (C-fix, 2026-05-20)
//
// Sigma v3 draws node sizes in pixel space regardless of camera ratio.  At
// maxCameraRatio=20 a 14 px node still renders at 14 px, dominating the view.
// We wrap every nodeReducer installation with this helper so that sizes scale
// down as the user zooms out and remain unchanged when zoomed in.
//
// Formula: scale = 1 / max(1, ratio^0.5)
//   • ratio=1  (default zoom) → scale=1.0 (unchanged)
//   • ratio=20 (max zoom-out) → scale≈0.22 (nodes shrink to ~22 % of nominal)
//   • ratio<1  (zoomed in)    → scale=1.0  (Math.max floor — no enlargement)
//
// Usage: every sigma.setSetting("nodeReducer", ...) call must go through this
// wrapper so the scaling is always present regardless of which UI state is
// active (keyboard focus, neighborhood highlight, lasso, search-ring).
// ---------------------------------------------------------------------------

type SigmaNodeReducer = (nodeId: string, data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Wraps `inner` with a camera-ratio scaling pass that runs first.
 * If `inner` is null the wrapper acts as a pure scaling reducer.
 * The sigma instance is passed in so the camera state is read at call time
 * (i.e. on every frame), not captured in a stale closure.
 */
function wrapWithCameraScale(
  sigma: { getCamera: () => { getState: () => { ratio: number } } },
  inner: SigmaNodeReducer | null,
): SigmaNodeReducer {
  return (nodeId: string, data: Record<string, unknown>) => {
    const ratio = sigma.getCamera().getState().ratio;
    const scale = 1 / Math.max(1, Math.pow(ratio, 0.5));
    const scaledData = scale < 1
      ? { ...data, size: (data.size as number) * scale }
      : data;
    return inner ? inner(nodeId, scaledData) : scaledData;
  };
}

// ---------------------------------------------------------------------------
// Build graphology graph from vault data
// ---------------------------------------------------------------------------

interface BuildVaultGraphOptions {
  highlightedNodeId?: string | null;
  colorMode: NodeColorMode;
  sizeMode: NodeSizeMode;
  selectedLens: string | null;
  /** P5-04: when true, store enlarged hit radius on each node for touch targets ≥44px. */
  touchHitRadius: boolean;
  /** P5-08: Active color palette (default or colorblind). */
  palette: ColorPalette;
}

function buildVaultGraph(
  nodes: VaultGraphNode[],
  edges: VaultGraphEdge[],
  options: BuildVaultGraphOptions,
): Graph {
  const { highlightedNodeId, colorMode, sizeMode, selectedLens, touchHitRadius, palette } = options;
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

    const baseColor = resolveNodeColorWithPalette(
      node.artifact_type,
      node.workspace,
      node.lens_scores_jsonb,
      selectedLens,
      colorMode,
      palette,
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
      // P5-04: touch hit radius — stored as a graphology attribute so the
      // touch-target hit-test handler in GraphEvents can read it without
      // referencing the visual `size`. Visual size is UNCHANGED (F0-fidelity
      // nodes remain small on screen); only the pointer event detection uses
      // this enlarged radius.
      //
      // Formula per interaction spec §10: Math.max(node.size * 2, 22)
      // (sigma coordinate units; 22 ≈ half of 44px minimum touch target)
      hitRadius: touchHitRadius ? Math.max(baseSize * 2, 22) : baseSize,
    });
  }

  for (const edge of edges) {
    if (!graph.hasNode(edge.source_id) || !graph.hasNode(edge.target_id)) continue;
    const edgeId = `${edge.source_id}__${edge.target_id}__${edge.edge_type}`;
    if (!graph.hasEdge(edgeId)) {
      const edgeColor = resolveEdgeColorWithPalette(edge.edge_type, palette);
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

  // Seed initial positions on a unit circle; FA2 expands from there. The
  // absolute coordinate scale doesn't matter for the rendered output because
  // sigma re-normalizes coords on every refresh and the camera is then
  // fitted to those normalized bounds via fitCameraToGraph (see settle
  // timer below). Previous tuning chased seed scale + scalingRatio trying
  // to make the graph "fill the canvas," but that was the wrong knob —
  // sigma re-normalizes coords, so what mattered was the camera fit.
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
// ZoomControls local component removed — migrated to OVLY-004 FloatingPanel (actions, top-right).
// Zoom buttons are now rendered inline inside the FloatingPanel body.

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
// REND-003: 3D loading overlay — shown while /api/portal/graph/layout-3d is in-flight
// ---------------------------------------------------------------------------

function Graph3DLoadingSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading 3D graph layout"
      className="flex h-full items-center justify-center"
      style={{ background: "var(--mw-graph-bg, #0d0d0f)" }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Spinning wireframe cube approximation via border animation */}
        <div className="relative size-16">
          <div className="absolute inset-0 animate-spin rounded-md border-2 border-[var(--mw-graph-accent,#7c6af7)] border-dashed opacity-70" />
          <div className="absolute inset-2 animate-ping rounded-md border border-[var(--mw-graph-accent,#7c6af7)] opacity-30" />
          <Network
            aria-hidden="true"
            className="absolute inset-0 m-auto size-7 text-[var(--mw-graph-accent,#7c6af7)] opacity-60"
          />
        </div>
        <p className="text-sm text-[var(--mw-graph-text-secondary,#9a9aa4)]">
          Computing 3D layout…
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Camera fit-to-bounds helper
//
// Sigma v3 normalizes node x/y attributes into a unit graph on every refresh,
// so absolute FA2 coordinate magnitude doesn't change the rendered fraction
// of the layout — only the camera state does. Prior FA2 spread tuning (seed
// scale, scalingRatio, gravity) was chasing the wrong knob: each round just
// changed how big the coords were before sigma re-normalized them.
//
// This helper sets the camera to the center of the normalized space at a
// ratio that shows the full bounds with a small margin (padding=0.9 ⇒ 10%
// margin). It must be called AFTER `sigma.refresh()` so the normalization
// step has consumed the latest node positions.
// ---------------------------------------------------------------------------

function fitCameraToGraph(
  sigma: { refresh: () => void; getCamera: () => { animate: (state: Record<string, number>, opts: { duration: number }) => void; setState: (state: Record<string, number>) => void } },
  padding = 0.9,
  animate = true,
): void {
  sigma.refresh();
  const target = { x: 0.5, y: 0.5, ratio: 1 / padding, angle: 0 };
  if (animate) {
    sigma.getCamera().animate(target, { duration: 400 });
  } else {
    sigma.getCamera().setState(target);
  }
}

// ---------------------------------------------------------------------------
// Graph-coordinate utilities: bounds, centroid, aspect stretch + recenter
//
// Two related symptoms surfaced after the camera fit landed:
//
//   1. FA2 with gravity > 0 is a radial equilibrium — repulsion pushes
//      nodes outward, gravity pulls them toward (0, 0). The stable shape
//      is a disk. Sigma's normalization preserves aspect ratio, so on a
//      16:9 canvas the disk is centered with empty bands on the long
//      axis. To actually USE the rectangular canvas, we stretch x-coords
//      so the graph's bounding-box aspect ratio matches the canvas.
//
//   2. FA2 worker mutates node x/y in place. After settle, the centroid
//      is wherever FA2 left it — not (0, 0) — because Barnes-Hut + edge
//      distribution are not perfectly symmetric. In dynamic mode, gravity
//      keeps pulling each node toward (0, 0); with centroid at (cx, cy),
//      every node feels a net (-cx, -cy) force, producing uniform "drift"
//      of the whole layout toward one canvas edge. Recentering to (0, 0)
//      at settle balances gravity and stops the drift.
//
// Both transforms are applied together in one pass at FA2 settle time,
// BEFORE fitCameraToGraph. The aspect stretch is guarded — skipped when
// the canvas is roughly square (|ratio-1| < 0.15) — to avoid distorting
// clusters into ellipses on portrait layouts.
// ---------------------------------------------------------------------------

interface GraphBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function computeGraphBounds(graph: Graph): GraphBounds | null {
  if (graph.order === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  graph.forEachNode((_id, attrs) => {
    const x = typeof attrs.x === "number" ? attrs.x : 0;
    const y = typeof attrs.y === "number" ? attrs.y : 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  return Number.isFinite(minX) ? { minX, maxX, minY, maxY } : null;
}

// ---------------------------------------------------------------------------
// Obsidian-style rectangular fill — tuning constants
// ---------------------------------------------------------------------------
const SHAPE_PASS_ALPHA = 0.5;           // 0 = no reshape, 1 = full snap to rectangle
const BOUNDARY_NUDGE_K = 0.02;          // per-frame strength near walls
const BOUNDARY_NUDGE_THRESHOLD = 0.9;   // fraction of target half-extent where wall force engages
const ASPECT_GUARD = 0.1;               // skip shape pass when canvas is near-square (|aspect-1| < this)

/**
 * Axis-anisotropic soft-reshape: pull the graph's bounding box toward an
 * equal-area rectangle that matches the canvas aspect ratio. Preserves cluster
 * structure better than uniform x-stretch by scaling each axis with a soft
 * exponent (SHAPE_PASS_ALPHA) rather than a hard snap. Replaces the prior
 * `rectangularizeAndRecenter` blanket stretch.
 *
 * Why: FA2 produces a roughly circular hull. We can't change the hull from
 * inside FA2 — its forces are rotationally symmetric. Instead we shape the
 * settled coordinates externally. Soft anisotropic scaling (alpha<1) coaxes
 * the disk into a rectangle without uniformly squishing intra-cluster spacing.
 */
function shapeGraphToRectangle(graph: Graph, canvasAspect: number): void {
  const bounds = computeGraphBounds(graph);
  if (!bounds) return;
  const hx = (bounds.maxX - bounds.minX) / 2 || 1;
  const hy = (bounds.maxY - bounds.minY) / 2 || 1;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const graphAspect = hx / hy;
  if (canvasAspect <= 0 || Math.abs(canvasAspect / graphAspect - 1) < ASPECT_GUARD) {
    // Near-square — just recenter.
    graph.forEachNode((id, attrs) => {
      const x = typeof attrs.x === "number" ? attrs.x : 0;
      const y = typeof attrs.y === "number" ? attrs.y : 0;
      graph.setNodeAttribute(id, "x", x - cx);
      graph.setNodeAttribute(id, "y", y - cy);
    });
    return;
  }
  // Target half-extents preserving area (hx*hy) and matching canvas aspect.
  const targetHx = Math.sqrt(hx * hy * canvasAspect);
  const targetHy = Math.sqrt((hx * hy) / canvasAspect);
  const sx = Math.pow(targetHx / hx, SHAPE_PASS_ALPHA);
  const sy = Math.pow(targetHy / hy, SHAPE_PASS_ALPHA);
  graph.forEachNode((id, attrs) => {
    const x = typeof attrs.x === "number" ? attrs.x : 0;
    const y = typeof attrs.y === "number" ? attrs.y : 0;
    graph.setNodeAttribute(id, "x", (x - cx) * sx);
    graph.setNodeAttribute(id, "y", (y - cy) * sy);
  });
}

/**
 * Per-tick soft rectangular boundary nudge. Zero force in the interior;
 * quadratic restoring near walls. This is the d3-force `forceX`/`forceY` +
 * soft bounding-box pattern that gives Obsidian-style rectangular fill,
 * adapted to run on top of FA2's worker via a RAF loop reading worker-written
 * positions. Apply this each animation frame while in dynamic mode.
 *
 * Returns true if any node was moved (caller can decide whether to refresh sigma).
 */
function applyBoundaryNudgeTick(graph: Graph, canvasAspect: number): boolean {
  const bounds = computeGraphBounds(graph);
  if (!bounds) return false;
  const hx = (bounds.maxX - bounds.minX) / 2 || 1;
  const hy = (bounds.maxY - bounds.minY) / 2 || 1;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const tx = canvasAspect > 0 ? Math.sqrt(hx * hy * canvasAspect) : hx;
  const ty = canvasAspect > 0 ? Math.sqrt((hx * hy) / canvasAspect) : hy;
  let moved = false;
  graph.forEachNode((id, attrs) => {
    const x = typeof attrs.x === "number" ? attrs.x : 0;
    const y = typeof attrs.y === "number" ? attrs.y : 0;
    const dx = x - cx;
    const dy = y - cy;
    const nx = dx / tx;
    const ny = dy / ty;
    let ox = 0;
    let oy = 0;
    if (Math.abs(nx) > BOUNDARY_NUDGE_THRESHOLD) {
      const over = Math.abs(nx) - BOUNDARY_NUDGE_THRESHOLD;
      ox = -BOUNDARY_NUDGE_K * Math.sign(dx) * over * over * tx;
    }
    if (Math.abs(ny) > BOUNDARY_NUDGE_THRESHOLD) {
      const over = Math.abs(ny) - BOUNDARY_NUDGE_THRESHOLD;
      oy = -BOUNDARY_NUDGE_K * Math.sign(dy) * over * over * ty;
    }
    if (ox !== 0 || oy !== 0) {
      graph.setNodeAttribute(id, "x", x + ox);
      graph.setNodeAttribute(id, "y", y + oy);
      moved = true;
    }
  });
  return moved;
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
  /**
   * P5-04: when true, `clickStage` events perform an enlarged-radius node
   * hit-test using the `hitRadius` graphology attribute before deselecting.
   * This lets F0-fidelity nodes receive ≥44px touch targets without changing
   * their visual size.
   */
  touchHitRadius?: boolean;
  /** P5-07: when true, camera.animate() is replaced with camera.setState() (no animation). */
  prefersReducedMotion?: boolean;
}

function GraphEvents({ nodes, onHover, onSelect, focusedNodeId, onExpandCluster, onFa2WorkerReady, touchHitRadius, prefersReducedMotion = false }: GraphEventsProps) {
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
      // Obsidian-style fill — near-zero gravity removes radial pull so nodes
      // spread into the full canvas rather than compressing onto a disk.
      // linLog off + outboundAttractionDistribution gives the most uniform
      // interior fill; shape + per-tick boundary nudges handle hull shaping
      // externally (shapeGraphToRectangle / applyBoundaryNudgeTick).
      settings: {
        barnesHutOptimize: isLarge,
        barnesHutTheta: isLarge ? 0.8 : 0.5,
        gravity: 0.05,
        // scalingRatio raised 8→14 (2026-05-21) for stronger inter-node
        // repulsion, reducing overlap in dense clusters. Compensates for the
        // smaller node sizes set in FIDELITY_SIZES / resolveNodeSize, which
        // also reduce the effective collision radius FA2 reads via
        // adjustSizes. Net: larger minimum visual gap between nodes.
        scalingRatio: 14,
        linLogMode: false,
        outboundAttractionDistribution: true,
        adjustSizes: true,
        strongGravityMode: false,
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
      // Recenter centroid to (0, 0) so FA2's radial gravity is balanced
      // (prevents dynamic-mode drift) and stretch x so the bounding box
      // matches the canvas aspect ratio (so a circular FA2 disk fills a
      // rectangular canvas instead of leaving empty side bands).
      const container = sigma.getContainer?.() as HTMLElement | undefined;
      const aspect =
        container && container.clientHeight > 0
          ? container.clientWidth / container.clientHeight
          : 1;
      shapeGraphToRectangle(graph, aspect);
      // Fit camera to the (now reshaped) bounds. Without this, sigma frames
      // a fixed fraction of the normalized space and the layout looks tight
      // regardless of FA2 settings. See fitCameraToGraph comment above.
      fitCameraToGraph(sigma, 0.9, !prefersReducedMotion);
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
    if (prefersReducedMotion) {
      sigma.getCamera().setState({ x: displayData.x, y: displayData.y, ratio: 0.5 });
    } else {
      sigma.getCamera().animate(
        { x: displayData.x, y: displayData.y, ratio: 0.5 },
        { duration: 300 },
      );
    }
  }, [focusedNodeId, sigma, prefersReducedMotion]);

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
      clickStage: ({ event }: { event: { x: number; y: number } }) => {
        // P5-04: On touch devices, sigma's built-in hit detection may miss
        // small (F0) nodes because their visual radius is below 22px. Before
        // deselecting, we run a secondary enlarged-radius hit-test using the
        // `hitRadius` attribute stored on each graphology node.
        if (touchHitRadius) {
          const graph = sigma.getGraph();
          const graphCoord = sigma.viewportToGraph({ x: event.x, y: event.y });
          let hitNode: string | null = null;
          let minDist = Infinity;

          graph.forEachNode((nodeId: string, attrs: Record<string, unknown>) => {
            if (attrs.hidden) return;
            const displayData = sigma.getNodeDisplayData(nodeId);
            if (!displayData) return;
            const dx = displayData.x - graphCoord.x;
            const dy = displayData.y - graphCoord.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const radius = typeof attrs.hitRadius === "number" ? attrs.hitRadius : (attrs.size as number ?? 5);
            if (dist <= radius && dist < minDist) {
              minDist = dist;
              hitNode = nodeId;
            }
          });

          if (hitNode) {
            // Treat as a node click — re-use the clickNode path.
            const nd = nodeMap.get(hitNode);
            const displayData = sigma.getNodeDisplayData(hitNode);
            if (nd && displayData) {
              const { x, y } = sigma.graphToViewport({ x: displayData.x, y: displayData.y });
              onSelect({
                nodeId: hitNode,
                title: nd.title,
                artifactType: nd.artifact_type,
                workspace: nd.workspace,
                updatedAt: nd.updated_at,
                x,
                y,
              });
              return; // do not deselect
            }
          }
        }
        onSelect(null);
      },
    });
  }, [registerEvents, sigma, nodeMap, onHover, onSelect, touchHitRadius]);

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
  /** P5-04: pass through to GraphEvents for enlarged touch hit radius. */
  touchHitRadius?: boolean;
  /** P5-07: pass through to GraphEvents for reduced-motion camera fallback. */
  prefersReducedMotion?: boolean;
  /** P4-08 / Obsidian-fill: current graph mode; drives boundary-nudge RAF loop. */
  graphMode?: GraphMode;
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
  touchHitRadius,
  prefersReducedMotion,
  graphMode,
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

    // targetStrength lowered from 0.3 → 0.21 (~30%) so FA2's expanded scalingRatio
    // wins at steady state — centroid seeds clusters early (rampMs=500) but yields
    // to the looser FA2 repulsion rather than fighting it to a tighter plateau.
    const force = createRampedModuleForce(graph, { targetStrength: 0.21, rampMs: 500 });
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

  // Obsidian-style per-tick soft rectangular boundary nudge.
  //
  // Runs ONLY in dynamic mode for non-centroid-force groupings (workspace /
  // project modes already have their own centroid RAF loop above). Applies
  // applyBoundaryNudgeTick each frame so FA2's rotationally-symmetric
  // forces don't collapse the layout back to a disk once it starts running.
  // Zero force in the interior — only kicks in near the target half-extents.
  // Stops automatically on mode change or unmount.
  useEffect(() => {
    if (graphMode !== "dynamic") return;
    if (isCentroidForceModeActive(groupingMode)) return; // centroid loop handles those modes
    if (prefersReducedMotion) return;

    const graph = sigma.getGraph();
    if (!graph || graph.order === 0) return;

    const container = sigma.getContainer?.() as HTMLElement | undefined;
    let rafId: number;
    let running = true;

    const loop = () => {
      if (!running) return;
      const aspect =
        container && container.clientHeight > 0
          ? container.clientWidth / container.clientHeight
          : 1;
      const moved = applyBoundaryNudgeTick(graph, aspect);
      if (moved) sigma.refresh();
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
    };
  }, [sigma, graphMode, groupingMode, prefersReducedMotion]);

  return (
    <GraphEvents
      nodes={nodes}
      onHover={onHover}
      onSelect={onSelect}
      focusedNodeId={focusedNodeId}
      onExpandCluster={onExpandCluster}
      onFa2WorkerReady={onFa2WorkerReady}
      touchHitRadius={touchHitRadius}
      prefersReducedMotion={prefersReducedMotion}
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
// P5-03: Opt-in graph warning banner (interaction spec §14)
// Shown when auto-degrade matrix returns `opt-in-warning`.
// ---------------------------------------------------------------------------

interface OptInWarningBannerProps {
  nodeCount: number;
  onShowList: () => void;
  onTryGraph: () => void;
}

function OptInWarningBanner({ nodeCount, onShowList, onTryGraph }: OptInWarningBannerProps) {
  const copy = buildOptInWarningCopy(nodeCount);
  return (
    <div
      role="note"
      aria-label="Graph performance warning"
      className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <span className="text-amber-800 dark:text-amber-200">
          {copy.message}
        </span>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onShowList}
          className={cn(
            "inline-flex items-center rounded-md border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800",
            "transition-colors hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/70",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {copy.ctaList}
        </button>
        <button
          type="button"
          onClick={onTryGraph}
          className={cn(
            "inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground",
            "transition-colors hover:bg-accent hover:text-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {copy.ctaGraph}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MobileFilterDrawer replaced by GraphFilterSheet (P5-02).
// See components/graph/GraphFilterSheet.tsx.

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
  // P5-08: Color-blind palette — reads PaletteProvider context (set up in
  // page.tsx). paletteRef lets sigma setSetting reducer callbacks read the
  // current palette without closing over a stale value.
  // -------------------------------------------------------------------------
  const palette = usePalette();
  const paletteRef = useRef(palette);
  useEffect(() => {
    paletteRef.current = palette;
  }, [palette]);

  // -------------------------------------------------------------------------
  // P5-06: ARIA live-region announcer (GraphAriaLive provider mounted in page.tsx)
  // -------------------------------------------------------------------------
  const { announce } = useAriaAnnouncer();

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
    autoLoadAll:  true,
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
      announce(`Focus mode entered from ${node?.title ?? nodeId}. K-hop neighborhood highlighted.`);
    },
    [nodes, announce],
  );

  const handleBackToVault = useCallback(() => {
    setFocusedArtifactId(null);
    setFocusedArtifactTitle(null);
    announce(`Focus mode off. Showing ${displayNodes.length} nodes.`);
  }, [announce, displayNodes.length]);

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

  // P5-06: announce node selection via ARIA live region.
  const handleSelectPopover = useCallback((p: PopoverData | null) => {
    setPopover(p);
    if (p) {
      announce(`${p.title ?? p.nodeId} selected. ${p.artifactType}, ${p.workspace}.`);
    }
  }, [announce]);

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

    // C-fix: Install the base camera-scale reducer as soon as sigma is ready
    // so sizing is zoom-proportionate from the very first frame, before any
    // imperative setSetting("nodeReducer", ...) fires.
    sigma.setSetting("nodeReducer", wrapWithCameraScale(sigma, null));

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
  // P5-05: WCAG keyboard-focused node state.
  // Separate from focusedNodeId (P3-10 camera-pan) — this tracks which node
  // has keyboard focus for Tab/Arrow navigation per interaction spec §9.
  // -------------------------------------------------------------------------
  const [keyboardFocusedNodeId, setKeyboardFocusedNodeId] = useState<string | null>(null);
  // Ref keeps nodeReducer callbacks in sync without stale closure issues.
  const keyboardFocusedRef = useRef<string | null>(null);
  useEffect(() => {
    keyboardFocusedRef.current = keyboardFocusedNodeId;
  }, [keyboardFocusedNodeId]);

  // -------------------------------------------------------------------------
  // P5-04: Touch device flag — used in both buildVaultGraph (hitRadius attr)
  // and GraphCanvasInner (enlarged clickStage hit-test).
  // navigator is always available here (this component is dynamically imported
  // with ssr:false, so it never executes on the server).
  // -------------------------------------------------------------------------
  const isTouchDevice =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

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
      touchHitRadius: isTouchDevice,
      palette,
    });
  }, [displayNodes, displayEdges, focusedArtifactId, colorMode, sizeMode, selectedLens, isTouchDevice, palette]);

  // P5-05: tabOrder — displayNodes sorted by graph degree descending for Tab cycling.
  // Falls back to empty array until graph is available.
  const tabOrder = useMemo<string[]>(() => {
    if (!graph || displayNodes.length === 0) return [];
    return [...displayNodes]
      .sort((a, b) => {
        const degA = graph.hasNode(a.id) ? graph.degree(a.id) : 0;
        const degB = graph.hasNode(b.id) ? graph.degree(b.id) : 0;
        return degB - degA;
      })
      .map((n) => n.id);
  }, [graph, displayNodes]);

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
  // P5-05: Sync keyboard focus amber ring → sigma nodeReducer.
  //
  // Runs whenever keyboardFocusedNodeId changes. If a node is focused we
  // install a nodeReducer that adds an amber-500 (#d97706) border; when no
  // node is focused we clear it. We leave other imperative nodeReducer
  // overrides (search result, lasso selection) to run as before — they
  // overwrite this one until the next keyboardFocusedNodeId change, which is
  // acceptable given these interactions are mutually exclusive in practice.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma) return;
    if (keyboardFocusedNodeId === null) {
      // No UI state active — install a pure camera-scale reducer so sizes
      // remain zoom-proportionate even when no highlight/selection is live.
      sigma.setSetting("nodeReducer", wrapWithCameraScale(sigma, null));
    } else {
      const focusedId = keyboardFocusedNodeId;
      sigma.setSetting(
        "nodeReducer",
        wrapWithCameraScale(sigma, (nodeId: string, data: Record<string, unknown>) => {
          if (nodeId === focusedId) {
            return { ...data, borderColor: "#d97706", borderSize: 3 };
          }
          return data;
        }),
      );
    }
    sigma.refresh();
  }, [keyboardFocusedNodeId]);

  // -------------------------------------------------------------------------
  // P5-07: prefers-reduced-motion — subscribed state (not one-shot read).
  //
  // Declared here (before keyboard handler and zoom callbacks) so all of the
  // camera motion guards below can read the current value without a
  // "used before declaration" error. The graphMode-related effect and the
  // graphMode state itself follow further down in the file; both read this
  // value after it has been declared.
  // -------------------------------------------------------------------------
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // P5-09: performance-guard hook — RAF rolling-window median > 33ms → slowFrame
  const { slowFrame } = useAnimationBudget();

  // P5-11: onboarding overlay — localStorage gate + controlled open state
  const {
    open: onboardingOpen,
    openOverlay,
    dismissOverlay,
  } = useOnboardingState();

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
          if (prefersReducedMotion) {
            camera.setState({ y: camera.getState().y - 0.05 });
          } else {
            camera.animate({ y: camera.getState().y - 0.05 }, { duration: 100 });
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (prefersReducedMotion) {
            camera.setState({ y: camera.getState().y + 0.05 });
          } else {
            camera.animate({ y: camera.getState().y + 0.05 }, { duration: 100 });
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (prefersReducedMotion) {
            camera.setState({ x: camera.getState().x - 0.05 });
          } else {
            camera.animate({ x: camera.getState().x - 0.05 }, { duration: 100 });
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (prefersReducedMotion) {
            camera.setState({ x: camera.getState().x + 0.05 });
          } else {
            camera.animate({ x: camera.getState().x + 0.05 }, { duration: 100 });
          }
          break;
        case "+":
        case "=":
          e.preventDefault();
          if (prefersReducedMotion) {
            camera.setState({ ratio: camera.getState().ratio / 1.5 });
          } else {
            camera.animate({ ratio: camera.getState().ratio / 1.5 }, { duration: 150 });
          }
          break;
        case "-":
          e.preventDefault();
          if (prefersReducedMotion) {
            camera.setState({ ratio: camera.getState().ratio * 1.5 });
          } else {
            camera.animate({ ratio: camera.getState().ratio * 1.5 }, { duration: 150 });
          }
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
    [focusedNodeIndex, focusedNodeId, nodeList, prefersReducedMotion],
  );

  // -------------------------------------------------------------------------
  // Zoom control callbacks
  // -------------------------------------------------------------------------
  const handleZoomIn = useCallback(() => {
    const camera = sigmaRef.current?.getCamera();
    if (!camera) return;
    if (prefersReducedMotion) {
      camera.setState({ ratio: camera.getState().ratio / 1.5 });
    } else {
      camera.animate({ ratio: camera.getState().ratio / 1.5 }, { duration: 200 });
    }
  }, [prefersReducedMotion]);

  const handleZoomOut = useCallback(() => {
    const camera = sigmaRef.current?.getCamera();
    if (!camera) return;
    if (prefersReducedMotion) {
      camera.setState({ ratio: camera.getState().ratio * 1.5 });
    } else {
      camera.animate({ ratio: camera.getState().ratio * 1.5 }, { duration: 200 });
    }
  }, [prefersReducedMotion]);

  const handleFitView = useCallback(() => {
    // Previously hardcoded `{x:0, y:0, ratio:1}` — that's not a real
    // fit-to-bounds; it just parked the camera at the normalized graph
    // origin. Route through fitCameraToGraph so this matches the
    // post-settle framing.
    const sigma = sigmaRef.current;
    if (!sigma) return;
    fitCameraToGraph(sigma, 0.9, !prefersReducedMotion);
  }, [prefersReducedMotion]);

  const handleToggleFullscreen = useCallback(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen().catch(() => {});
    }
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
          if (prefersReducedMotion || slowFrame) {
            sigmaRef.current.getCamera().setState({ x: 0.5, y: 0.5, ratio: 1 });
          } else {
            sigmaRef.current.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: ANIMATION_TIMINGS.cameraJump.durationMs });
          }
        } else {
          // For non-default named presets, reset to default and log.
          // Full preset dispatch requires graph ref; deferred until P3-09 refactor.
          if (prefersReducedMotion || slowFrame) {
            sigmaRef.current.getCamera().setState({ x: 0.5, y: 0.5, ratio: 1 });
          } else {
            sigmaRef.current.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: ANIMATION_TIMINGS.cameraJump.durationMs });
          }
          console.info(
            `[SavedViews] Camera preset "${view.cameraPreset}" requested — full preset dispatch deferred to P3-09.`,
          );
        }
        setActiveCameraPreset(view.cameraPreset);
        announce(`View changed to: ${view.cameraPreset}.`);
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
    [setGraphFilter, setGroupingMode, prefersReducedMotion],
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

  // P5-06: announce when a filter is applied (count > 0 only; cleared handled separately).
  useEffect(() => {
    if (activeFilterCount > 0) {
      announce(
        `Showing ${displayNodes.length} nodes, ${displayEdges.length} edges. Filtered to ${activeFilterCount} criteria.`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilterCount]);

  // -------------------------------------------------------------------------
  // P3-08: onClearAll — resets all filter state to GRAPH_FILTERS_DEFAULT.
  // P5-06: also announces the clear event via ARIA live region.
  // -------------------------------------------------------------------------
  const handleOverlayClearAll = useCallback(() => {
    resetAllFilters();
    announce(
      `All filters cleared. Showing ${displayNodes.length} nodes, ${displayEdges.length} edges.`,
    );
  }, [resetAllFilters, announce, displayNodes.length, displayEdges.length]);

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
  // P5-03: Auto-degrade matrix — device speed detection + render-mode gate.
  //
  // Fires once on mount via a RAF timing pass (measureDeviceSpeed()) and
  // caches the result per session. The matrix (chooseGraphMode) is then
  // applied with the server-reported totalNodeCount to determine whether the
  // graph is: full, static-forced, opt-in-warning, or list-only.
  //
  // `null` = detection not yet complete (show normal loading path).
  // -------------------------------------------------------------------------
  const [degradeConfig, setDegradeConfig] = useState<DegradeConfig | null>(null);

  // When user chooses "Try graph view anyway" from the opt-in-warning banner,
  // we promote the mode to `full` for this session.
  const [optInOverride, setOptInOverride] = useState(false);

  useEffect(() => {
    let cancelled = false;
    measureDeviceSpeed().then((rafMs) => {
      if (cancelled) return;
      const touch = navigator.maxTouchPoints > 0;
      const config = chooseGraphMode({ nodeCount: totalNodeCount, touch, rafMs });
      setDegradeConfig(config);

      // If matrix says list-only, auto-switch the degraded fallback to list.
      if (config.mode === "list-only") {
        setFallbackView("list");
      }
    });
    return () => { cancelled = true; };
   
  }, [totalNodeCount]); // re-evaluate when totalNodeCount resolves from server

  // Effective render mode accounting for user opt-in override.
  const effectiveDegradeConfig: DegradeConfig | null = degradeConfig
    ? (optInOverride && degradeConfig.mode === "opt-in-warning"
        ? { ...degradeConfig, mode: "static-forced" as const }
        : degradeConfig)
    : null;

  // True when the degrade matrix mandates skipping the canvas entirely.
  const isDegradeListOnly =
    effectiveDegradeConfig !== null &&
    effectiveDegradeConfig.mode === "list-only";

  // -------------------------------------------------------------------------
  // P4-08: Static / dynamic mode
  //
  // Default: static (respects prefers-reduced-motion: reduce).
  // URL param: mode=static|dynamic
  // (prefersReducedMotion state is declared earlier, before the keyboard handler.)
  // -------------------------------------------------------------------------
  const [graphMode, setGraphMode] = useState<GraphMode>(() => {
    // Hydrate from URL on first mount
    if (typeof window === "undefined") return "static";
    const { state } = parseUrl(window.location.search);
    if (state.mode === "dynamic" && !prefersReducedMotion) return "dynamic";
    return "static";
  });

  // P5-07: If the user enables reduced-motion mid-session, immediately force
  // the graph back to static mode (complements the init-time gate above).
  useEffect(() => {
    if (prefersReducedMotion && graphMode === "dynamic") {
      setGraphMode("static");
    }
  }, [prefersReducedMotion, graphMode]);

  // -------------------------------------------------------------------------
  // REND-003: 2D / 3D render mode toggle
  //
  // Decision: YAGNI — single-user app, no Zustand slice needed. Local state
  // in VaultGraphPageClient is the simplest correct approach.
  //
  // graphRenderMode governs which renderer is active:
  //   '2d' → sigma (or cosmos for N>15K) — existing 2D path
  //   '3d' → GraphRenderer3D (three.js via 3d-force-graph)
  //
  // On 2D→3D switch:
  //   1. Call POST /api/portal/graph/layout-3d with a snapshot_id derived from current filters
  //   2. Show 3D loading overlay while in-flight
  //   3. On success: inject positions into GraphRenderer3D via graphData3D state
  //   4. On 422 auto_degrade: abort switch, dispatch warning toast (REND-004)
  //
  // State preserved across toggle:
  //   - active filter selections (graphFilterValues — URL-backed, unchanged)
  //   - selected node IDs (selectedNodeIds state — unchanged)
  //
  // State reset on each toggle:
  //   - camera/zoom (3D initialises to default camera; 2D sigma re-mounts fresh)
  //
  // WebGL isolation: both renderer mount points carry key={graphRenderMode} so
  // React fully unmounts the outgoing renderer before mounting the incoming one.
  // -------------------------------------------------------------------------
  const [graphRenderMode, setGraphRenderMode] = useState<"2d" | "3d">("2d");
  const [is3DLoading, setIs3DLoading] = useState(false);
  const [graphData3D, setGraphData3D] = useState<{
    nodes: GraphNode3D[];
    links: GraphEdge3D[];
  } | null>(null);

  // MOBILE-002: WebGL2 / device capability check — disables 3D toggle when unsupported.
  const webGLSupport = useWebGLSupport();

  // A11Y-001: announce auto-degrade once when the hook resolves to unsupported.
  // `webGLSupport.supported` starts true (SSR default), then may flip false after
  // hydration. We only announce when it transitions to false so we don't spam on
  // capable devices. The dependency array intentionally omits `announce` — it is
  // a stable callback from useCallback in GraphAriaLive.
  useEffect(() => {
    if (!webGLSupport.supported) {
      announce("3D mode unavailable on this device.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webGLSupport.supported]);

  const { add: addToast } = useToast();

  /**
   * Derive a snapshot_id from current filter state.
   * The backend uses this to identify which graph snapshot to layout.
   * We build a deterministic string from the server-side filter dims.
   */
  function deriveSnapshotId(): string {
    const parts = [
      graphFilterValues.ws.join(","),
      graphFilterValues.types.join(","),
      graphFilterValues.edges.join(","),
      graphFilterValues.freshness.join(","),
      graphFilterValues.project.join(","),
      graphFilterValues.domain.join(","),
      graphFilterValues.date_from ?? "",
      graphFilterValues.date_to ?? "",
    ];
    return parts.join("|");
  }

  /**
   * REND-003: Toggle between 2D and 3D render modes.
   *
   * 2D→3D: fetch layout, inject positions, switch renderer.
   * 3D→2D: immediately switch back; sigma re-mounts with existing graph.
   */
  const handleToggleRenderMode = useCallback(async () => {
    if (graphRenderMode === "3d") {
      // 3D → 2D: instant switch
      setGraphRenderMode("2d");
      setGraphData3D(null);
      // A11Y-001: announce mode switch to screen readers
      announce("Switched to 2D view.");
      return;
    }

    // A11Y-001: announce that 3D is loading (before the async fetch)
    announce("Switching to 3D view.");

    // 2D → 3D: fetch server layout
    setIs3DLoading(true);
    try {
      const snapshotId = deriveSnapshotId();
      const layout = await fetchLayout3D(snapshotId);

      // Build 3D node list: merge VaultGraphNode display data with positions.
      // Nodes missing from the layout response default to origin.
      const positionMap = new Map(layout.positions.map((p) => [p.node_id, p]));

      const nodes3D: GraphNode3D[] = displayNodes.map((n) => {
        const pos = positionMap.get(n.id);
        return {
          id: n.id,
          title: n.title,
          fidelity_level: n.fidelity_level ?? undefined,
          x: pos?.x ?? 0,
          y: pos?.y ?? 0,
          z: pos?.z ?? 0,
        };
      });

      const links3D: GraphEdge3D[] = displayEdges.map((e) => ({
        source: e.source_id,
        target: e.target_id,
        edge_type: e.edge_type,
        confidence: e.confidence ?? undefined,
      }));

      setGraphData3D({ nodes: nodes3D, links: links3D });
      setGraphRenderMode("3d");
    } catch (err) {
      // REND-004: 422 auto_degrade → warn toast, stay in 2D
      if (err instanceof AutoDegradeError) {
        addToast({
          type: "warning",
          message: "Graph is too large for 3D mode (>15,000 nodes). Staying in 2D.",
          duration: 5000,
        });
        // graphRenderMode stays '2d' — no state change needed
      } else {
        addToast({
          type: "error",
          message: "Failed to load 3D layout. Please try again.",
          duration: 6000,
        });
        console.error("[REND-003] layout-3d error:", err);
      }
    } finally {
      setIs3DLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphRenderMode, displayNodes, displayEdges, graphFilterValues, addToast]);

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
        // Shape + recenter before resuming FA2 so the rectangular layout
        // is preserved and FA2 gravity is balanced (no centroid drift).
        const sigma = sigmaRef.current;
        const graph = sigma?.getGraph?.();
        if (graph && sigma) {
          const container = sigma.getContainer?.() as HTMLElement | undefined;
          const aspect =
            container && container.clientHeight > 0
              ? container.clientWidth / container.clientHeight
              : 1;
          shapeGraphToRectangle(graph, aspect);
          fitCameraToGraph(sigma, 0.9, !prefersReducedMotion);
        }
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
        announce(`Graph layout complete. ${displayNodes.length} nodes positioned.`);
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
      if (reducedMotion || slowFrame) {
        sigma.getCamera().setState({ x: displayData.x, y: displayData.y, ratio: 0.5 });
      } else {
        sigma.getCamera().animate(
          { x: displayData.x, y: displayData.y, ratio: 0.5 },
          { duration: ANIMATION_TIMINGS.cameraJump.durationMs },
        );
      }
    }

    // (b) Soft focus: k=1 neighborhood at full opacity, dim others to 0.5
    const neighbors = new Set<string>(graphInstance.neighbors(targetId));
    neighbors.add(targetId);

    sigma.setSetting(
      "nodeReducer",
      wrapWithCameraScale(sigma, (nodeId: string, data: Record<string, unknown>) => {
        if (neighbors.has(nodeId)) return data;
        return { ...data, opacity: 0.5 };
      }),
    );
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

  // P5-06: announce multi-select count changes (defer to next tick to batch rapid lasso updates).
  useEffect(() => {
    if (selectedNodeIds.size > 0) {
      const id = setTimeout(() => {
        announce(`${selectedNodeIds.size} nodes selected.`);
      }, 0);
      return () => clearTimeout(id);
    }
  }, [selectedNodeIds.size, announce]);

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
      // Only start lasso on Shift+left-click; plain left-drag remains Sigma camera pan
      if (e.button !== 0 || !e.shiftKey) return;
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

      // Apply selection ring to selected nodes (P5-08: via paletteRef for palette-awareness)
      if (selected.size > 0) {
        sigma.setSetting(
          "nodeReducer",
          wrapWithCameraScale(sigma, (nodeId: string, data: Record<string, unknown>) => {
            if (selected.has(nodeId)) {
              return { ...data, borderColor: paletteRef.current.selection_ring, borderSize: 3 };
            }
            return data;
          }),
        );
        sigma.refresh();
      }

      setLasso(null);
    },
    [lasso],
  );

  // -------------------------------------------------------------------------
  // P4-05 / P5-01: Context menu state — declared here (before P5-01 gesture
  // handlers) because handleGesturePointerDown fires setContextMenu on long-press.
  // -------------------------------------------------------------------------
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);

  // -------------------------------------------------------------------------
  // P5-01: Touch gesture state — two-finger pan, pinch-zoom, double-tap,
  //        long-press → context menu, long-press + drag → lasso start.
  //
  // One handler set using PointerEvent API (covers both mouse and touch).
  // Touch-specific branches are gated on navigator.maxTouchPoints > 0 or
  // pointer.pointerType === "touch" where the spec requires touch-only behavior.
  //
  // Gesture map (interaction spec §10):
  //   Two-finger pan   → simultaneously move 2 touch points → camera pan
  //   Pinch/spread     → 2-finger pinch → camera zoom in/out
  //   Single tap node  → select + popover (handled by sigma clickNode)
  //   Single tap empty → deselect (handled by sigma clickStage + P5-04)
  //   Double tap node  → k-hop focus k=2 (2 taps within 300ms)
  //   Double tap label → expand cluster (2 taps within 300ms on label)
  //   Long press 200ms → context menu (no >4px move)
  //   Long press+drag  → rubber-band selection (lasso; reuses P4-04 lasso)
  // -------------------------------------------------------------------------

  // Active pointers for multi-touch tracking.
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Two-finger gesture state (pan + pinch).
  const twoFingerStateRef = useRef<{
    prevMidX: number;
    prevMidY: number;
    prevDist: number;
  } | null>(null);

  // Double-tap state: track last tap time + node for each touch point.
  const lastTapRef = useRef<{
    time: number;
    nodeId: string | null;
    x: number;
    y: number;
  } | null>(null);

  // Long press timer handle.
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whether a long press has already fired (to avoid retriggering on move).
  const longPressFiredRef = useRef(false);

  // The node under the pointer at long-press-start.
  const longPressNodeRef = useRef<string | null>(null);

  // Whether the pointer has moved more than 4px since down (cancels long press).
  const longPressMoveRef = useRef<{ startX: number; startY: number }>({ startX: 0, startY: 0 });

  /**
   * Find the closest graphology node to a viewport coordinate using hitRadius.
   * Returns the node ID or null if no node is within its hitRadius.
   */
  const findNodeAtViewport = useCallback(
    (vx: number, vy: number): string | null => {
      if (!sigmaRef.current) return null;
      const sigma = sigmaRef.current;
      const graph = sigma.getGraph?.();
      if (!graph) return null;

      const graphCoord = sigma.viewportToGraph({ x: vx, y: vy });
      let hitNode: string | null = null;
      let minDist = Infinity;

      graph.forEachNode((nodeId: string, attrs: Record<string, unknown>) => {
        if (attrs.hidden) return;
        const displayData = sigma.getNodeDisplayData(nodeId);
        if (!displayData) return;
        const dx = displayData.x - graphCoord.x;
        const dy = displayData.y - graphCoord.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius =
          isTouchDevice && typeof attrs.hitRadius === "number"
            ? attrs.hitRadius
            : (attrs.size as number ?? 5);
        if (dist <= radius && dist < minDist) {
          minDist = dist;
          hitNode = nodeId;
        }
      });
      return hitNode;
    },
    [isTouchDevice],
  );

  /**
   * Trigger the k-hop focus (k=2) on a given node — equivalent to the
   * "double tap on node" gesture from §10.
   */
  const triggerKHopFocus = useCallback(
    (nodeId: string) => {
      setFocusedArtifactId(nodeId);
      const node = displayNodes.find((n) => n.id === nodeId);
      setFocusedArtifactTitle(node?.title ?? null);
      announce(`Focus mode entered from ${node?.title ?? nodeId}. K-hop neighborhood highlighted.`);
    },
    [displayNodes, setFocusedArtifactId, setFocusedArtifactTitle, announce],
  );

  // Touch-gesture pointer down handler (extends the existing lasso pointerDown).
  const handleGesturePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Track all active pointers.
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const pointerCount = activePointersRef.current.size;

      // ── Two-finger gesture start ─────────────────────────────────────────
      if (pointerCount === 2) {
        // Cancel any pending long press when a second finger lands.
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        // Cancel lasso — two-finger gesture takes priority.
        setLasso(null);

        const pts = Array.from(activePointersRef.current.values());
        const [a, b] = pts;
        twoFingerStateRef.current = {
          prevMidX: (a.x + b.x) / 2,
          prevMidY: (a.y + b.y) / 2,
          prevDist: Math.hypot(b.x - a.x, b.y - a.y),
        };
        return;
      }

      // ── Single pointer down ──────────────────────────────────────────────
      if (pointerCount === 1) {
        longPressFiredRef.current = false;
        longPressMoveRef.current = { startX: e.clientX, startY: e.clientY };

        // Find node under pointer for long press / double tap use.
        const rect = canvasContainerRef.current?.getBoundingClientRect();
        const vx = rect ? e.clientX - rect.left : e.clientX;
        const vy = rect ? e.clientY - rect.top : e.clientY;
        const nodeAtPointer = findNodeAtViewport(vx, vy);
        longPressNodeRef.current = nodeAtPointer;

        // Start long press timer (200ms).
        longPressTimerRef.current = setTimeout(() => {
          if (longPressFiredRef.current) return;
          longPressFiredRef.current = true;

          const nodeId = longPressNodeRef.current;
          if (nodeId) {
            // Long press on node → open context menu (§10).
            setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
          }
          // Long press + drag: start lasso (user must then drag).
          // The lasso itself is started by the existing pointerDown lasso logic
          // when the pointer moves. We just set the flag; actual lasso activation
          // happens in handleCanvasPointerMove once movement > 5px threshold.
        }, 200);
      }
    },
    [findNodeAtViewport],
  );

  const handleGesturePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Update tracked position.
      if (activePointersRef.current.has(e.pointerId)) {
        activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      const pointerCount = activePointersRef.current.size;

      // ── Two-finger pan + pinch ───────────────────────────────────────────
      if (pointerCount === 2 && twoFingerStateRef.current && sigmaRef.current) {
        const pts = Array.from(activePointersRef.current.values());
        const [a, b] = pts;

        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);

        const { prevMidX, prevMidY, prevDist } = twoFingerStateRef.current;

        const camera = sigmaRef.current.getCamera();
        const state = camera.getState();

        // Pan: translate camera by the midpoint delta (in graph coordinates).
        // sigma's camera ratio maps viewport px to graph units:
        // graphDelta = viewportDelta * ratio (approximate, ignores angle).
        const dxViewport = midX - prevMidX;
        const dyViewport = midY - prevMidY;
        const graphDxRaw = dxViewport * state.ratio;
        const graphDyRaw = dyViewport * state.ratio;

        // Pinch: adjust ratio proportionally to distance change.
        const pinchScale = prevDist > 0 ? prevDist / dist : 1;
        const newRatio = Math.max(
          camera.getBoundaries?.()?.minCameraRatio ?? 0.05,
          Math.min(camera.getBoundaries?.()?.maxCameraRatio ?? 20, state.ratio * pinchScale),
        );

        camera.setState({
          x: state.x - graphDxRaw,
          y: state.y - graphDyRaw,
          ratio: newRatio,
        });

        twoFingerStateRef.current = { prevMidX: midX, prevMidY: midY, prevDist: dist };
        return;
      }

      // ── Single pointer — cancel long press if moved >4px ─────────────────
      if (pointerCount === 1 && !longPressFiredRef.current) {
        const { startX, startY } = longPressMoveRef.current;
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (dx > 4 || dy > 4) {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
      }
    },
    [],
  );

  const handleGesturePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      activePointersRef.current.delete(e.pointerId);
      const remaining = activePointersRef.current.size;

      // Clear long press timer on pointer up.
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // Reset two-finger state when a finger lifts.
      if (remaining < 2) {
        twoFingerStateRef.current = null;
      }

      // Long press fired: don't interpret as tap or double tap.
      if (longPressFiredRef.current) {
        longPressFiredRef.current = false;
        return;
      }

      // ── Double-tap detection (300ms window) ──────────────────────────────
      if (e.pointerType === "touch") {
        const rect = canvasContainerRef.current?.getBoundingClientRect();
        const vx = rect ? e.clientX - rect.left : e.clientX;
        const vy = rect ? e.clientY - rect.top : e.clientY;
        const nodeAtPointer = findNodeAtViewport(vx, vy);

        const now = Date.now();
        const last = lastTapRef.current;

        if (last && now - last.time <= 300) {
          // Double tap detected.
          if (nodeAtPointer && nodeAtPointer === last.nodeId) {
            // Double tap on node → k-hop focus k=2.
            triggerKHopFocus(nodeAtPointer);
          } else if (!nodeAtPointer) {
            // Double tap on empty canvas → check if near a cluster label.
            // Cluster label expand is handled by the existing ClusterHalos
            // onClick which fires on the HTML overlay div; we don't duplicate
            // that here. If no label is found, just deselect.
            setPopover(null);
          }
          lastTapRef.current = null; // Reset after double-tap consumed.
          return;
        }

        // Record this tap for the next double-tap check.
        lastTapRef.current = {
          time: now,
          nodeId: nodeAtPointer,
          x: e.clientX,
          y: e.clientY,
        };

        // Clear the stale tap record after the 300ms window expires.
        setTimeout(() => {
          if (lastTapRef.current?.time === now) {
            lastTapRef.current = null;
          }
        }, 310);
      }
    },
    [findNodeAtViewport, triggerKHopFocus],
  );

  // -------------------------------------------------------------------------
  // P4-05: Context menu action handlers
  // (contextMenu state declared in P4-05/P5-01 section above)
  // -------------------------------------------------------------------------
  const handleContextMenuAction = {
    onFocusMode: useCallback((_mode: UrlFocusMode, nodeId: string) => {
      setFocusedArtifactId(nodeId);
      const node = displayNodes.find((n) => n.id === nodeId);
      setFocusedArtifactTitle(node?.title ?? null);
      announce(`Focus mode entered from ${node?.title ?? nodeId}. K-hop neighborhood highlighted.`);
    }, [displayNodes, setFocusedArtifactId, setFocusedArtifactTitle, announce]),

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

  // -------------------------------------------------------------------------
  // P5-05: Window-level keyboard handler for WCAG a11y navigation (§9).
  //
  // Placed after all state declarations (selectedNodeIds, router, etc.) so
  // there are no forward-reference errors. Runs on window so it intercepts
  // keys regardless of which element has DOM focus, but immediately returns
  // if a text field is active or if the canvas/kb-focus conditions aren't met.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const GROUPING_ORDER: import("@/lib/graph/groupingModes").GroupingMode[] = [
      "none",
      "workspace",
      "artifact_type",
      "project",
      "domain",
      "lens_cluster",
      "temporal",
      "semantic_cluster",
    ];

    function handler(e: globalThis.KeyboardEvent) {
      // Never swallow input in text fields.
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const canvasHasFocus =
        canvasContainerRef.current !== null &&
        (canvasContainerRef.current === document.activeElement ||
          canvasContainerRef.current.contains(document.activeElement));
      const hasKbFocus = keyboardFocusedRef.current !== null;

      switch (e.key) {
        // ---- Tab / Shift-Tab: cycle through tabOrder ----------------------
        case "Tab": {
          if (!canvasHasFocus && !hasKbFocus) return;
          if (tabOrder.length === 0) return;
          e.preventDefault();
          const cur = tabOrder.indexOf(keyboardFocusedRef.current ?? "");
          const dir = e.shiftKey ? -1 : 1;
          const next = (cur + dir + tabOrder.length) % tabOrder.length;
          setKeyboardFocusedNodeId(tabOrder[next] ?? null);
          break;
        }

        // ---- Arrow keys: neighbor traversal when a node has KB focus ------
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          if (!hasKbFocus) return; // fall through to existing camera-pan handler
          const sigma = sigmaRef.current;
          if (!sigma) return;
          const graphInstance = sigma.getGraph?.();
          if (!graphInstance) return;
          const cur = keyboardFocusedRef.current!;
          if (!graphInstance.hasNode(cur)) return;
          const neighbors: string[] = graphInstance.neighbors(cur);
          if (neighbors.length === 0) { e.preventDefault(); break; }
          const curDisplay = sigma.getNodeDisplayData(cur);
          if (!curDisplay) { e.preventDefault(); break; }
          let best: string | null = null;
          let bestScore = -Infinity;
          for (const nbId of neighbors) {
            const nd = sigma.getNodeDisplayData(nbId);
            if (!nd) continue;
            const dx = nd.x - curDisplay.x;
            const dy = nd.y - curDisplay.y;
            let score: number;
            if (e.key === "ArrowRight") score = dx;
            else if (e.key === "ArrowLeft") score = -dx;
            else if (e.key === "ArrowUp") score = -dy;
            else score = dy; // ArrowDown
            if (score > bestScore) { bestScore = score; best = nbId; }
          }
          if (best !== null) setKeyboardFocusedNodeId(best);
          e.preventDefault();
          break;
        }

        // ---- Space: toggle popover for KB-focused node --------------------
        case " ": {
          if (!hasKbFocus) return;
          e.preventDefault();
          const kbNodeId = keyboardFocusedRef.current!;
          const sigma2 = sigmaRef.current;
          if (sigma2) {
            const dd = sigma2.getNodeDisplayData(kbNodeId);
            const kbNode = displayNodes.find((n) => n.id === kbNodeId);
            if (dd && kbNode) {
              if (popover?.nodeId === kbNodeId) {
                setPopover(null);
              } else {
                setPopover({
                  nodeId: kbNodeId,
                  x: dd.x,
                  y: dd.y,
                  title: kbNode.title,
                  artifactType: kbNode.artifact_type,
                  workspace: kbNode.workspace,
                  updatedAt: kbNode.updated_at ?? null,
                });
              }
            }
          }
          break;
        }

        // ---- Enter: navigate to artifact detail ---------------------------
        case "Enter": {
          if (!hasKbFocus) return;
          e.preventDefault();
          router.push(`/artifacts/${keyboardFocusedRef.current}`);
          break;
        }

        // ---- Escape: priority chain ---------------------------------------
        case "Escape": {
          if (popover !== null) {
            e.preventDefault();
            setPopover(null);
          } else if (focusedArtifactId !== null) {
            e.preventDefault();
            setFocusedArtifactId(null);
            setFocusedArtifactTitle(null);
          } else if (selectedNodeIds.size > 0) {
            e.preventDefault();
            setSelectedNodeIds(new Set());
          } else if (hasKbFocus) {
            e.preventDefault();
            setKeyboardFocusedNodeId(null);
          }
          break;
        }

        // ---- f/F: toggle neighborhood focus for KB-focused node ----------
        case "f":
        case "F": {
          if (!hasKbFocus) return;
          e.preventDefault();
          const kbNodeId2 = keyboardFocusedRef.current!;
          if (focusedArtifactId === kbNodeId2) {
            setFocusedArtifactId(null);
            setFocusedArtifactTitle(null);
          } else {
            const kbNode2 = displayNodes.find((n) => n.id === kbNodeId2);
            setFocusedArtifactId(kbNodeId2);
            setFocusedArtifactTitle(kbNode2?.title ?? null);
          }
          break;
        }

        // ---- Cmd-A / Ctrl-A: select all ----------------------------------
        case "a":
        case "A": {
          if (!(e.metaKey || e.ctrlKey)) return;
          if (!canvasHasFocus && !hasKbFocus) return;
          e.preventDefault();
          setSelectedNodeIds(new Set(displayNodes.map((n) => n.id)));
          break;
        }

        // ---- Zoom: +/= in; -/_ out; 0 fit view --------------------------
        case "+":
        case "=": {
          if (!canvasHasFocus && !hasKbFocus) return;
          e.preventDefault();
          const cam = sigmaRef.current?.getCamera();
          if (cam) {
            if (prefersReducedMotion) {
              cam.setState({ ratio: cam.getState().ratio / 1.5 });
            } else {
              cam.animate({ ratio: cam.getState().ratio / 1.5 }, { duration: 150 });
            }
          }
          break;
        }
        case "-":
        case "_": {
          if (!canvasHasFocus && !hasKbFocus) return;
          e.preventDefault();
          const cam2 = sigmaRef.current?.getCamera();
          if (cam2) {
            if (prefersReducedMotion) {
              cam2.setState({ ratio: cam2.getState().ratio * 1.5 });
            } else {
              cam2.animate({ ratio: cam2.getState().ratio * 1.5 }, { duration: 150 });
            }
          }
          break;
        }
        case "0": {
          if (!canvasHasFocus && !hasKbFocus) return;
          e.preventDefault();
          if (prefersReducedMotion) {
            sigmaRef.current?.getCamera().setState({ x: 0, y: 0, ratio: 1, angle: 0 });
          } else {
            sigmaRef.current?.getCamera().animate({ x: 0, y: 0, ratio: 1, angle: 0 }, { duration: 300 });
          }
          sigmaRef.current?.refresh();
          break;
        }

        // ---- p/P: open saved views (best-effort via trigger click) -------
        case "p":
        case "P": {
          if (!canvasHasFocus && !hasKbFocus) return;
          e.preventDefault();
          // SavedViewsMenu is an uncontrolled Radix DropdownMenu; opening
          // programmatically is not supported. Best-effort: click its trigger
          // button via data-testid (requires SavedViewsMenu to expose that attr).
          (document.querySelector("[data-testid='saved-views-trigger']") as HTMLElement | null)?.click();
          break;
        }

        // ---- g/G: cycle grouping mode ------------------------------------
        case "g":
        case "G": {
          if (!canvasHasFocus && !hasKbFocus) return;
          e.preventDefault();
          const curGIdx = GROUPING_ORDER.indexOf(groupingMode);
          const nextGMode = GROUPING_ORDER[(curGIdx + 1) % GROUPING_ORDER.length] ?? "none";
          setGroupingMode(nextGMode);
          break;
        }

        default:
          break;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    tabOrder,
    displayNodes,
    popover,
    focusedArtifactId,
    selectedNodeIds,
    groupingMode,
    setGroupingMode,
    router,
    setFocusedArtifactTitle,
    prefersReducedMotion,
  ]);

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
          if (prefersReducedMotion || slowFrame) {
            sigma.getCamera().setState({ x: displayData.x, y: displayData.y, ratio: 0.5 });
          } else {
            sigma.getCamera().animate(
              { x: displayData.x, y: displayData.y, ratio: 0.5 },
              { duration: ANIMATION_TIMINGS.cameraJump.durationMs },
            );
          }
        }
        // Apply selection ring to matched node (P5-08: via paletteRef for palette-awareness)
        sigma.setSetting(
          "nodeReducer",
          wrapWithCameraScale(sigma, (nodeId: string, data: Record<string, unknown>) => {
            if (nodeId === result.id) {
              return { ...data, borderColor: paletteRef.current.selection_ring, borderSize: 3 };
            }
            return data;
          }),
        );
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
    announce(
      `All filters cleared. Showing ${displayNodes.length} nodes, ${displayEdges.length} edges.`,
    );
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
  // P5-05: prefer keyboardFocusedNodeId (degree-sorted Tab nav) over the
  // legacy focusedNodeId (P3-10 camera-pan tab).
  // -------------------------------------------------------------------------
  const currentFocusedNode = (keyboardFocusedNodeId ?? focusedNodeId)
    ? nodeList.find((n) => n.id === (keyboardFocusedNodeId ?? focusedNodeId))
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

      {/* P5-11: Onboarding overlay — first-visit hint dialog (§15) */}
      <GraphOnboardingOverlay
        open={onboardingOpen}
        onOpenChange={(o) => (o ? openOverlay() : dismissOverlay())}
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

      {/* P5-02: Mobile bottom-sheet filter panel (<768px) */}
      <GraphFilterSheet
        open={mobileFiltersOpen}
        onOpenChangeAction={setMobileFiltersOpen}
        activeFilterCount={activeFilterCount}
      >
        <FilterPanelContent
          searchValue={graphFilterValues.q}
          onSearchChange={(q) => setGraphFilter({ q })}
          activeFilterCount={activeFilterCount}
          onClearAll={handleOverlayClearAll}
          isFilterPending={isFilterPending}
          onApplyPreset={(partial) => setGraphFilter(partial)}
        >
          <GraphFilters
            values={graphFilterValues}
            onChange={(next) => setGraphFilter(next)}
            options={filterOptions}
          />
        </FilterPanelContent>
      </GraphFilterSheet>

      {/* ------------------------------------------------------------------ */}
      {/* Breadcrumb + page header (P3-01)                                    */}
      {/* ------------------------------------------------------------------ */}
      <header className="flex flex-wrap items-start justify-between gap-3 shrink-0 relative z-[60]">
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
      {/* Canvas body — full-width; floating overlays sit above via portal   */}
      {/* ------------------------------------------------------------------ */}

      {/* OVLY-004: Actions floating panel (top-right) — zoom, export, share */}
      {!isLoading && !isNeighborhoodLoading && displayNodes.length > 0 && (
        <FloatingPanel
          id="actions"
          anchor="top-right"
          shortcutKey="a"
          title="Actions"
          collapsedIcon={<Wrench className="size-5" />}
          wrapperClassName="top-24"
        >
          <div className="flex flex-col gap-3">
            {/* Zoom controls */}
            <div className="flex flex-col gap-1" role="group" aria-label="Zoom controls">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--mw-graph-text-secondary)] select-none">
                Zoom
              </span>
              <div className="flex gap-1">
                {(
                  [
                    { fn: handleZoomIn, label: "Zoom in", icon: <ZoomIn aria-hidden="true" className="size-3.5" /> },
                    { fn: handleZoomOut, label: "Zoom out", icon: <ZoomOut aria-hidden="true" className="size-3.5" /> },
                    { fn: handleFitView, label: "Fit graph to view", icon: <Crosshair aria-hidden="true" className="size-3.5" /> },
                    { fn: handleToggleFullscreen, label: "Toggle fullscreen", icon: <Maximize2 aria-hidden="true" className="size-3.5" /> },
                  ] as const
                ).map(({ fn, label, icon }) => (
                  <button
                    key={label}
                    type="button"
                    aria-label={label}
                    onClick={fn}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      "border border-[var(--mw-graph-border)]",
                      "text-[var(--mw-graph-text-secondary)]",
                      "transition-colors hover:bg-[var(--mw-graph-border)] hover:text-[var(--mw-graph-text-primary)]",
                      "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mw-graph-accent)]",
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Export */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--mw-graph-text-secondary)] select-none">
                Export
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label={isExporting ? "Exporting…" : "Export graph as PNG"}
                  onClick={handleExportPng}
                  disabled={isExporting}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                    "border border-[var(--mw-graph-border)]",
                    "text-[var(--mw-graph-text-secondary)]",
                    "transition-colors hover:bg-[var(--mw-graph-border)] hover:text-[var(--mw-graph-text-primary)]",
                    "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mw-graph-accent)]",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  <Download aria-hidden="true" className="size-3" />
                  PNG
                </button>
                <button
                  type="button"
                  aria-label={isExporting ? "Exporting…" : "Export graph as SVG"}
                  onClick={handleExportSvg}
                  disabled={isExporting}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                    "border border-[var(--mw-graph-border)]",
                    "text-[var(--mw-graph-text-secondary)]",
                    "transition-colors hover:bg-[var(--mw-graph-border)] hover:text-[var(--mw-graph-text-primary)]",
                    "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mw-graph-accent)]",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  <Download aria-hidden="true" className="size-3" />
                  SVG
                </button>
              </div>
            </div>

            {/* Share */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--mw-graph-text-secondary)] select-none">
                Share
              </span>
              <button
                type="button"
                aria-label="Share this graph view"
                onClick={() => setShareModalOpen(true)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                  "border border-[var(--mw-graph-border)]",
                  "text-[var(--mw-graph-text-secondary)]",
                  "transition-colors hover:bg-[var(--mw-graph-border)] hover:text-[var(--mw-graph-text-primary)]",
                  "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mw-graph-accent)]",
                )}
              >
                <Share2 aria-hidden="true" className="size-3" />
                Share link
              </button>
            </div>

            {/* REND-003: 2D / 3D render mode toggle
                MOBILE-002: disabled + tooltip when WebGL2 / device unsupported */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--mw-graph-text-secondary)] select-none">
                Renderer
              </span>
              {/* Nested TooltipProvider — (graph)/layout.tsx now supplies a
                  route-level provider; this nested one is kept for its local
                  delayDuration override on the WebGL-support warning tooltip. */}
              <TooltipProvider delayDuration={300}>
                <Tooltip open={!webGLSupport.supported ? undefined : false}>
                  {/* Wrap in a span when disabled so the tooltip trigger still receives
                      pointer events (the button itself has pointer-events-none when disabled) */}
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={!webGLSupport.supported ? 0 : undefined}
                      aria-label={!webGLSupport.supported ? webGLSupport.reason : undefined}
                      className="inline-flex"
                    >
                      <button
                        type="button"
                        aria-pressed={graphRenderMode === "3d"}
                        aria-label={
                          !webGLSupport.supported
                            ? "3D view (unavailable on this device)"
                            : is3DLoading
                            ? "Loading 3D layout…"
                            : graphRenderMode === "3d"
                            ? "Switch to 2D view"
                            : "Switch to 3D view"
                        }
                        aria-disabled={!webGLSupport.supported || undefined}
                        onClick={() => {
                          if (!webGLSupport.supported) return;
                          void handleToggleRenderMode();
                        }}
                        disabled={is3DLoading || !webGLSupport.supported}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                          "border",
                          "transition-colors",
                          "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mw-graph-accent)]",
                          "disabled:pointer-events-none disabled:opacity-50",
                          graphRenderMode === "3d"
                            ? "border-[var(--mw-graph-accent)] bg-[var(--mw-graph-accent)]/15 text-[var(--mw-graph-accent)]"
                            : "border-[var(--mw-graph-border)] text-[var(--mw-graph-text-secondary)] hover:bg-[var(--mw-graph-border)] hover:text-[var(--mw-graph-text-primary)]",
                        )}
                      >
                        {is3DLoading ? (
                          <>
                            <svg
                              aria-hidden="true"
                              className="size-3 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Loading…
                          </>
                        ) : graphRenderMode === "3d" ? (
                          <>
                            <Layers aria-hidden="true" className="size-3" />
                            2D view
                          </>
                        ) : (
                          <>
                            <Network aria-hidden="true" className="size-3" />
                            3D view
                          </>
                        )}
                      </button>
                    </span>
                  </TooltipTrigger>
                  {!webGLSupport.supported && (
                    <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                      {webGLSupport.reason ?? "3D mode is not available on this device."}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </FloatingPanel>
      )}

      {/* OVLY-002: Filters floating panel — desktop only (mobile uses GraphFilterSheet below) */}
      {!isNeighborhoodMode && (
        <div className="hidden md:block">
          <FloatingPanel
            id="filters"
            anchor="top-left"
            defaultOpen={sidebarOpen}
            shortcutKey="f"
            title="Filters"
            collapsedIcon={<Filter className="size-5" />}
            wrapperClassName="top-24"
          >
            {/* Active-filter count badge rendered in panel body header */}
            {activeFilterCount > 0 && (
              <div className="mb-2 flex items-center gap-1.5">
                <span
                  aria-label={`${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`}
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 bg-primary/15 text-primary text-[10px] font-semibold leading-none"
                >
                  {activeFilterCount}
                </span>
                <span className="text-[10px] text-[var(--mw-graph-text-secondary)]">
                  active filter{activeFilterCount === 1 ? "" : "s"}
                </span>
              </div>
            )}
            {/* P3-03: subtle loading indicator during debounce/refetch window */}
            {isFilterPending && (
              <div
                aria-live="polite"
                aria-label="Updating graph…"
                className="mb-1 text-[10px] text-[var(--mw-graph-text-secondary)] animate-pulse"
              >
                Updating…
              </div>
            )}
            <FilterPanelContent
              searchValue={graphFilterValues.q}
              onSearchChange={(q) => setGraphFilter({ q })}
              activeFilterCount={activeFilterCount}
              onClearAll={handleOverlayClearAll}
              onApplyPreset={(partial) => setGraphFilter(partial)}
            >
              <GraphFilters
                values={graphFilterValues}
                onChange={(next) => setGraphFilter(next)}
                // Facet options: API spec v2.2 VaultGraphResponse does not include
                // facet aggregates. Options are derived client-side from loaded nodes.
                options={filterOptions}
              />
            </FilterPanelContent>
          </FloatingPanel>
        </div>
      )}

      <div className="flex flex-1 min-h-0 items-stretch">

        {/* Main canvas area */}
        <section
          aria-label={
            isNeighborhoodMode
              ? `Neighborhood graph for ${focusedArtifactTitle ?? "artifact"}`
              : "Vault knowledge graph"
          }
          aria-busy={isLoading || isNeighborhoodLoading}
          className="flex flex-1 min-w-0 flex-col gap-3"
          data-renderer={graphRenderMode}
          data-graph-mode={graphMode}
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
            <div className="flex items-center gap-2 flex-wrap" data-tour="graph-lod-selector">
              <EncodingToolbar
                colorMode={colorMode}
                sizeMode={sizeMode}
                onColorModeChange={setColorMode}
                onSizeModeChange={setSizeMode}
              />
              {/* P5-08: Graph settings (palette toggle) */}
              <GraphSettingsMenu />
              {/* P5-11: Onboarding tips re-open button */}
              <button
                type="button"
                aria-label="Show graph onboarding tips"
                onClick={openOverlay}
                className={cn(
                  "flex items-center justify-center rounded-md border px-2 py-1 text-xs font-medium",
                  "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <HelpCircle aria-hidden="true" className="size-3.5" />
              </button>
              {/* P3-09: Grouping selector */}
              <div className="flex items-center gap-0.5" data-tour="graph-cluster-controls">
                <GraphGroupingSelector
                  mode={groupingMode}
                  onChange={setGroupingMode}
                />
                <InfoTooltip
                  content={TOOLTIP_COPY.graph.clusterBySelector}
                  side="bottom"
                  align="center"
                  icon="info"
                  label="About cluster-by grouping"
                />
              </div>
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
              <div className="flex items-center gap-0.5" data-tour="graph-export-button">
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
                <InfoTooltip
                  content={TOOLTIP_COPY.graph.exportButton}
                  side="bottom"
                  align="center"
                  icon="info"
                  label="About graph export"
                />
              </div>

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

          {/* P3-06 (v2.3 onboarding): First-run tour offer banner */}
          <FirstRunOffer tourId="graph" tourLabel="Graph Explorer" />

          {/* P5-03: Opt-in warning banner — shown before canvas when matrix = opt-in-warning */}
          {effectiveDegradeConfig?.mode === "opt-in-warning" && !optInOverride && !isNeighborhoodMode && (
            <OptInWarningBanner
              nodeCount={totalNodeCount}
              onShowList={() => setFallbackView("list")}
              onTryGraph={() => setOptInOverride(true)}
            />
          )}

          {/* Graph canvas — shown when view is "graph" or neighborhood mode,
              AND not blocked by the auto-degrade list-only matrix result,
              AND not waiting for opt-in confirmation on a slow device */}
          {(!degraded || isNeighborhoodMode || fallbackView === "graph") &&
            !isDegradeListOnly &&
            (effectiveDegradeConfig?.mode !== "opt-in-warning" || optInOverride) && (
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
                  {/* REND-003: 3D renderer branch — active when graphRenderMode === '3d'.
                   * key={graphRenderMode} ensures React unmounts the 3D renderer fully
                   * (and releases its WebGL context) when switching back to 2D. */}
                  {graphRenderMode === "3d" && graphData3D ? (
                    <div
                      key="renderer-3d"
                      data-renderer="3d"
                      data-selected-node-ids={[...selectedNodeIds].join(",")}
                      className={cn(
                        "relative flex-1 min-h-[400px] rounded-lg border overflow-hidden",
                        mobileFiltersOpen && "opacity-50 pointer-events-none",
                      )}
                      style={{ background: "var(--mw-graph-bg, #0d0d0f)" }}
                      aria-label={`3D knowledge graph with ${graphData3D.nodes.length.toLocaleString()} nodes.`}
                    >
                      <GraphRenderer3DLazy
                        graphData={graphData3D}
                        selectedNodeIds={selectedNodeIds}
                        onSelectionChange={(ids) =>
                          setSelectedNodeIds(new Set(ids))
                        }
                      />
                    </div>
                  ) : graphRenderMode === "3d" && is3DLoading ? (
                    <div
                      key="renderer-3d-loading"
                      className="relative flex-1 min-h-[400px] rounded-lg border overflow-hidden"
                      style={{ background: "var(--mw-graph-bg, #0d0d0f)" }}
                    >
                      <Graph3DLoadingSkeleton />
                    </div>
                  ) : activeRenderer === "cosmos" && !isNeighborhoodMode && displayNodes.length > 0 ? (
                    // ----------------------------------------------------------------
                    // cosmos.gl branch — lazy chunk (P2-08)
                    // CosmosGraphWrapper is dynamically imported above; webpack will
                    // place @cosmos.gl/graph in a separate split chunk.
                    // key={graphRenderMode} ensures cosmos is unmounted when switching
                    // to 3D (so its WebGL context is released before 3D mounts).
                    // ----------------------------------------------------------------
                    <div
                      key={`renderer-cosmos-${graphRenderMode}`}
                      className={cn(
                        "relative flex-1 min-h-[400px] rounded-lg border bg-slate-900 overflow-hidden",
                        // P5-02: dim canvas while mobile filter sheet is open
                        mobileFiltersOpen && "opacity-50 pointer-events-none",
                      )}
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
                         * P4-04: The graph canvas uses role="application" (P5-05 upgrade from
                         * role="img") with a descriptive aria-label and is focusable (tabIndex=0).
                         * When focused, Tab cycles through nodes by degree (handled in window
                         * keydown handler), arrow keys traverse neighbors, Space toggles popover,
                         * Enter navigates to artifact detail, Escape handles priority chain.
                         * Focus ring is provided by focus-visible:ring-2.
                         * Interactive controls outside this div (zoom buttons, filters, pagination)
                         * remain in the normal Tab order and are NOT intercepted.
                         */}
                        <div
                          key={`renderer-sigma-${graphRenderMode}`}
                          ref={canvasContainerRef}
                          role="application"
                          data-testid="graph-canvas"
                          data-tour="graph-canvas"
                          data-selected-node-ids={[...selectedNodeIds].join(",")}
                          aria-label={`Knowledge graph — ${displayNodes.length} nodes visible. Tab to cycle nodes by degree, arrow keys to traverse neighbors, Space to open popover, Enter for detail, Escape to dismiss. Shift+drag to select multiple nodes.${selectedNodeIds.size > 0 ? ` ${selectedNodeIds.size} nodes selected.` : ""}`}
                          tabIndex={0}
                          onKeyDown={handleKeyDown}
                          onPointerDown={(e) => {
                            // P5-01: gesture handler runs first (tracks pointers, starts long-press timer).
                            handleGesturePointerDown(e);
                            // P4-04: lasso handler runs for single-pointer drags.
                            if (activePointersRef.current.size <= 1) {
                              handleCanvasPointerDown(e);
                            }
                          }}
                          onPointerMove={(e) => {
                            // P5-01: gesture handler (two-finger pan/pinch, long-press cancel).
                            handleGesturePointerMove(e);
                            // P4-04: lasso tracking (single pointer only).
                            if (activePointersRef.current.size <= 1) {
                              handleCanvasPointerMove(e);
                            }
                          }}
                          onPointerUp={(e) => {
                            // P5-01: gesture handler (double-tap, long-press cleanup).
                            handleGesturePointerUp(e);
                            // P4-04: lasso completion.
                            handleCanvasPointerUp(e);
                          }}
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
                            // P5-02: dim canvas to 50% opacity while mobile filter sheet is open
                            mobileFiltersOpen && "opacity-50 pointer-events-none",
                          )}
                        >
                          <SigmaContainer
                            graph={graph}
                            // Absolute fill of relative parent. height:100% doesn't
                            // resolve when parent has only min-height (not an explicit
                            // height), so Sigma reads clientHeight=0 on init and throws
                            // "Container has no height".
                            style={{ position: "absolute", inset: 0 }}
                            settings={{
                              renderEdgeLabels: false,
                              defaultEdgeType: "arrow",
                              defaultNodeType: "circle",
                              // nodeProgramClasses is intentionally omitted: sigma 3.x
                              // already registers NodeCircleProgram for "circle" via
                              // DEFAULT_NODE_PROGRAM_CLASSES. Passing an explicit
                              // override imported from "sigma/rendering" triggers a
                              // webpack module-instance mismatch (CJS vs. ESM path)
                              // that causes the "could not find a suitable program for
                              // node type 'circle'" runtime error on remote deployments.
                              // Container height may be 0 on initial mount before
                              // the absolute-positioned parent finishes layout;
                              // sigma's resize() retries on container change so
                              // tolerating an invalid-container start avoids a
                              // one-shot ErrorBoundary trip.
                              allowInvalidContainer: true,
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
                              onSelect={handleSelectPopover}
                              onSigmaReady={handleSigmaReady}
                              filterValues={graphFilterValues}
                              searchQuery={graphFilterValues.q}
                              onServerSearchNeededAction={setServerSearchQuery}
                              groupingMode={groupingMode}
                              onExpandCluster={expandCluster}
                              onFa2WorkerReady={handleFa2WorkerReady}
                              touchHitRadius={isTouchDevice}
                              prefersReducedMotion={prefersReducedMotion}
                              graphMode={graphMode}
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

                          {/* ZoomControls migrated to OVLY-004 FloatingPanel (actions, top-right) */}

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

                        {/* Screen-reader fallback list (P3-11) — sr-only so
                            it stays in the a11y tree without consuming any
                            visible vertical space; the graph canvas now takes
                            the full remaining height of the column. */}
                        <div id="graph-sr-fallback" className="sr-only">
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

      </div>

      {/* OVLY-003: Legend floating panel — available at all desktop sizes */}
      <FloatingPanel
        id="legend"
        anchor="bottom-left"
        defaultOpen={false}
        shortcutKey="l"
        title="Legend"
        collapsedIcon={<Palette className="size-5" />}
      >
        <GraphLegend
          defaultExpanded={false}
          colorMode={colorMode}
          sizeMode={sizeMode}
          className="bg-transparent"
        />
      </FloatingPanel>
    </div>
  );
}
