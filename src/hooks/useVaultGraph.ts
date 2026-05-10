"use client";

/**
 * useVaultGraph — TanStack Query hook for GET /api/portal/graph/vault.
 *
 * Handles:
 *   - Vault-wide graph fetching with node/edge type filters
 *   - Cursor-based pagination (append or replace mode)
 *   - Sampling detection (backend `sampled: true` flag)
 *   - URL query param sync for shareable filter state
 *   - Neighborhood fetch delegation to useArtifactNeighborhood
 *
 * v2.1 — vault graph page (P3 Phase 3).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import type {
  VaultGraphData,
  VaultGraphResponse,
  VaultGraphNode,
  VaultGraphEdge,
  GraphNodeType,
  GraphEdgeType,
} from "@/types/graph";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Node count threshold above which the degraded/list fallback is offered. */
export const VAULT_GRAPH_NODE_CAP = 2000;

/** Default page size for vault graph queries. */
export const VAULT_GRAPH_DEFAULT_LIMIT = 100;

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

export interface VaultGraphFetchOptions {
  nodeTypes?: GraphNodeType[];
  edgeTypes?: GraphEdgeType[];
  limit?: number;
  cursor?: string | null;
}

async function fetchVaultGraph(
  options: VaultGraphFetchOptions = {},
): Promise<VaultGraphData> {
  const params = new URLSearchParams();

  if (options.nodeTypes?.length) {
    for (const nt of options.nodeTypes) params.append("node_types[]", nt);
  }
  if (options.edgeTypes?.length) {
    for (const et of options.edgeTypes) params.append("edge_types[]", et);
  }
  params.set("limit", String(options.limit ?? VAULT_GRAPH_DEFAULT_LIMIT));
  if (options.cursor) params.set("cursor", options.cursor);

  const response = await apiFetch<VaultGraphResponse>(
    `/portal/graph/vault?${params.toString()}`,
    { method: "GET" },
  );
  return response;
}

// ---------------------------------------------------------------------------
// URL query param helpers
// ---------------------------------------------------------------------------

const QP_NODE_TYPES = "node_types";
const QP_EDGE_TYPES = "edge_types";

/** Read node/edge type filters from the URL search params. */
export function readFiltersFromUrl(searchParams: URLSearchParams): {
  nodeTypes: GraphNodeType[];
  edgeTypes: GraphEdgeType[];
} {
  const nodeTypes = searchParams.getAll(QP_NODE_TYPES) as GraphNodeType[];
  const edgeTypes = searchParams.getAll(QP_EDGE_TYPES) as GraphEdgeType[];
  return { nodeTypes, edgeTypes };
}

/** Build a URL search string from filter state. Preserves other params. */
export function buildFilterUrl(
  base: URLSearchParams,
  nodeTypes: GraphNodeType[],
  edgeTypes: GraphEdgeType[],
): string {
  const next = new URLSearchParams(base.toString());
  next.delete(QP_NODE_TYPES);
  next.delete(QP_EDGE_TYPES);
  for (const nt of nodeTypes) next.append(QP_NODE_TYPES, nt);
  for (const et of edgeTypes) next.append(QP_EDGE_TYPES, et);
  return next.toString();
}

// ---------------------------------------------------------------------------
// Hook result type
// ---------------------------------------------------------------------------

export interface UseVaultGraphResult {
  /** Accumulated nodes across all loaded pages. */
  nodes: VaultGraphNode[];
  /** Accumulated edges across all loaded pages. */
  edges: VaultGraphEdge[];
  /** Total node count from backend (may be larger than loaded nodes). */
  totalNodeCount: number;
  /** Whether the backend applied sampling (truncated result). */
  sampled: boolean;
  /** Whether node count exceeds the render cap and degraded view should be offered. */
  degraded: boolean;
  /** Current pagination cursor — null = last page reached or not yet started. */
  nextCursor: string | null;
  /** True when the initial fetch is in progress. */
  isLoading: boolean;
  /** True when a pagination fetch is in progress. */
  isFetchingMore: boolean;
  /** Whether there are more pages to load. */
  hasMore: boolean;
  isError: boolean;
  error: Error | null;
  /** Trigger reload with current filters (useful on error retry). */
  refetch: () => void;
  /** Fetch the next page of results. */
  fetchNextPage: () => void;
  /** Active node type filter. */
  nodeTypes: GraphNodeType[];
  /** Active edge type filter. */
  edgeTypes: GraphEdgeType[];
  /** Update node type filter (resets cursor + accumulated data). */
  setNodeTypes: (types: GraphNodeType[]) => void;
  /** Update edge type filter (resets cursor + accumulated data). */
  setEdgeTypes: (types: GraphEdgeType[]) => void;
  /** Reset all filters to show full vault. */
  clearFilters: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useVaultGraph — manages vault-wide graph data with filtering and pagination.
 *
 * Filters are synced to URL query params so pages are shareable.
 * When filters change, pagination resets to page 1.
 */
export function useVaultGraph(): UseVaultGraphResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialise filters from URL on first render.
  const [nodeTypes, setNodeTypesState] = useState<GraphNodeType[]>(() =>
    searchParams.getAll(QP_NODE_TYPES) as GraphNodeType[],
  );
  const [edgeTypes, setEdgeTypesState] = useState<GraphEdgeType[]>(() =>
    searchParams.getAll(QP_EDGE_TYPES) as GraphEdgeType[],
  );

  // Pagination state — cursor used for the *current* page fetch.
  const [cursor, setCursor] = useState<string | null>(null);

  // Accumulated data across pages.
  const [accNodes, setAccNodes] = useState<VaultGraphNode[]>([]);
  const [accEdges, setAccEdges] = useState<VaultGraphEdge[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalNodeCount, setTotalNodeCount] = useState(0);
  const [sampled, setSampled] = useState(false);

  // Track whether we're fetching an additional page (vs initial load).
  const isFetchingMoreRef = useRef(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Build TanStack Query key — changes when filters or cursor change.
  const queryKey = ["vault-graph", nodeTypes, edgeTypes, cursor] as const;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchVaultGraph({ nodeTypes, edgeTypes, cursor }),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    retry: false,
  });

  // When data arrives, merge into accumulated state.
  useEffect(() => {
    if (!data) return;

    if (cursor === null) {
      // First page (or filter reset) — replace accumulated data.
      setAccNodes(data.nodes);
      setAccEdges(data.edges);
    } else {
      // Additional page — deduplicate by id and append.
      setAccNodes((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const newNodes = data.nodes.filter((n) => !existingIds.has(n.id));
        return [...prev, ...newNodes];
      });
      setAccEdges((prev) => {
        const existingKeys = new Set(
          prev.map((e) => `${e.source_id}__${e.target_id}__${e.edge_type}`),
        );
        const newEdges = data.edges.filter(
          (e) =>
            !existingKeys.has(
              `${e.source_id}__${e.target_id}__${e.edge_type}`,
            ),
        );
        return [...prev, ...newEdges];
      });
    }

    setNextCursor(data.next_cursor ?? null);
    setTotalNodeCount(data.total_node_count ?? data.nodes.length);
    setSampled(data.sampled ?? false);
    isFetchingMoreRef.current = false;
    setIsFetchingMore(false);
  }, [data, cursor]);

  // Sync filter changes to URL.
  const syncFiltersToUrl = useCallback(
    (nt: GraphNodeType[], et: GraphEdgeType[]) => {
      const qs = buildFilterUrl(searchParams, nt, et);
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Filter setters — reset cursor + accumulated data when filters change.
  const setNodeTypes = useCallback(
    (types: GraphNodeType[]) => {
      setNodeTypesState(types);
      setCursor(null);
      setAccNodes([]);
      setAccEdges([]);
      syncFiltersToUrl(types, edgeTypes);
    },
    [edgeTypes, syncFiltersToUrl],
  );

  const setEdgeTypes = useCallback(
    (types: GraphEdgeType[]) => {
      setEdgeTypesState(types);
      setCursor(null);
      setAccNodes([]);
      setAccEdges([]);
      syncFiltersToUrl(nodeTypes, types);
    },
    [nodeTypes, syncFiltersToUrl],
  );

  const clearFilters = useCallback(() => {
    setNodeTypesState([]);
    setEdgeTypesState([]);
    setCursor(null);
    setAccNodes([]);
    setAccEdges([]);
    syncFiltersToUrl([], []);
  }, [syncFiltersToUrl]);

  // Pagination.
  const fetchNextPage = useCallback(() => {
    if (!nextCursor || isFetchingMoreRef.current) return;
    isFetchingMoreRef.current = true;
    setIsFetchingMore(true);
    setCursor(nextCursor);
  }, [nextCursor]);

  const degraded =
    sampled || totalNodeCount >= VAULT_GRAPH_NODE_CAP || accNodes.length >= VAULT_GRAPH_NODE_CAP;

  return {
    nodes: accNodes,
    edges: accEdges,
    totalNodeCount,
    sampled,
    degraded,
    nextCursor,
    isLoading: isLoading && !isFetchingMore,
    isFetchingMore,
    hasMore: nextCursor !== null,
    isError,
    error: error as Error | null,
    refetch,
    fetchNextPage,
    nodeTypes,
    edgeTypes,
    setNodeTypes,
    setEdgeTypes,
    clearFilters,
  };
}
