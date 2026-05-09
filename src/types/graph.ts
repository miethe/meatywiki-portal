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
 * Full response envelope from GET /api/portal/graph/neighborhood.
 */
export interface NeighborhoodGraphResponse {
  data: NeighborhoodGraphData;
  meta: {
    etag: string | null;
  };
}

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
 * Full response envelope from GET /api/portal/graph/vault.
 */
export interface VaultGraphResponse {
  data: VaultGraphData;
  meta: {
    etag: string | null;
  };
}

// ---------------------------------------------------------------------------
// Visual encoding constants
// ---------------------------------------------------------------------------

/** Node type → fill color hex string. */
export const NODE_TYPE_COLORS: Record<string, string> = {
  concept: "#3f83ff",
  entity: "#2ebd6e",
  topic_note: "#9262ff",
  summary: "#ff9f43",
  synthesis: "#ef4444",
  evidence: "#14b8a6",
  glossary: "#969aa5",
} as const;

/** Fallback color for unknown node types. */
export const NODE_TYPE_COLOR_DEFAULT = "#969aa5";

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

/** Edge style → color (for rendering). */
export const EDGE_STYLE_COLORS: Record<EdgeLineStyle, string> = {
  solid: "#64748b",
  dashed: "#94a3b8",
  dotted: "#94a3b8",
  "thick-solid": "#475569",
  "red-dashed": "#ef4444",
} as const;
