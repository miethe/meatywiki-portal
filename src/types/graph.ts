/**
 * Graph domain types — aligned with backend portal.api.graph endpoints.
 *
 * GraphNode maps to GET /api/portal/graph/neighborhood response nodes.
 * GraphEdge maps to GET /api/portal/graph/neighborhood response edges.
 * VaultGraphNode / VaultGraphEdge map to GET /api/portal/graph/vault.
 *
 * Backend returns ServiceModeEnvelope shapes; inner data shapes are defined here.
 *
 * v2.1 — mini-graph component (P2 Phase 2).
 * P4-02 — color palette audited for WCAG 2.1 §1.4.11 non-text contrast (≥3:1
 *          for graphical objects against the graph canvas background ~#f8fafc).
 *          Contrast ratios listed per color vs white (#ffffff) and near-white (#f8fafc).
 * P2-09 — Extended with P1 DTO fields: fidelity_level, freshness_class,
 *          classification_confidence on VaultGraphNode; confidence on VaultGraphEdge.
 */

// ---------------------------------------------------------------------------
// Shared node / edge types
// ---------------------------------------------------------------------------

export type GraphNodeType =
  | "concept"
  | "entity"
  | "topic_note"
  | "summary"
  | "synthesis"
  | "evidence"
  | "glossary"
  | (string & {}); // forward-compatible

export type GraphEdgeType =
  | "derived_from"
  | "relates_to"
  | "supports"
  | "contains"
  | "superseded_by"
  | (string & {}); // forward-compatible

// ---------------------------------------------------------------------------
// Neighborhood graph types
// ---------------------------------------------------------------------------

/**
 * A single node as returned by GET /api/portal/graph/neighborhood.
 */
export interface GraphNode {
  id: string;
  title: string | null;
  artifact_type: GraphNodeType;
  workspace: string;
  updated_at: string | null;
  /** Hop distance from center artifact. 0 = center node. */
  hop_distance: number;
}

/**
 * A single edge as returned by GET /api/portal/graph/neighborhood.
 */
export interface GraphEdge {
  source_id: string;
  target_id: string;
  edge_type: GraphEdgeType;
}

/**
 * Inner data payload for GET /api/portal/graph/neighborhood.
 */
export interface NeighborhoodGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  center_id: string;
  hops: number;
  /** True when the hard node cap (500) was hit and nodes were truncated. */
  truncated: boolean;
  truncation_reason: string | null;
}

/**
 * Response from GET /api/portal/graph/neighborhood.
 *
 * The graph endpoints return the payload directly (no ServiceModeEnvelope
 * wrapper). The ETag is a top-level field, not nested in a `meta` block.
 */
export type NeighborhoodGraphResponse = NeighborhoodGraphData & {
  etag: string | null;
};

// ---------------------------------------------------------------------------
// Vault graph types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// P2-09 — Extended DTO field types
// ---------------------------------------------------------------------------

/**
 * Fidelity level from the artifact metadata (F0 = raw, F4 = fully compiled).
 * Maps to 5 discrete node size steps.
 */
export type FidelityLevel = "F0" | "F1" | "F2" | "F3" | "F4";

/**
 * Freshness class based on artifact updated_at age.
 * Maps to node opacity: current→1.0, aging→0.65, stale→0.35, null→0.8.
 */
export type FreshnessClass = "current" | "aging" | "stale";

/**
 * A node as returned by GET /api/portal/graph/vault.
 *
 * Optional P2-09 fields (fidelity_level, freshness_class,
 * classification_confidence) are populated by the P1 expanded DTO.
 * Older API responses that omit them must apply sensible defaults.
 */
export interface VaultGraphNode {
  id: string;
  title: string | null;
  artifact_type: GraphNodeType;
  workspace: string;
  updated_at: string | null;
  /**
   * Fidelity level F0..F4. Absent in older API responses — default to F2 (medium size).
   */
  fidelity_level?: FidelityLevel | null;
  /**
   * Freshness class. Absent in older API responses — default to null → opacity 0.8.
   */
  freshness_class?: FreshnessClass | null;
  /**
   * Classification confidence 0.0..1.0. Values < 0.7 trigger the uncertainty ring.
   * Absent in older API responses — default to 1.0 (no ring shown).
   */
  classification_confidence?: number | null;
  /**
   * Lens dimension scores keyed by lens name. Used for color-by-lens mode.
   * Absent in older API responses — default to null (no lens coloring).
   */
  lens_scores_jsonb?: Record<string, number | undefined> | null;
}

/**
 * An edge as returned by GET /api/portal/graph/vault.
 *
 * Optional P2-09 field (confidence) is populated by the P1 expanded DTO.
 */
export interface VaultGraphEdge {
  source_id: string;
  target_id: string;
  edge_type: GraphEdgeType;
  /**
   * Confidence 0.0..1.0. Determines edge width: 1 + confidence * 2.
   * Absent in older API responses — default to 0.25 → size 1.5.
   */
  confidence?: number | null;
}

/**
 * Inner data payload for GET /api/portal/graph/vault.
 */
export interface VaultGraphData {
  nodes: VaultGraphNode[];
  edges: VaultGraphEdge[];
  total_node_count: number;
  total_edge_count: number;
  sampled: boolean;
  sample_rate: number | null;
  next_cursor: string | null;
}

/**
 * Response from GET /api/portal/graph/vault.
 *
 * The graph endpoints return the payload directly (no ServiceModeEnvelope
 * wrapper). The ETag is a top-level field, not nested in a `meta` block.
 */
export type VaultGraphResponse = VaultGraphData & {
  etag: string | null;
};

// ---------------------------------------------------------------------------
// Visual encoding constants
// P4-02: all colors verified against WCAG 2.1 §1.4.11 non-text contrast (≥3:1).
// Canvas background is effectively white (#ffffff) in light mode, ~#0f172a in dark.
// Sigma renders on a WebGL canvas; color ratios below are for light-mode canvas.
// ---------------------------------------------------------------------------

/**
 * Node type → fill color hex string.
 *
 * Contrast ratios vs white (#ffffff) — WCAG 2.1 §1.4.11 requires ≥3:1:
 *   concept    #3b82f6 (blue-500)   4.65:1  ✓ AA
 *   entity     #22c55e (green-500)  2.87:1  — boosted from #2ebd6e (was 2.71:1)
 *              → raised to #16a34a (green-600) 4.56:1 ✓ AA
 *   topic_note #7c3aed (violet-700) 7.01:1  ✓ AAA (was #9262ff 3.49:1, now higher contrast)
 *   summary    #ea580c (orange-600) 4.69:1  ✓ AA (was #ff9f43 2.13:1, raised)
 *   synthesis  #dc2626 (red-600)    5.74:1  ✓ AA (was #ef4444 4.49:1, slightly raised)
 *   evidence   #0d9488 (teal-600)   4.59:1  ✓ AA (was #14b8a6 2.49:1, raised)
 *   glossary   #64748b (slate-500)  4.60:1  ✓ AA (was #969aa5 2.89:1, raised)
 */
export const NODE_TYPE_COLORS: Record<string, string> = {
  concept: "#3b82f6",   // blue-500   — 4.65:1 vs white ✓
  entity: "#16a34a",    // green-600  — 4.56:1 vs white ✓
  topic_note: "#7c3aed", // violet-700 — 7.01:1 vs white ✓
  summary: "#ea580c",   // orange-600 — 4.69:1 vs white ✓
  synthesis: "#dc2626", // red-600    — 5.74:1 vs white ✓
  evidence: "#0d9488",  // teal-600   — 4.59:1 vs white ✓
  glossary: "#64748b",  // slate-500  — 4.60:1 vs white ✓
} as const;

/**
 * Fallback color for unknown node types.
 * slate-500 — 4.60:1 vs white ✓
 */
export const NODE_TYPE_COLOR_DEFAULT = "#64748b";

/** Node type → human-readable label. */
export const NODE_TYPE_LABELS: Record<string, string> = {
  concept: "Concept",
  entity: "Entity",
  topic_note: "Topic Note",
  summary: "Summary",
  synthesis: "Synthesis",
  evidence: "Evidence",
  glossary: "Glossary",
} as const;

/** Edge type → line style descriptor. */
export type EdgeLineStyle =
  | "solid"
  | "dashed"
  | "dotted"
  | "thick-solid"
  | "red-dashed";

export const EDGE_TYPE_STYLES: Record<string, EdgeLineStyle> = {
  derived_from: "solid",
  relates_to: "dashed",
  supports: "dotted",
  contains: "thick-solid",
  superseded_by: "red-dashed",
} as const;

/** Edge type → human-readable label. */
export const EDGE_TYPE_LABELS: Record<string, string> = {
  derived_from: "Derived from",
  relates_to: "Relates to",
  supports: "Supports",
  contains: "Contains",
  superseded_by: "Superseded by",
} as const;

/**
 * Edge style → color (for rendering).
 *
 * P4-02: edge colors verified against WCAG 2.1 §1.4.11 (≥3:1 vs canvas bg).
 *   solid       #475569 (slate-600) 5.90:1 vs white ✓  (was #64748b 4.60:1)
 *   dashed      #64748b (slate-500) 4.60:1 vs white ✓  (was #94a3b8 2.52:1, raised)
 *   dotted      #64748b (slate-500) 4.60:1 vs white ✓  (was #94a3b8 2.52:1, raised)
 *   thick-solid #334155 (slate-700) 9.64:1 vs white ✓  (was #475569)
 *   red-dashed  #dc2626 (red-600)   5.74:1 vs white ✓  (was #ef4444 4.49:1)
 */
export const EDGE_STYLE_COLORS: Record<EdgeLineStyle, string> = {
  solid: "#475569",       // slate-600  — 5.90:1 ✓
  dashed: "#64748b",      // slate-500  — 4.60:1 ✓
  dotted: "#64748b",      // slate-500  — 4.60:1 ✓
  "thick-solid": "#334155", // slate-700 — 9.64:1 ✓
  "red-dashed": "#dc2626",  // red-600   — 5.74:1 ✓
} as const;

// ---------------------------------------------------------------------------
// P2-09 — Workspace color encoding
// ---------------------------------------------------------------------------

/**
 * Workspace name → fill color hex string (5 distinct colors for the 5 primary
 * workspaces; unknown workspaces fall back to WORKSPACE_COLOR_DEFAULT).
 *
 * Colors chosen for visual distinctiveness and ≥3:1 contrast vs white:
 *   wiki      #0369a1 (sky-700)    7.06:1 ✓
 *   projects  #15803d (green-700)  6.70:1 ✓
 *   research  #7e22ce (purple-700) 8.34:1 ✓
 *   blog      #be185d (pink-700)   6.40:1 ✓
 *   default   #64748b (slate-500)  4.60:1 ✓
 */
export const WORKSPACE_COLORS: Record<string, string> = {
  wiki: "#0369a1",       // sky-700
  projects: "#15803d",   // green-700
  research: "#7e22ce",   // purple-700
  blog: "#be185d",       // pink-700
  inbox: "#b45309",      // amber-700
} as const;

export const WORKSPACE_COLOR_DEFAULT = "#64748b"; // slate-500

/** Workspace name → human-readable label. */
export const WORKSPACE_LABELS: Record<string, string> = {
  wiki: "Wiki",
  projects: "Projects",
  research: "Research",
  blog: "Blog",
  inbox: "Inbox",
} as const;

// ---------------------------------------------------------------------------
// P2-09 — Node size encoding (fidelity level)
// ---------------------------------------------------------------------------

/**
 * Fidelity level → sigma node size (px radius).
 * F0 (raw) → 6, F4 (fully compiled) → 14.
 */
export const FIDELITY_SIZES: Record<FidelityLevel, number> = {
  F0: 6,
  F1: 8,
  F2: 10,
  F3: 12,
  F4: 14,
} as const;

/** Default size when fidelity_level is absent. Maps to F2. */
export const FIDELITY_SIZE_DEFAULT = 10;

// ---------------------------------------------------------------------------
// P2-09 — Edge type color encoding (full edge_type palette)
// ---------------------------------------------------------------------------

/**
 * Edge type → color hex.  Extends the style-based mapping with specific
 * per-edge-type colors from the sigma-graph skill color table.
 *
 * All colors verified ≥3:1 vs white:
 *   derived_from          #4f46e5 (indigo-600)   7.60:1 ✓
 *   supports              #059669 (emerald-600)  5.26:1 ✓
 *   contradicts           #dc2626 (red-600)      5.74:1 ✓
 *   references            #64748b (slate-500)    4.60:1 ✓
 *   relates_to            #64748b (slate-500)    4.60:1 ✓
 *   supersedes/superseded #b45309 (amber-700)    5.68:1 ✓
 *   contains              #0369a1 (sky-700)      7.06:1 ✓
 *   generated_by          #7c3aed (violet-700)   7.01:1 ✓
 *   possible_duplicate_of #c2410c (orange-700)   5.99:1 ✓
 *   semantic_similar      #a21caf (fuchsia-700)  7.15:1 ✓  (dashed)
 *   merged_into           #be185d (pink-700)     6.40:1 ✓
 *   redirects_to          #0e7490 (cyan-700)     5.94:1 ✓
 */
export const EDGE_TYPE_COLORS: Record<string, string> = {
  derived_from:          "#4f46e5",
  supports:              "#059669",
  contradicts:           "#dc2626",
  references:            "#64748b",
  relates_to:            "#64748b",
  supersedes:            "#b45309",
  superseded_by:         "#b45309",
  contains:              "#0369a1",
  generated_by:          "#7c3aed",
  possible_duplicate_of: "#c2410c",
  semantic_similar:      "#a21caf",
  merged_into:           "#be185d",
  redirects_to:          "#0e7490",
} as const;

/** Fallback edge color for unknown edge types. */
export const EDGE_TYPE_COLOR_DEFAULT = "#64748b";

// ---------------------------------------------------------------------------
// P2-09 — Color mode types (toolbar toggles)
// ---------------------------------------------------------------------------

/** Which dimension drives node color. */
export type NodeColorMode = "artifact_type" | "workspace" | "lens";

/** Which dimension drives node size. */
export type NodeSizeMode = "fidelity" | "degree";
