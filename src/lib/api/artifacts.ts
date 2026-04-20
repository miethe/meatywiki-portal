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
  LensFidelity,
  LensFreshness,
  LensVerificationState,
  ServiceModeEnvelope,
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
  /**
   * Lens fidelity filter (P4-09). Repeatable; ORed within the param.
   * Maps to ?lens_fidelity=high&lens_fidelity=medium on the backend.
   */
  lensFidelity?: LensFidelity[];
  /**
   * Lens freshness filter (P4-09). Repeatable; ORed within the param.
   * Maps to ?lens_freshness=current&lens_freshness=stale on the backend.
   */
  lensFreshness?: LensFreshness[];
  /**
   * Lens verification filter (P4-09). Repeatable; ORed within the param.
   * Maps to ?lens_verification=verified on the backend.
   */
  lensVerification?: LensVerificationState[];
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
  const {
    workspace,
    status,
    type,
    sort,
    order,
    cursor,
    limit = 50,
    tags,
    lensFidelity,
    lensFreshness,
    lensVerification,
  } = params;

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

  // Lens filters (P4-09) — each value appended as a separate query param
  if (lensFidelity && lensFidelity.length > 0) {
    for (const v of lensFidelity) query.append("lens_fidelity", v);
  }
  if (lensFreshness && lensFreshness.length > 0) {
    for (const v of lensFreshness) query.append("lens_freshness", v);
  }
  if (lensVerification && lensVerification.length > 0) {
    for (const v of lensVerification) query.append("lens_verification", v);
  }

  const qs = query.toString();
  const path = `/artifacts${qs ? `?${qs}` : ""}`;

  return apiFetch<ServiceModeEnvelope<ArtifactCard>>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Get single artifact detail (P3-06)
// ---------------------------------------------------------------------------

/**
 * Fetch a single artifact by ID.
 *
 * Throws `ApiError` with status 404 when the artifact is not found.
 * Callers should catch and render appropriate error states.
 *
 * Backend: GET /api/artifacts/{artifact_id}
 * Response model: ArtifactDetail returned directly (no envelope wrapping —
 * detail endpoints on this API do not use SingleEnvelope).
 */
export async function getArtifact(id: string): Promise<ArtifactDetail> {
  return apiFetch<ArtifactDetail>(
    `/artifacts/${encodeURIComponent(id)}`,
    { method: "GET" },
  );
}
