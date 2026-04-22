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
  ArtifactFacet,
  ArtifactMetadataResponse,
  ArtifactStatus,
  ArtifactWorkspace,
  DerivativeItem,
  LensFidelity,
  LensFreshness,
  LensPatchRequest,
  LensVerificationState,
  RollupArtifactItem,
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
   * Portal surface facet filter — taxonomy-redesign P4-05 / P5-01.
   *
   * Serialised as ?facet=<value>. Facet is a query concept (OQ-6); the backend
   * maps it to SQL predicates:
   *   library / blog / projects → WHERE workspace = <value>
   *   research                  → WHERE research_origin = true
   *
   * ANDed with ?workspace= when both are supplied; prefer facet for
   * surface-level queries.
   */
  facet?: ArtifactFacet;
  /**
   * Filter by research_origin boolean. When true, returns only artifacts
   * produced by a research workflow. Serialised as ?research_origin=true|false.
   *
   * NOTE: The backend GET /api/artifacts route does not yet expose a
   * `research_origin` boolean query param — use `facet=research` instead,
   * which maps to WHERE research_origin = true. This field is reserved for
   * a future direct boolean filter. Tracked as mismatch MISMATCH-03.
   */
  researchOrigin?: boolean;
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
  /**
   * Source rollup view mode. When set to "source_rollup", the backend returns
   * RollupArtifactItem entries (ArtifactCard + derivative_count + derivatives_preview).
   * Serialised as ?view=source_rollup.
   */
  view?: "source_rollup";
  /**
   * Rollup lens — only valid alongside view=source_rollup.
   * "orphans" returns derivative-type artifacts with no resolvable source.
   * Serialised as ?rollup_lens=orphans.
   */
  rollupLens?: "orphans";
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
    facet,
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
    view,
    rollupLens,
  } = params;

  const query = new URLSearchParams();
  if (workspace) query.set("workspace", workspace);
  // Facet filter — taxonomy-redesign P4-05 / P5-01.
  // Use facet=research instead of researchOrigin=true (see MISMATCH-03 note).
  if (facet) query.set("facet", facet);
  // researchOrigin is reserved; not yet a real backend param — not serialised.

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

  // Source rollup view (library-source-rollup-v1)
  if (view) query.set("view", view);
  if (rollupLens) query.set("rollup_lens", rollupLens);

  const qs = query.toString();
  const path = `/artifacts${qs ? `?${qs}` : ""}`;

  return apiFetch<ServiceModeEnvelope<ArtifactCard>>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// List artifacts — source rollup view (library-source-rollup-v1 FE-01)
// ---------------------------------------------------------------------------

/**
 * Fetch the source rollup view of the library.
 *
 * Wraps listArtifacts with view=source_rollup set. Returns
 * ServiceModeEnvelope<RollupArtifactItem> so callers get derivative_count
 * and derivatives_preview on each item.
 *
 * Pass rollupLens="orphans" to switch to the orphans sub-lens.
 *
 * MISMATCH-NOTE: The backend returns derivative_count=0 / derivatives_preview=[]
 * for orphan items — the fields are present but not meaningful for that lens.
 */
export async function listArtifactsRollup(
  params: Omit<ListArtifactsParams, "view"> & { rollupLens?: "orphans" } = {},
): Promise<ServiceModeEnvelope<RollupArtifactItem>> {
  return listArtifacts({ ...params, view: "source_rollup" }) as Promise<
    ServiceModeEnvelope<RollupArtifactItem>
  >;
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

// ---------------------------------------------------------------------------
// Derivatives sub-resource (library-source-rollup-v1 DETAIL-01)
// ---------------------------------------------------------------------------

export interface GetDerivativesParams {
  cursor?: string | null;
  limit?: number;
}

/**
 * Fetch derivative artifacts compiled from a source artifact.
 *
 * Backend: GET /api/artifacts/{source_id}/derivatives
 * Response: ServiceModeEnvelope<DerivativeItem>
 * Ordering: artifact_type asc, updated_at desc.
 *
 * Throws ApiError with:
 *   - status 404 and code "not_found"     — unknown source_id
 *   - status 404 and code "not_a_source"  — artifact exists but is not a source type
 *
 * library-source-rollup-v1 Phase 3 DETAIL-01.
 */
export async function getDerivatives(
  sourceId: string,
  { cursor, limit = 50 }: GetDerivativesParams = {},
): Promise<ServiceModeEnvelope<DerivativeItem>> {
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  if (cursor) query.set("cursor", cursor);

  const qs = query.toString();
  const path = `/artifacts/${encodeURIComponent(sourceId)}/derivatives${qs ? `?${qs}` : ""}`;

  return apiFetch<ServiceModeEnvelope<DerivativeItem>>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Routing recommendation (P1.5-1-06)
// ---------------------------------------------------------------------------

/**
 * Routing recommendation returned by GET /api/artifacts/:id/routing-recommendation.
 *
 * ``template`` and ``rationale`` are null when no rule matches.
 */
export interface RoutingRecommendation {
  template: string | null;
  rationale: string | null;
}

/**
 * Fetch the rule-based routing recommendation for an artifact.
 *
 * Returns a ``RoutingRecommendation`` with non-null ``template`` and
 * ``rationale`` when a rule matches, or both fields null when no rule fires.
 *
 * Throws ``ApiError`` with status 404 when the artifact is not in the overlay.
 *
 * Backend: GET /api/artifacts/{artifact_id}/routing-recommendation
 */
export async function getRoutingRecommendation(
  id: string,
): Promise<RoutingRecommendation> {
  return apiFetch<RoutingRecommendation>(
    `/artifacts/${encodeURIComponent(id)}/routing-recommendation`,
    { method: "GET" },
  );
}

// ---------------------------------------------------------------------------
// Quality gates (Portal v1.5 P1.5-1-05)
// ---------------------------------------------------------------------------

/**
 * A single quality gate rule result as returned by
 * GET /api/artifacts/{artifact_id}/quality-gates.
 */
export interface QualityGateRule {
  name: string;
  passed: boolean;
  condition: string;
}

/**
 * Response body for GET /api/artifacts/{artifact_id}/quality-gates.
 *
 * ``null`` is returned when no quality gate data exists for the artifact.
 * The fetch function returns ``null`` in that case — callers render nothing.
 */
export interface QualityGatesResponse {
  rules: QualityGateRule[];
}

/**
 * Fetch quality gate results for an artifact's most recent compile workflow run.
 *
 * Returns ``QualityGatesResponse`` when gate data exists, or ``null`` when
 * the backend returns a JSON ``null`` body (no quality gates recorded).
 *
 * Throws ``ApiError`` with status 404 if the artifact does not exist.
 *
 * Backend: GET /api/artifacts/{artifact_id}/quality-gates
 * Portal v1.5 Phase 1 (P1.5-1-05).
 */
export async function getQualityGates(
  id: string,
): Promise<QualityGatesResponse | null> {
  return apiFetch<QualityGatesResponse | null>(
    `/artifacts/${encodeURIComponent(id)}/quality-gates`,
    { method: "GET" },
  );
}

// ---------------------------------------------------------------------------
// Lens PATCH (Portal v1.5 P1.5-1-04)
// ---------------------------------------------------------------------------

/**
 * Update lens fields for an artifact.
 *
 * PATCH /api/artifacts/{artifact_id}/lens
 *
 * Sends only the fields provided in `body`; omitted fields are left unchanged
 * in the backend (partial update semantics). Numeric dimensions are 0–10.
 *
 * Returns the updated ArtifactMetadataResponse wrapped in
 * ServiceModeEnvelope<ArtifactMetadataResponse>.
 *
 * Throws `ApiError` with status 404 if the artifact does not exist, or
 * 422 if validation fails (e.g. enum value out of range).
 *
 * Portal v1.5 Phase 1 (P1.5-1-03 backend, P1.5-1-04 frontend).
 */
export async function patchArtifactLens(
  id: string,
  body: LensPatchRequest,
): Promise<ServiceModeEnvelope<ArtifactMetadataResponse>> {
  return apiFetch<ServiceModeEnvelope<ArtifactMetadataResponse>>(
    `/artifacts/${encodeURIComponent(id)}/lens`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}
