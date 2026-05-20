/**
 * encoding/index.ts — Visual encoding helpers for the vault graph.
 *
 * All functions are pure and defensively default-safe: missing or null DTO
 * fields from older API responses always produce a sensible output, never throw.
 *
 * P2-09 implementation.
 *
 * Covers:
 *  - Node color by artifact_type / workspace / lens dimension
 *  - Node size by fidelity_level (5 discrete steps) or degree (log-scaled)
 *  - Node opacity by freshness_class
 *  - Uncertainty ring predicate (classification_confidence < 0.7)
 *  - Edge color by edge_type
 *  - Edge size by confidence
 *  - Semantic edge dashed predicate
 */

import {
  NODE_TYPE_COLORS,
  NODE_TYPE_COLOR_DEFAULT,
  WORKSPACE_COLORS,
  WORKSPACE_COLOR_DEFAULT,
  FIDELITY_SIZES,
  FIDELITY_SIZE_DEFAULT,
  EDGE_TYPE_COLORS,
  EDGE_TYPE_COLOR_DEFAULT,
  type FidelityLevel,
  type FreshnessClass,
  type NodeColorMode,
  type NodeSizeMode,
} from "@/types/graph";

// ---------------------------------------------------------------------------
// Node color
// ---------------------------------------------------------------------------

/**
 * Resolve the fill color for a node given the active color mode.
 *
 * @param artifactType  - node.artifact_type
 * @param workspace     - node.workspace
 * @param lensScores    - node.lens_scores_jsonb
 * @param selectedLens  - which lens dimension is selected when mode === "lens"
 * @param mode          - active color mode (default "artifact_type")
 */
export function resolveNodeColor(
  artifactType: string,
  workspace: string,
  lensScores: Record<string, number | undefined> | null | undefined,
  selectedLens: string | null,
  mode: NodeColorMode,
): string {
  switch (mode) {
    case "workspace":
      return WORKSPACE_COLORS[workspace] ?? WORKSPACE_COLOR_DEFAULT;

    case "lens": {
      if (!selectedLens || !lensScores) {
        // Lens mode with no data — fall back to artifact_type
        return NODE_TYPE_COLORS[artifactType] ?? NODE_TYPE_COLOR_DEFAULT;
      }
      const score = lensScores[selectedLens];
      if (score === undefined || score === null) {
        return NODE_TYPE_COLOR_DEFAULT;
      }
      // Map 0..1 continuous score to a blue→red ramp via HSL.
      // Low score (0) → cool blue (#3b82f6), high score (1) → warm red (#dc2626).
      // We interpolate hue: 220° (blue) → 0° (red).
      const clamped = Math.max(0, Math.min(1, score));
      const hue = Math.round(220 - clamped * 220);
      return `hsl(${hue},80%,45%)`;
    }

    case "artifact_type":
    default:
      return NODE_TYPE_COLORS[artifactType] ?? NODE_TYPE_COLOR_DEFAULT;
  }
}

// ---------------------------------------------------------------------------
// Node size
// ---------------------------------------------------------------------------

/**
 * Resolve the sigma node size for a node given the active size mode.
 *
 * fidelity mode: 5 discrete sizes (F0=6 .. F4=14).
 * degree  mode:  log2(degree + 1) * 3.5, clamped to [5, 18].
 *
 * @param fidelityLevel - node.fidelity_level (optional)
 * @param degree        - graphology degree (caller must supply for "degree" mode)
 * @param mode          - active size mode (default "fidelity")
 * @param highlighted   - whether this is the currently highlighted node (×1.5)
 */
export function resolveNodeSize(
  fidelityLevel: FidelityLevel | null | undefined,
  degree: number,
  mode: NodeSizeMode,
  highlighted = false,
): number {
  let base: number;

  if (mode === "degree") {
    // log2(degree + 1) gives 0 for degree=0, ~3.32 for degree=9, ~10 for degree=1023.
    // Multiply by 3.5 and clamp to a visible range.
    base = Math.min(18, Math.max(5, Math.log2(degree + 1) * 3.5));
  } else {
    // fidelity mode — discrete buckets
    base = fidelityLevel != null ? (FIDELITY_SIZES[fidelityLevel] ?? FIDELITY_SIZE_DEFAULT) : FIDELITY_SIZE_DEFAULT;
  }

  return highlighted ? base * 1.5 : base;
}

// ---------------------------------------------------------------------------
// Node opacity (freshness class)
// ---------------------------------------------------------------------------

const FRESHNESS_OPACITY: Record<FreshnessClass, number> = {
  current: 1.0,
  aging:   0.65,
  stale:   0.35,
};

/**
 * Map freshness_class to a WebGL-compatible alpha value (0..1).
 * null/undefined → 0.8 (sensible default for unknown age).
 */
export function resolveNodeOpacity(
  freshnessClass: FreshnessClass | null | undefined,
): number {
  if (freshnessClass == null) return 0.8;
  return FRESHNESS_OPACITY[freshnessClass] ?? 0.8;
}

// ---------------------------------------------------------------------------
// Uncertainty ring predicate
// ---------------------------------------------------------------------------

/**
 * Returns true when the node should display an uncertainty ring.
 *
 * Threshold: classification_confidence < 0.7.
 * null/undefined → treated as 1.0 (confident — no ring).
 */
export function hasUncertaintyRing(
  classificationConfidence: number | null | undefined,
): boolean {
  if (classificationConfidence == null) return false;
  return classificationConfidence < 0.7;
}

/**
 * Size of the uncertainty ring relative to the base node size.
 * Ring is drawn as an outer node that is `RING_SCALE` × the base size,
 * so it visually appears as a halo.
 */
export const RING_SIZE_SCALE = 1.4;

// ---------------------------------------------------------------------------
// Edge color
// ---------------------------------------------------------------------------

/**
 * Resolve the stroke color for an edge by its edge_type.
 */
export function resolveEdgeColor(edgeType: string): string {
  return EDGE_TYPE_COLORS[edgeType] ?? EDGE_TYPE_COLOR_DEFAULT;
}

// ---------------------------------------------------------------------------
// Edge size (confidence-based)
// ---------------------------------------------------------------------------

/** Default confidence when confidence field is absent. Yields size 1.5. */
const EDGE_CONFIDENCE_DEFAULT = 0.25;

/**
 * Resolve sigma edge size from the edge confidence value.
 *
 * Formula: 1 + confidence * 2
 *   confidence = 0   → size 1.0
 *   confidence = 0.25 → size 1.5 (default when absent)
 *   confidence = 1   → size 3.0
 */
export function resolveEdgeSize(
  confidence: number | null | undefined,
): number {
  const c = confidence ?? EDGE_CONFIDENCE_DEFAULT;
  const clamped = Math.max(0, Math.min(1, c));
  return 1 + clamped * 2;
}

// ---------------------------------------------------------------------------
// Semantic edge dashed predicate
// ---------------------------------------------------------------------------

/**
 * Returns true when the edge should be rendered with a dashed stroke.
 *
 * Applies to: 'semantic_similar' and any future 'semantic_*' edge types.
 */
export function isSemanticEdge(edgeType: string): boolean {
  return edgeType === "semantic_similar" || edgeType.startsWith("semantic_");
}
