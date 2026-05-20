/**
 * cameraPresets.ts — 7 named camera viewpoints for the vault graph.
 *
 * Each preset is a pure function that accepts a sigma instance, a graphology-
 * like graph, and an optional context object.  All transitions animate at
 * 400 ms via sigma.getCamera().animate().
 *
 * Design notes:
 *  - **void-return signature** (not Promise).  sigma v3's camera.animate()
 *    fires-and-forgets; callers do not need to await completion, and the
 *    upstream page component (VaultGraphPageClient) stores sigma in a plain
 *    ref rather than async state.  Async returns would add complexity with no
 *    benefit.
 *  - **GraphologyLike interface** (mirrors labeling.ts) so the module stays
 *    unit-testable without a real WebGL context or graphology import.
 *  - **SigmaLike interface** captures only the subset of the sigma v3 API
 *    this module uses.  Import sigma as `any` at the call-site; type-safe here.
 *
 * Preset catalogue:
 *   default              — full-graph fit (x=0.5, y=0.5, ratio=1)
 *   focus-node           — zoom to a single node (context.nodeId required)
 *   fit-selection        — fit bounding box around a set of nodes (context.nodeIds)
 *   high-fidelity-core   — fit nodes with fidelity_level === 'F4'
 *   recent-activity      — fit nodes with freshness_class === 'current'
 *   low-confidence-review— fit nodes with classification_confidence < 0.7
 *   research-threads     — fit nodes with workspace === 'research'
 *
 * Fallback: if an attribute filter yields no matching nodes, the preset logs a
 * warning and falls back to the `default` viewpoint.
 *
 * P2-06 task.
 */

// ---------------------------------------------------------------------------
// Minimal sigma / graphology interfaces (no WebGL import)
// ---------------------------------------------------------------------------

/** Subset of the sigma v3 Camera interface used by presets. */
export interface SigmaCamera {
  getState(): CameraState;
  setState(state: Partial<CameraState>): void;
  animate(state: Partial<CameraState>, opts: { duration: number }): void;
}

/** Sigma v3 camera state — only the fields presets need. */
export interface CameraState {
  x: number;
  y: number;
  ratio: number;
  angle?: number;
}

/** Slim sigma instance interface (matches sigma v3's public surface). */
export interface SigmaLike {
  getCamera(): SigmaCamera;
  /**
   * Convert a graph-space coordinate to a viewport pixel coordinate.
   * Returns an object with { x, y } pixel values.
   */
  graphToViewport(coords: { x: number; y: number }): { x: number; y: number };
  /**
   * Convert a viewport pixel coordinate back to graph-space.
   */
  viewportToGraph(coords: { x: number; y: number }): { x: number; y: number };
  /**
   * Returns the display data for a node (after reducer pipeline), or undefined.
   */
  getNodeDisplayData(nodeId: string): { x: number; y: number } | undefined;
  /**
   * Container dimensions (for viewport centre conversion).
   * In sigma v3 this is available as sigma.getDimensions().
   */
  getDimensions(): { width: number; height: number };
}

/**
 * Minimal graphology-like graph interface (mirrors labeling.ts GraphologyLike).
 * The preset attribute filters access node attributes by key.
 */
export interface GraphLike {
  nodes(): string[];
  getNodeAttributes(nodeId: string): Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Preset context types
// ---------------------------------------------------------------------------

/** Optional context passed to presets that require additional input. */
export interface PresetContext {
  /** Required by `focus-node`. A single node ID to centre on. */
  nodeId?: string;
  /** Required by `fit-selection`. List of node IDs to frame. */
  nodeIds?: string[];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresetName =
  | "default"
  | "focus-node"
  | "fit-selection"
  | "high-fidelity-core"
  | "recent-activity"
  | "low-confidence-review"
  | "research-threads";

/** Preset function signature. */
export type PresetFn = (
  sigma: SigmaLike,
  graph: GraphLike,
  context?: PresetContext,
) => void;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const ANIMATE_DURATION = 400;

/** Default camera state — full-graph fit centred at origin. */
const DEFAULT_STATE: CameraState = { x: 0.5, y: 0.5, ratio: 1 };

/**
 * Compute a tight bounding box over a list of node IDs using sigma display
 * data (which accounts for the ForceAtlas2 layout, reducers, etc.).
 *
 * Returns null when:
 *   - nodeIds is empty
 *   - none of the supplied IDs have display data (graph not loaded yet)
 */
function computeBbox(
  sigma: SigmaLike,
  nodeIds: string[],
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (nodeIds.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let valid = 0;

  for (const id of nodeIds) {
    const display = sigma.getNodeDisplayData(id);
    if (!display) continue;
    if (display.x < minX) minX = display.x;
    if (display.x > maxX) maxX = display.x;
    if (display.y < minY) minY = display.y;
    if (display.y > maxY) maxY = display.y;
    valid += 1;
  }

  if (valid === 0) return null;
  return { minX, maxX, minY, maxY };
}

/**
 * Convert a graph-space bounding box into a CameraState that frames it with
 * a small margin (10% each side).
 *
 * The ratio is computed so the larger of (bbox width, bbox height) fits the
 * viewport.  For a single-node bbox (point), ratio defaults to 0.4.
 *
 * sigma v3 camera maths:
 *   The camera ratio is the number of graph units that map to one viewport
 *   unit.  A ratio of 1 means the graph coordinate system maps 1:1 to the
 *   viewport.  Lower ratio = zoomed in.
 */
function bboxToCameraState(
  sigma: SigmaLike,
  bbox: { minX: number; maxX: number; minY: number; maxY: number },
): CameraState {
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;

  const bboxWidth = bbox.maxX - bbox.minX;
  const bboxHeight = bbox.maxY - bbox.minY;

  // For a degenerate single-point bbox, use a fixed close-up ratio.
  if (bboxWidth < 1e-6 && bboxHeight < 1e-6) {
    return { x: centerX, y: centerY, ratio: 0.4 };
  }

  // Add 10% margin on each side.
  const paddedWidth = bboxWidth * 1.2;
  const paddedHeight = bboxHeight * 1.2;

  const dims = sigma.getDimensions();
  const viewportWidth = dims.width > 0 ? dims.width : 800;
  const viewportHeight = dims.height > 0 ? dims.height : 600;

  // Ratio such that the larger extent fills its viewport axis.
  const ratioX = paddedWidth / viewportWidth;
  const ratioY = paddedHeight / viewportHeight;
  const ratio = Math.max(ratioX, ratioY, 0.05); // never zoom in past 0.05

  return { x: centerX, y: centerY, ratio };
}

/**
 * Filter graph nodes by an attribute predicate, animate to fit the matching
 * subset.  Falls back to `default` state (with a console.warn) when the
 * filter produces zero matching nodes.
 */
function fitFilteredNodes(
  sigma: SigmaLike,
  graph: GraphLike,
  predicate: (attrs: Record<string, unknown>) => boolean,
  presetLabel: string,
): void {
  const matchingIds: string[] = [];
  for (const id of graph.nodes()) {
    const attrs = graph.getNodeAttributes(id);
    if (predicate(attrs)) {
      matchingIds.push(id);
    }
  }

  const bbox = computeBbox(sigma, matchingIds);
  if (!bbox) {
    console.warn(
      `[cameraPresets] Preset "${presetLabel}" matched no nodes — falling back to default view.`,
    );
    sigma.getCamera().animate(DEFAULT_STATE, { duration: ANIMATE_DURATION });
    return;
  }

  const state = bboxToCameraState(sigma, bbox);
  sigma.getCamera().animate(state, { duration: ANIMATE_DURATION });
}

// ---------------------------------------------------------------------------
// The 7 named presets
// ---------------------------------------------------------------------------

/**
 * Reset to a full-graph fit centred at the graph's origin coordinate.
 * Works well for ForceAtlas2 layouts which spread nodes around (0.5, 0.5).
 */
function presetDefault(sigma: SigmaLike, _graph: GraphLike): void {
  sigma.getCamera().animate(DEFAULT_STATE, { duration: ANIMATE_DURATION });
}

/**
 * Zoom to a single node.
 *
 * Requires `context.nodeId`.  If the node cannot be found in sigma's display
 * data, falls back to `default`.
 */
function presetFocusNode(
  sigma: SigmaLike,
  _graph: GraphLike,
  context?: PresetContext,
): void {
  const nodeId = context?.nodeId;
  if (!nodeId) {
    console.warn(
      '[cameraPresets] Preset "focus-node" requires context.nodeId — falling back to default.',
    );
    sigma.getCamera().animate(DEFAULT_STATE, { duration: ANIMATE_DURATION });
    return;
  }

  const display = sigma.getNodeDisplayData(nodeId);
  if (!display) {
    console.warn(
      `[cameraPresets] Preset "focus-node": node "${nodeId}" has no display data — falling back to default.`,
    );
    sigma.getCamera().animate(DEFAULT_STATE, { duration: ANIMATE_DURATION });
    return;
  }

  sigma.getCamera().animate(
    { x: display.x, y: display.y, ratio: 0.3 },
    { duration: ANIMATE_DURATION },
  );
}

/**
 * Fit the viewport to a bounding box around a supplied list of node IDs.
 *
 * Requires `context.nodeIds`.  Falls back to `default` when the list is empty
 * or no display data is available for any listed node.
 */
function presetFitSelection(
  sigma: SigmaLike,
  _graph: GraphLike,
  context?: PresetContext,
): void {
  const nodeIds = context?.nodeIds ?? [];
  if (nodeIds.length === 0) {
    console.warn(
      '[cameraPresets] Preset "fit-selection" called with empty context.nodeIds — falling back to default.',
    );
    sigma.getCamera().animate(DEFAULT_STATE, { duration: ANIMATE_DURATION });
    return;
  }

  const bbox = computeBbox(sigma, nodeIds);
  if (!bbox) {
    console.warn(
      '[cameraPresets] Preset "fit-selection": no display data found for provided nodeIds — falling back to default.',
    );
    sigma.getCamera().animate(DEFAULT_STATE, { duration: ANIMATE_DURATION });
    return;
  }

  const state = bboxToCameraState(sigma, bbox);
  sigma.getCamera().animate(state, { duration: ANIMATE_DURATION });
}

/**
 * Zoom to the cluster of nodes at fidelity level F4 (highest knowledge depth).
 *
 * Matches `fidelity_level === 'F4'` on the node's graphology attributes.
 * The attribute may come from the P2 DTO or the VaultGraphNodeExtended fields
 * populated in labeling.ts.
 */
function presetHighFidelityCore(sigma: SigmaLike, graph: GraphLike): void {
  fitFilteredNodes(
    sigma,
    graph,
    (attrs) => attrs["fidelity_level"] === "F4",
    "high-fidelity-core",
  );
}

/**
 * Zoom to nodes whose freshness class is 'current' (recently updated artifacts).
 *
 * Matches `freshness_class === 'current'`.
 */
function presetRecentActivity(sigma: SigmaLike, graph: GraphLike): void {
  fitFilteredNodes(
    sigma,
    graph,
    (attrs) => attrs["freshness_class"] === "current",
    "recent-activity",
  );
}

/**
 * Zoom to nodes with classification confidence below the review threshold.
 *
 * Matches `classification_confidence < 0.7`.  Artifacts in this set are
 * candidates for human review or reclassification.
 */
function presetLowConfidenceReview(sigma: SigmaLike, graph: GraphLike): void {
  fitFilteredNodes(
    sigma,
    graph,
    (attrs) => {
      const conf = attrs["classification_confidence"];
      return typeof conf === "number" && conf < 0.7;
    },
    "low-confidence-review",
  );
}

/**
 * Zoom to artifacts in the 'research' workspace.
 *
 * Matches `workspace === 'research'`.
 */
function presetResearchThreads(sigma: SigmaLike, graph: GraphLike): void {
  fitFilteredNodes(
    sigma,
    graph,
    (attrs) => attrs["workspace"] === "research",
    "research-threads",
  );
}

// ---------------------------------------------------------------------------
// Exported preset map
// ---------------------------------------------------------------------------

/**
 * Named camera presets for the vault graph.
 *
 * Usage:
 *   ```ts
 *   import { cameraPresets } from "@/lib/graph/cameraPresets";
 *
 *   // Inside a component that has access to sigma and graph:
 *   cameraPresets["focus-node"](sigma, graph, { nodeId: "abc-123" });
 *   cameraPresets["high-fidelity-core"](sigma, graph);
 *   ```
 */
export const cameraPresets: Record<PresetName, PresetFn> = {
  default: presetDefault,
  "focus-node": presetFocusNode,
  "fit-selection": presetFitSelection,
  "high-fidelity-core": presetHighFidelityCore,
  "recent-activity": presetRecentActivity,
  "low-confidence-review": presetLowConfidenceReview,
  "research-threads": presetResearchThreads,
};
