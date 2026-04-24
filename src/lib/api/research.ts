/**
 * Research API — typed wrappers for research-domain endpoints.
 *
 * P7-01: Freshness status endpoint wiring.
 *   GET /api/artifacts/research/freshness-status
 *   Returns cursor-paginated list of artifacts with staleness data.
 *
 * P7-02: Contradictions endpoint wiring.
 *   GET /api/artifacts/research/contradictions
 *   Returns cursor-paginated list of contradiction pairs.
 *
 * Envelope shape: { data: T[], cursor: string | null, etag: string | null }
 * Compatible with ServiceModeEnvelope<T>.
 */

import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Freshness status types
// ---------------------------------------------------------------------------

/**
 * A single item returned by GET /api/artifacts/research/freshness-status.
 *
 * - freshness_score: 0–100 integer; lower = more stale.
 * - last_synthesis_date: ISO 8601 string or null if never synthesised.
 * - source_artifact_count: number of source artifacts feeding this item.
 */
export interface FreshnessItem {
  id: string;
  title: string;
  type: string;
  subtype?: string | null;
  freshness_score: number;
  last_synthesis_date: string | null;
  source_artifact_count: number;
  file_path: string;
}

export interface FreshnessStatusEnvelope {
  data: FreshnessItem[];
  cursor: string | null;
  etag?: string | null;
}

export interface GetFreshnessStatusParams {
  /** Artifacts with no synthesis within this many days are considered stale (default 30). */
  threshold_days?: number;
  /** Cursor token for next page (null = first page). */
  cursor?: string | null;
  /** Max items per page (default 20). */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

/**
 * Fetch a cursor-paginated list of stale research artifacts.
 *
 * Backend: GET /api/artifacts/research/freshness-status
 * Query params:
 *   - threshold_days: int (default 30)
 *   - cursor: opaque string | absent for first page
 *   - limit: int (default 20)
 *
 * Returns FreshnessStatusEnvelope directly. Callers unpack `data` (items)
 * and `cursor` (next-page token, null on last page).
 */
export async function getFreshnessStatus(
  params: GetFreshnessStatusParams = {},
): Promise<FreshnessStatusEnvelope> {
  const { threshold_days = 30, cursor, limit = 20 } = params;

  const query = new URLSearchParams();
  query.set("threshold_days", String(threshold_days));
  query.set("limit", String(limit));
  if (cursor) query.set("cursor", cursor);

  const qs = query.toString();
  const path = `/artifacts/research/freshness-status${qs ? `?${qs}` : ""}`;

  return apiFetch<FreshnessStatusEnvelope>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Contradiction pair types (P7-02)
// ---------------------------------------------------------------------------

/**
 * Artifact stub embedded in a ContradictionPair.
 * Contains the minimal fields needed for display in the panel and detail view.
 */
export interface ContradictionArtifactStub {
  id: string;
  title: string;
  /** Short excerpt or summary — may be null when not available. */
  excerpt?: string | null;
  file_path: string;
}

/**
 * A single contradiction pair returned by
 * GET /api/artifacts/research/contradictions.
 *
 * artifact_a and artifact_b are the conflicting artifacts.
 * shared_topic is the topic tag under which the contradiction was detected.
 * flagged_at is an ISO 8601 timestamp string.
 */
export interface ContradictionPair {
  id: string;
  artifact_a: ContradictionArtifactStub;
  artifact_b: ContradictionArtifactStub;
  shared_topic: string;
  flagged_at: string;
}

export interface ContradictionsEnvelope {
  data: ContradictionPair[];
  cursor: string | null;
  etag?: string | null;
}

export interface GetContradictionsParams {
  /** Cursor token for next page (null = first page). */
  cursor?: string | null;
  /** Max items per page (default 20). */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Fetcher (P7-02)
// ---------------------------------------------------------------------------

/**
 * Fetch a cursor-paginated list of contradiction pairs.
 *
 * Backend: GET /api/artifacts/research/contradictions
 * Query params:
 *   - cursor: opaque string | absent for first page
 *   - limit: int (default 20)
 *
 * Returns ContradictionsEnvelope. Callers unpack `data` (pairs) and
 * `cursor` (next-page token, null on last page).
 *
 * Throws ApiError on HTTP errors.
 */
export async function getContradictions(
  params: GetContradictionsParams = {},
): Promise<ContradictionsEnvelope> {
  const { cursor, limit = 20 } = params;

  const query = new URLSearchParams();
  query.set("limit", String(limit));
  if (cursor) query.set("cursor", cursor);

  const qs = query.toString();
  const path = `/artifacts/research/contradictions${qs ? `?${qs}` : ""}`;

  return apiFetch<ContradictionsEnvelope>(path, { method: "GET" });
}
