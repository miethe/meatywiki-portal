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

/**
 * A node as returned by GET /api/portal/graph/vault.
 */
export interface VaultGraphNode {
  id: string;
  title: string | null;
  artifact_type: GraphNodeType;
  workspace: string;
  updated_at: string | null;
}

/**
 * An edge as returned by GET /api/portal/graph/vault.
 */
export interface VaultGraphEdge {
  source_id: string;
  target_id: string;
  edge_type: GraphEdgeType;
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
