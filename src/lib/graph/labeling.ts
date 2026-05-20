/**
 * labeling.ts — Label density and rank utilities for the vault graph.
 *
 * Adapted from codebase-map/utils/labeling.ts for MeatyWiki VaultGraphNode
 * attribute types. Key adaptations:
 *
 *  - Node shape: VaultGraphNode + graphology-computed degree (passed explicitly)
 *    instead of codebase-map's `Node.totalDegree`.
 *  - Rank formula: `degree + fidelity_level_numeric + lens_score_depth`
 *    (replaces codebase-map's importance/hotness/entrypoint/size signals).
 *  - Zoom buckets 0-3 use caps 70/130/240/420 (unchanged from source).
 *  - Hysteresis: ±0.08 at each threshold edge (unchanged from source).
 *
 * Type deviations from P2-02 contract (see below):
 *
 *  - `VaultGraphNode` in src/types/graph.ts does NOT yet carry extended P2
 *    DTO fields. The interface `VaultGraphNodeExtended` declared here adds
 *    the optional fields the P2 backend will supply:
 *      • `fidelity_level?: "F0"|"F1"|"F2"|"F3"|"F4"|null`
 *      • `lens_scores_jsonb?: { depth?: number; [key: string]: number | undefined } | null`
 *    When `src/types/graph.ts` is updated by P2-09 to include these fields,
 *    the intersection type below should be replaced with a direct import.
 *
 *  - `shouldRenderLabel` accepts a `CameraState` rather than a sigma Camera
 *    instance. Callers destructure `sigma.getCamera().getState()` before
 *    passing — this keeps the module free of a direct sigma import and makes
 *    it unit-testable without a WebGL context.
 *
 * Integration (P2-09 wiring):
 *
 *  The `shouldRenderLabel` callback is designed for sigma v3's
 *  `SigmaContainer settings.shouldRenderLabel` slot. Wire it with a 250ms
 *  debounce on the `afterRender` event:
 *
 *  ```ts
 *  import { createLabelRenderer, shouldRenderLabel } from "@/lib/graph/labeling";
 *
 *  // Inside a SigmaContainer child that has access to useSigma():
 *  const sigma = useSigma();
 *  const labelRenderer = createLabelRenderer(sigma.getGraph());
 *
 *  useEffect(() => {
 *    const handler = debounce(() => {
 *      sigma.setSetting("shouldRenderLabel", (nodeId: string) =>
 *        labelRenderer.shouldRenderLabel(
 *          nodeId,
 *          sigma.getCamera().getState().ratio,
 *        ),
 *      );
 *    }, 250);
 *    sigma.on("afterRender", handler);
 *    return () => {
 *      sigma.removeListener("afterRender", handler);
 *      handler.cancel();
 *    };
 *  }, [sigma, labelRenderer]);
 *  ```
 *
 * Implements: FR-06; ADR §6.
 * P2-02 task.
 */

import type { VaultGraphNode } from "@/types/graph";

// ---------------------------------------------------------------------------
// Extended node type (forward-compat until P2-09 updates src/types/graph.ts)
// ---------------------------------------------------------------------------

/** Fidelity level as returned by the P2 backend DTO. */
export type FidelityLevel = "F0" | "F1" | "F2" | "F3" | "F4";

/** Lens score map as returned by the P2 backend DTO. */
export interface LensScoresJsonb {
  depth?: number;
  [key: string]: number | undefined;
}

/**
 * Extended VaultGraphNode — adds optional P2 DTO fields not yet in the base
 * type. Code that has already deserialized the P2 API response can pass nodes
 * of this shape; older code passing a plain `VaultGraphNode` still compiles
 * because all added fields are optional.
 */
export type VaultGraphNodeExtended = VaultGraphNode & {
  /** Fidelity level F0..F4 from the artifact metadata. */
  fidelity_level?: FidelityLevel | null;
  /**
   * Lens dimension scores keyed by lens name. The `depth` entry is used for
   * the label rank formula.
   */
  lens_scores_jsonb?: LensScoresJsonb | null;
};

// ---------------------------------------------------------------------------
// Zoom bucket thresholds and hysteresis
//
// Sigma camera `ratio`: 1 = default zoom; < 1 = zoomed in (fewer nodes
// visible); > 1 = zoomed out (more nodes visible). Higher ratio = lower
// effective zoom level. We invert: effectiveZoom = 1 / ratio, so the
// thresholds below map ratio to bucket in a way that matches "zoomed in ↔
// more labels" intuition.
//
// Threshold semantics (effectiveZoom = 1/ratio):
//   bucket 0 (lowest zoom): effectiveZoom < 0.45  →  show at most 70 labels
//   bucket 1             :  0.45 ≤ effectiveZoom < 0.9  →  130 labels
//   bucket 2             :  0.9  ≤ effectiveZoom < 1.8  →  240 labels
//   bucket 3 (highest)   :  effectiveZoom ≥ 1.8  →  420 labels
// ---------------------------------------------------------------------------

const LABEL_THRESHOLDS: readonly [number, number, number] = [0.45, 0.9, 1.8];
const LABEL_HYSTERESIS = 0.08;

/** Label cap per bucket (index 0 = least-zoomed). */
const LABEL_CAPS: readonly [number, number, number, number] = [70, 130, 240, 420];

// ---------------------------------------------------------------------------
// Fidelity level mapping
// ---------------------------------------------------------------------------

const FIDELITY_NUMERIC: Record<FidelityLevel, number> = {
  F0: 0,
  F1: 1,
  F2: 2,
  F3: 3,
  F4: 4,
};

/**
 * Map a fidelity level string to a 0-4 integer.
 * Returns 0 for null / unrecognised values.
 */
export function fidelityToNumeric(level: FidelityLevel | null | undefined): number {
  if (level == null) return 0;
  return FIDELITY_NUMERIC[level] ?? 0;
}

// ---------------------------------------------------------------------------
// Bucket selection (initial + hysteresis-guarded)
// ---------------------------------------------------------------------------

/**
 * Determine the initial bucket purely from the effective zoom level.
 * Does not apply hysteresis — use `getNextLabelBucket` for incremental updates.
 */
export function getInitialLabelBucket(effectiveZoom: number): 0 | 1 | 2 | 3 {
  if (effectiveZoom < LABEL_THRESHOLDS[0]) return 0;
  if (effectiveZoom < LABEL_THRESHOLDS[1]) return 1;
  if (effectiveZoom < LABEL_THRESHOLDS[2]) return 2;
  return 3;
}

/**
 * Given the current bucket and new effective zoom, return the new bucket
 * guarded by ±LABEL_HYSTERESIS to prevent thrash at bucket edges.
 *
 * A bucket only changes when the zoom crosses the threshold by more than the
 * hysteresis margin.
 */
export function getNextLabelBucket(
  effectiveZoom: number,
  current: 0 | 1 | 2 | 3,
): 0 | 1 | 2 | 3 {
  if (current === 0) {
    return effectiveZoom > LABEL_THRESHOLDS[0] + LABEL_HYSTERESIS ? 1 : 0;
  }
  if (current === 1) {
    if (effectiveZoom < LABEL_THRESHOLDS[0] - LABEL_HYSTERESIS) return 0;
    return effectiveZoom > LABEL_THRESHOLDS[1] + LABEL_HYSTERESIS ? 2 : 1;
  }
  if (current === 2) {
    if (effectiveZoom < LABEL_THRESHOLDS[1] - LABEL_HYSTERESIS) return 1;
    return effectiveZoom > LABEL_THRESHOLDS[2] + LABEL_HYSTERESIS ? 3 : 2;
  }
  // current === 3
  return effectiveZoom < LABEL_THRESHOLDS[2] - LABEL_HYSTERESIS ? 2 : 3;
}

// ---------------------------------------------------------------------------
// Label budget
// ---------------------------------------------------------------------------

/**
 * Return the maximum number of labels to render for the given bucket.
 *
 * The raw cap is clamped to nodeCount so the budget never exceeds the
 * number of visible nodes.
 */
export function getLabelBudgetForBucket(
  bucket: 0 | 1 | 2 | 3,
  nodeCount: number,
): number {
  const cap = LABEL_CAPS[bucket];
  return Math.min(nodeCount, cap);
}

// ---------------------------------------------------------------------------
// Rank formula
// ---------------------------------------------------------------------------

/** Stable tie-breaker via FNV-1a hash so rank ordering is deterministic. */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface LabelRank {
  score: number;
  tieBreaker: number;
}

/**
 * Compute the label rank for a node.
 *
 * Formula:
 *   rank = degree + fidelity_level_numeric + lens_score_depth
 *
 * Bonus signals (not part of the base formula but clamped to reasonable
 * magnitudes to avoid drowning out the formula):
 *   - Selected node: +2000 (always rendered regardless of budget)
 *
 * @param nodeId       - graphology node key
 * @param node         - extended node attributes (VaultGraphNodeExtended)
 * @param degree       - graphology degree (in + out edges; caller supplies)
 * @param selectedId   - currently selected node ID (gets a large bonus)
 */
export function getLabelRank(
  nodeId: string,
  node: VaultGraphNodeExtended,
  degree: number,
  selectedId?: string | null,
): LabelRank {
  const fidelityScore = fidelityToNumeric(node.fidelity_level);
  const lensDepth = node.lens_scores_jsonb?.depth ?? 0;

  let score = degree + fidelityScore + lensDepth;

  // Selected node always wins the budget regardless of rank
  if (selectedId != null && nodeId === selectedId) {
    score += 2000;
  }

  return { score, tieBreaker: hashString(nodeId) };
}

/** Compare two LabelRank values descending (highest score first). */
export function compareLabelRank(a: LabelRank, b: LabelRank): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.tieBreaker - b.tieBreaker;
}

// ---------------------------------------------------------------------------
// Graph-aware label renderer
// ---------------------------------------------------------------------------

/**
 * A pre-computed label visibility index for a single frame.
 *
 * Call `createLabelRenderer(graph)` once per graph load, then use
 * `renderer.shouldRenderLabel(nodeId, cameraRatio)` in the sigma callback.
 *
 * The renderer maintains a mutable `currentBucket` and applies hysteresis
 * across calls so bucket transitions are smooth.
 */
export interface LabelRenderer {
  /**
   * Returns true if the node should render a label at the current zoom.
   *
   * @param nodeId      - graphology node key
   * @param cameraRatio - sigma camera `ratio` (1/effectiveZoom proxy)
   * @param selectedId  - optional currently-selected node (always renders)
   */
  shouldRenderLabel(
    nodeId: string,
    cameraRatio: number,
    selectedId?: string | null,
  ): boolean;

  /** Reset the cached ranking (call when the graph data changes). */
  invalidate(): void;
}

interface RankedNode {
  id: string;
  rank: LabelRank;
}

/**
 * Minimal graphology graph interface — only the methods labeling.ts needs.
 * This avoids importing graphology directly (which requires WebGL in some
 * environments) and keeps the module unit-testable.
 */
export interface GraphologyLike {
  nodes(): string[];
  degree(nodeId: string): number;
  getNodeAttributes(nodeId: string): unknown;
}

/**
 * Create a label renderer backed by a graphology-like graph instance.
 *
 * @param graph    - graphology Graph instance (or any conforming object)
 * @param selectedId - optional initial selected node ID (can be updated via
 *                    closure by passing it to `shouldRenderLabel` each call)
 */
export function createLabelRenderer(graph: GraphologyLike): LabelRenderer {
  // Sorted list of (id, rank) pairs — rebuilt on invalidate()
  let rankedNodes: RankedNode[] | null = null;
  // Set of node IDs within the current label budget
  let visibleSet: Set<string> | null = null;
  let lastBucket: 0 | 1 | 2 | 3 | null = null;
  let lastSelectedId: string | null | undefined = undefined;

  function buildRanking(selectedId: string | null | undefined): void {
    const ids = graph.nodes();
    const ranked: RankedNode[] = ids.map((id) => {
      const attrs = graph.getNodeAttributes(id) as unknown as VaultGraphNodeExtended;
      const degree = graph.degree(id);
      return { id, rank: getLabelRank(id, attrs, degree, selectedId) };
    });
    ranked.sort((a, b) => compareLabelRank(a.rank, b.rank));
    rankedNodes = ranked;
  }

  function buildVisibleSet(
    bucket: 0 | 1 | 2 | 3,
    selectedId: string | null | undefined,
  ): void {
    if (rankedNodes === null || lastSelectedId !== selectedId) {
      buildRanking(selectedId);
      lastSelectedId = selectedId;
    }
    const budget = getLabelBudgetForBucket(bucket, rankedNodes!.length);
    const set = new Set<string>();
    for (let i = 0; i < budget && i < rankedNodes!.length; i++) {
      set.add(rankedNodes![i].id);
    }
    // Always include selected node regardless of budget
    if (selectedId != null) {
      set.add(selectedId);
    }
    visibleSet = set;
  }

  return {
    shouldRenderLabel(
      nodeId: string,
      cameraRatio: number,
      selectedId?: string | null,
    ): boolean {
      // Convert sigma ratio to effective zoom: ratio < 1 = zoomed in
      const effectiveZoom = cameraRatio > 0 ? 1 / cameraRatio : 1;

      // Determine bucket with hysteresis
      const newBucket =
        lastBucket === null
          ? getInitialLabelBucket(effectiveZoom)
          : getNextLabelBucket(effectiveZoom, lastBucket);

      // Rebuild visible set when bucket, selection, or ranking changes
      if (
        newBucket !== lastBucket ||
        visibleSet === null ||
        lastSelectedId !== selectedId
      ) {
        lastBucket = newBucket;
        buildVisibleSet(newBucket, selectedId);
      }

      return visibleSet!.has(nodeId);
    },

    invalidate(): void {
      rankedNodes = null;
      visibleSet = null;
      lastBucket = null;
      lastSelectedId = undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Convenience export for sigma shouldRenderLabel callback shape
//
// Usage (inside SigmaContainer child, called with 250ms debounce):
//
//   const renderer = createLabelRenderer(sigma.getGraph());
//   const callback = (nodeId: string) =>
//     renderer.shouldRenderLabel(nodeId, sigma.getCamera().getState().ratio);
//   sigma.setSetting("shouldRenderLabel", callback);
// ---------------------------------------------------------------------------

/**
 * Build a sigma v3 `shouldRenderLabel` callback from a graph and optional
 * selected node ID.
 *
 * Wrapping in `debounce(fn, 250)` and calling on `afterRender` is the
 * recommended pattern (see module JSDoc at the top of this file).
 */
export function buildShouldRenderLabel(
  renderer: LabelRenderer,
  getCameraRatio: () => number,
  selectedId?: string | null,
): (nodeId: string) => boolean {
  return (nodeId: string) =>
    renderer.shouldRenderLabel(nodeId, getCameraRatio(), selectedId);
}
