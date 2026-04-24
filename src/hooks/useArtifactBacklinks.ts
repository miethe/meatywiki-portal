"use client";

/**
 * useArtifactBacklinks — TanStack Query hook for GET /api/artifacts/:id/backlinks.
 *
 * Primary path: calls GET /api/artifacts/:id/backlinks?edge_type=<value>
 * and returns the server-supplied backlinks list.
 *
 * Fallback path: if the primary endpoint returns a 404 or a network/fetch
 * error, the hook transparently falls back to the client-side edge-walk via
 * GET /api/artifacts/:id/edges (useArtifactEdges). A single console.warn is
 * logged; nothing is surfaced to the user. This matches the task requirement:
 * "keep [existing code] as a fallback if the endpoint is unavailable".
 *
 * Response envelope (primary endpoint):
 *   { data: BacklinkItem[], cursor: string | null, etag?: string }
 *
 * Edge type values (from backend schema — extend when backend adds more):
 *   derived_from | supports | relates_to | supersedes | contradicts | contains
 *
 * P7-04: server-side backlinks on artifact detail.
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import {
  useArtifactEdges,
  type ArtifactEdgeItem,
  type EdgeType,
} from "@/hooks/useArtifactEdges";

// ---------------------------------------------------------------------------
// Known edge type enum values (hardcoded; backend schema has these as an enum).
// Forward-compatible via the open string union.
// ---------------------------------------------------------------------------

export const KNOWN_EDGE_TYPES: EdgeType[] = [
  "derived_from",
  "supports",
  "relates_to",
  "supersedes",
  "contradicts",
  "contains",
];

// ---------------------------------------------------------------------------
// Primary endpoint response types
// ---------------------------------------------------------------------------

/**
 * A single backlink item as returned by GET /api/artifacts/:id/backlinks.
 * Shape mirrors ArtifactEdgeItem from the edges endpoint so the same
 * render components can be reused without adaptation.
 */
export interface BacklinkItem {
  /** ID of the peer artifact. */
  artifact_id: string;
  /** Edge relationship type. */
  type: EdgeType;
  /** Human-readable title of the peer artifact; null when not indexed. */
  title: string | null;
  /** Subtype of the peer artifact. */
  subtype: string | null;
}

/** Envelope returned by GET /api/artifacts/:id/backlinks */
export interface BacklinksEnvelope {
  data: BacklinkItem[];
  cursor: string | null;
  etag?: string;
}

// ---------------------------------------------------------------------------
// Normalised result shape shared by primary + fallback paths
// ---------------------------------------------------------------------------

/**
 * Normalised backlinks result. Always populated from either the primary
 * server endpoint or the client-side edge-walk fallback.
 *
 * `isFallback` is true when the client-side edge-walk was used instead of
 * the server endpoint. Consumers may inspect this for debugging.
 */
export interface UseArtifactBacklinksResult {
  /** Incoming edges (peers that reference this artifact). */
  incoming: BacklinkItem[];
  /** Outgoing edges (artifacts this artifact references). */
  outgoing: BacklinkItem[];
  /** Combined flat list filtered by the active edgeType (if any). */
  items: BacklinkItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  /** True when the server endpoint was unavailable and client fallback was used. */
  isFallback: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert an ArtifactEdgeItem (edges endpoint) to BacklinkItem shape. */
function edgeItemToBacklink(edge: ArtifactEdgeItem): BacklinkItem {
  return {
    artifact_id: edge.artifact_id,
    type: edge.type,
    title: edge.title,
    subtype: edge.subtype,
  };
}

/** Fetch backlinks from the primary server endpoint. */
async function fetchBacklinks(
  artifactId: string,
  edgeType?: EdgeType | null,
): Promise<BacklinksEnvelope> {
  const query = new URLSearchParams();
  if (edgeType) query.set("edge_type", edgeType);
  const qs = query.toString();
  const path = `/artifacts/${encodeURIComponent(artifactId)}/backlinks${qs ? `?${qs}` : ""}`;
  return apiFetch<BacklinksEnvelope>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Hook: primary path (server endpoint)
// ---------------------------------------------------------------------------

/**
 * Internal hook for the primary /backlinks endpoint.
 *
 * No retries — any failure (404, network error, 5xx) immediately signals the
 * parent hook to fall back to the client-side edge-walk. Retrying the primary
 * endpoint would delay the fallback unnecessarily.
 */
function usePrimaryBacklinks(
  artifactId: string | null | undefined,
  edgeType?: EdgeType | null,
): {
  data: BacklinksEnvelope | null | undefined;
  isLoading: boolean;
  primaryFailed: boolean;
  primaryError: Error | null;
  refetch: () => void;
} {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["artifacts", artifactId, "backlinks", edgeType ?? null],
    queryFn: () => fetchBacklinks(artifactId!, edgeType),
    enabled: Boolean(artifactId),
    staleTime: 30_000,
    // No retries: any failure immediately triggers the client-side fallback.
    // Retrying the primary would delay the fallback and confuse the user.
    retry: false,
  });

  return {
    data: data ?? null,
    isLoading,
    primaryFailed: isError,
    primaryError: error as Error | null,
    refetch,
  };
}

// ---------------------------------------------------------------------------
// Hook: public API
// ---------------------------------------------------------------------------

/**
 * Fetch backlinks for the given artifact from GET /api/artifacts/:id/backlinks.
 *
 * Falls back to the client-side edge-walk (useArtifactEdges) if the server
 * endpoint returns 404 or a network error. One console.warn is emitted on
 * fallback; nothing is shown to the user.
 *
 * @param artifactId  Artifact whose backlinks to fetch. Skips when falsy.
 * @param edgeType    Optional filter. Applied server-side on the primary path;
 *                    filtered client-side on the fallback path.
 */
export function useArtifactBacklinks(
  artifactId: string | null | undefined,
  edgeType?: EdgeType | null,
): UseArtifactBacklinksResult {
  const {
    data: primaryData,
    isLoading: primaryLoading,
    primaryFailed,
    primaryError,
    refetch: primaryRefetch,
  } = usePrimaryBacklinks(artifactId, edgeType);

  // Always call fallback hook (Rules of Hooks — cannot be conditional).
  // Passes artifactId only when primary has failed; null otherwise so
  // the underlying query is disabled while primary is still loading/succeeding.
  const {
    data: edgesData,
    isLoading: edgesLoading,
    isError: edgesError,
    error: edgesErr,
    refetch: edgesRefetch,
  } = useArtifactEdges(primaryFailed ? artifactId : null);

  // Log a warning once when we switch to fallback mode.
  if (primaryFailed && artifactId) {
    console.warn(
      `[useArtifactBacklinks] Primary endpoint unavailable for artifact "${artifactId}" ` +
        `(${primaryError?.message ?? "unknown error"}). Falling back to client-side edge-walk.`,
    );
  }

  // ---- Primary path succeeded ----
  if (!primaryFailed && primaryData) {
    const items = primaryData.data ?? [];
    // The /backlinks endpoint returns a flat list without direction metadata.
    // Expose via `items`; incoming stays empty for primary path.
    return {
      incoming: [],
      outgoing: items,
      items,
      isLoading: primaryLoading,
      isError: false,
      error: null,
      refetch: primaryRefetch,
      isFallback: false,
    };
  }

  // ---- Primary still loading (not failed yet) ----
  if (primaryLoading) {
    return {
      incoming: [],
      outgoing: [],
      items: [],
      isLoading: true,
      isError: false,
      error: null,
      refetch: primaryRefetch,
      isFallback: false,
    };
  }

  // ---- Fallback path: use edges endpoint ----
  const incoming = (edgesData?.incoming ?? []).map(edgeItemToBacklink);
  const outgoing = (edgesData?.outgoing ?? []).map(edgeItemToBacklink);

  // Apply client-side edge_type filter (the server applies it natively on
  // the primary path; we replicate it here for the fallback).
  const filterFn = edgeType
    ? (item: BacklinkItem) => item.type === edgeType
    : () => true;

  const filteredIncoming = incoming.filter(filterFn);
  const filteredOutgoing = outgoing.filter(filterFn);
  const items = [...filteredIncoming, ...filteredOutgoing];

  return {
    incoming: filteredIncoming,
    outgoing: filteredOutgoing,
    items,
    isLoading: edgesLoading,
    isError: edgesError,
    error: edgesErr,
    refetch: edgesRefetch,
    isFallback: true,
  };
}
