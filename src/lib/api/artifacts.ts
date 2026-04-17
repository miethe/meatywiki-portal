/**
 * Artifacts API — typed wrappers around GET /api/artifacts and GET /api/artifacts/:id.
 *
 * Primary owner: P3-05 (Library screen — extended with multi-select filters + sort).
 * Extended from P3-03 minimal version. Both screens share this module.
 * getArtifact added in P3-06 (Artifact Detail screen).
 *
 * Used by:
 *   - Library screen (P3-05): workspace="library", multi-select type/status, sort
 *   - Inbox screen (P3-03): workspace="inbox", default sort by updated desc
 *   - Artifact detail screen (P3-06): single artifact by ID
 *   - Server components (SSR initial fetch, cookie-forwarded auth)
 *   - Client components (load-more pagination via /api proxy)
 *
 * Response shape: ServiceModeEnvelope<ArtifactCard> from design spec §5.
 *
 * Backend query params:
 *   - workspace: single value
 *   - type: multi-value (?type=concept&type=entity) — multi-select in Library
 *   - status: multi-value (?status=active&status=draft) — multi-select in Library
 *   - sort: updated | created | title  (field name)
 *   - order: asc | desc
 *   - cursor: opaque pagination token
 *   - limit: page size
 *
 * NOTE: tag filter is NOT implemented — backend does not support tag query param
 * in v1. When backend adds tag filtering, add `tags?: string[]` to params and
 * append each tag as ?tags=foo&tags=bar.
 *
 * Preview field note:
 *   The backend ArtifactCard DTO does NOT include a preview/summary field on
 *   list responses (design spec §4). The `preview` field on the frontend type
 *   remains undefined for all list-view items in v1.
 */

import { apiFetch } from "./client";
import type {
  ArtifactCard,
  ArtifactDetail,
  ArtifactStatus,
  ArtifactWorkspace,
  ServiceModeEnvelope,
  SingleEnvelope,
} from "@/types/artifact";

// ---------------------------------------------------------------------------
// Query parameter shape
// ---------------------------------------------------------------------------

export type ArtifactSortField = "updated" | "created" | "title";
export type SortOrder = "asc" | "desc";

export interface ListArtifactsParams {
  workspace?: ArtifactWorkspace | string;
  /**
   * Multi-select type filter. Serialised as repeated ?type= params.
   * Accepts a single string (P3-03 compatibility) or an array (P3-05).
   */
  type?: string | string[];
  /**
   * Multi-select status filter. Serialised as repeated ?status= params.
   * Accepts a single string (P3-03 compatibility) or an array (P3-05).
   */
  status?: ArtifactStatus | ArtifactStatus[] | string | string[];
  /** Sort field — defaults to "updated" on the backend */
  sort?: ArtifactSortField;
  /** Sort direction — defaults to "desc" on the backend */
  order?: SortOrder;
  cursor?: string | null;
  limit?: number;
  /**
   * @deprecated use type[] array instead. Kept for P3-03 back-compat.
   * Will be removed when P3-03 is updated.
   */
  tags?: string;
}

// ---------------------------------------------------------------------------
// List artifacts
// ---------------------------------------------------------------------------

/**
 * Fetch a cursor-paginated, filtered page of artifacts.
 *
 * Returns `ServiceModeEnvelope<ArtifactCard>` directly — callers unpack
 * `data` (items) and `cursor` (next-page token, null on last page).
 *
 * Server-side calls automatically attach the bearer token via `apiFetch`.
 * Client-side calls go through the /api proxy (Next.js rewrite) and rely
 * on the browser sending the HttpOnly cookie.
 */
export async function listArtifacts(
  params: ListArtifactsParams = {},
): Promise<ServiceModeEnvelope<ArtifactCard>> {
  const { workspace, status, type, sort, order, cursor, limit = 50, tags } =
    params;

  const query = new URLSearchParams();
  if (workspace) query.set("workspace", workspace);

  // Multi-value type filter
  if (type) {
    const types = Array.isArray(type) ? type : [type];
    for (const t of types) {
      if (t) query.append("type", t);
    }
  }

  // Multi-value status filter
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    for (const s of statuses) {
      if (s) query.append("status", s);
    }
  }

  if (sort) query.set("sort", sort);
  if (order) query.set("order", order);
  if (cursor) query.set("cursor", cursor);
  if (tags) query.set("tags", tags); // legacy P3-03 compat
  query.set("limit", String(limit));

  const qs = query.toString();
  const path = `/api/artifacts${qs ? `?${qs}` : ""}`;

  return apiFetch<ServiceModeEnvelope<ArtifactCard>>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Get single artifact detail (P3-06)
// ---------------------------------------------------------------------------

/**
 * Fetch a single artifact by ID.
 *
 * Returns `SingleEnvelope<ArtifactDetail>` — callers unpack `data`.
 *
 * Throws `ApiError` with status 404 when the artifact is not found.
 * Callers should catch and render appropriate error states.
 *
 * Backend: GET /api/artifacts/{artifact_id}
 * Response model: ArtifactDetail (extends ArtifactCard with richer fields).
 */
export async function getArtifact(id: string): Promise<ArtifactDetail> {
  const envelope = await apiFetch<SingleEnvelope<ArtifactDetail>>(
    `/api/artifacts/${encodeURIComponent(id)}`,
    { method: "GET" },
  );
  return envelope.data;
}
