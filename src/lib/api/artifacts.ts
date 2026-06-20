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
 *   - tag[]: repeatable tag filter, AND semantics
 *   - date_from/date_to: created date range
 *   - card_context: include enriched summary/linked/activity card fields
 *   - cursor: opaque pagination token
 *   - limit: page size
 *
 * Preview field note:
 *   Library callers request card_context=true so cards/sheets can render summary
 *   and linked/activity context without a per-card detail fetch.
 */

import { apiFetch } from "./client";
import { getApiBase } from "./config";
import type {
  ArtifactCard,
  ArtifactDetail,
  ArtifactFacet,
  ArtifactMetadataResponse,
  ArtifactStatus,
  ArtifactWorkspace,
  CostBreakdownResponse,
  DerivativeItem,
  LensFidelity,
  LensFreshness,
  LensPatchRequest,
  LensVerificationState,
  RollupArtifactItem,
  ServiceModeEnvelope,
} from "@/types/artifact";
import type { InboxWithProcessedEnvelope } from "@/types/compileEvents";

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
  /** Tag filters. Arrays serialise as repeatable ?tag[]= values. */
  tags?: string | string[];
  /** Date lower bound (YYYY-MM-DD). Serialised as ?date_from=. */
  dateFrom?: string;
  /** Date upper bound (YYYY-MM-DD). Serialised as ?date_to=. */
  dateTo?: string;
  /** Request enriched card fields for preview-first Library UI. */
  cardContext?: boolean;
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
  /**
   * P3-06 (inbox-live-status): when true and workspace=inbox, the response
   * uses InboxWithProcessedEnvelope which adds a `processed` array containing
   * recently compiled artifacts (past 24 h, cap 50, desc by terminal created_at).
   * Silently ignored when workspace is not "inbox".
   * Serialised as ?include_processed=true.
   */
  includeProcessed?: boolean;
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
    dateFrom,
    dateTo,
    cardContext,
    lensFidelity,
    lensFreshness,
    lensVerification,
    view,
    rollupLens,
    includeProcessed,
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
  if (tags) {
    const tagValues = Array.isArray(tags) ? tags : [tags];
    for (const tag of tagValues) {
      if (tag) query.append("tag[]", tag);
    }
  }
  if (dateFrom) query.set("date_from", dateFrom);
  if (dateTo) query.set("date_to", dateTo);
  if (cardContext) query.set("card_context", "true");
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

  // P3-06 inbox-live-status: processed artifacts extension
  if (includeProcessed) query.set("include_processed", "true");

  const qs = query.toString();
  const path = `/artifacts${qs ? `?${qs}` : ""}`;

  return apiFetch<ServiceModeEnvelope<ArtifactCard>>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// List inbox artifacts with processed section (inbox-live-status P3-06)
// ---------------------------------------------------------------------------

/**
 * Fetch inbox artifacts including the `processed` extension array.
 *
 * Returns `InboxWithProcessedEnvelope<ArtifactCard>` which adds the
 * `processed` array containing recently compiled artifacts (past 24 h, cap 50).
 *
 * Uses `include_processed=true` query param; workspace is forced to "inbox".
 */
export async function listInboxWithProcessed(
  params: Omit<ListArtifactsParams, "workspace" | "includeProcessed"> = {},
): Promise<InboxWithProcessedEnvelope<ArtifactCard>> {
  const envelope = await listArtifacts({
    ...params,
    workspace: "inbox",
    includeProcessed: true,
  });
  // If the backend returns the extended shape, the `processed` field is present.
  // Cast safely; if backend hasn't shipped the extension yet, fall back to [].
  const extended = envelope as unknown as InboxWithProcessedEnvelope<ArtifactCard> & {
    data?: ArtifactCard[];
  };
  return {
    items: extended.items ?? extended.data ?? [],
    processed: extended.processed ?? [],
    cursor: extended.cursor ?? null,
    etag: extended.etag,
  };
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
// Get artifact detail with cost breakdown (P4-FE-002)
// ---------------------------------------------------------------------------

/**
 * ArtifactDetail extended with the optional cost_breakdown field.
 *
 * Only present when GET /api/artifacts/:id is called with ?include=cost
 * AND the backend has recorded cost data for this artifact.
 */
export interface ArtifactDetailWithCost extends ArtifactDetail {
  cost_breakdown?: CostBreakdownResponse | null;
}

/**
 * Fetch a single artifact by ID with cost breakdown data included.
 *
 * Calls GET /api/artifacts/{id}?include=cost — the backend attaches a
 * ``cost_breakdown`` field to the ArtifactDetail response when cost records
 * exist. When no cost data has been recorded the field is absent or null.
 *
 * Throws ``ApiError`` with status 404 when the artifact is not found.
 *
 * Backend: GET /api/artifacts/{artifact_id}?include=cost
 * P4-FE-002.
 */
export async function getArtifactWithCost(
  id: string,
): Promise<ArtifactDetailWithCost> {
  return apiFetch<ArtifactDetailWithCost>(
    `/artifacts/${encodeURIComponent(id)}?include=cost`,
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
// ML routing recommendation (P2-4-08) — GET /api/artifacts/:id/routing
// ---------------------------------------------------------------------------

/**
 * ML-based routing recommendation returned by
 * GET /api/artifacts/:id/routing?recommend=true (P2-4-08).
 *
 * ```next_template``` is null when no recommendation is available.
 * ```confidence_score``` is a float in [0.0, 1.0].
 */
export interface MLRoutingRecommendation {
  next_template: string | null;
  confidence_score: number;
  rationale: string | null;
}

/**
 * Fetch the ML-based routing recommendation for an artifact.
 *
 * Calls GET /api/artifacts/{artifact_id}/routing?recommend=true.
 * Returns null next_template when no recommendation matches.
 *
 * Backend: GET /api/artifacts/{artifact_id}/routing (P2-4-08)
 */
export async function getMLRoutingRecommendation(
  id: string,
): Promise<MLRoutingRecommendation> {
  return apiFetch<MLRoutingRecommendation>(
    `/artifacts/${encodeURIComponent(id)}/routing?recommend=true`,
    { method: 'GET' },
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
// ---------------------------------------------------------------------------
// Inline field editing — PATCH /api/artifacts/:id (Portal v1.8 P2-05)
// ---------------------------------------------------------------------------

/**
 * Custom error thrown when the server returns 412 Precondition Failed.
 *
 * Indicates another client has modified the artifact since the caller last
 * fetched it.  The caller should re-fetch, discard local edits, and retry.
 *
 * ``currentEtag`` is the ETag from the 412 response body when the backend
 * includes it; undefined otherwise.
 */
export class ETagMismatchError extends Error {
  constructor(public currentEtag?: string) {
    super("ETag mismatch — artifact was edited elsewhere");
    this.name = "ETagMismatchError";
  }
}

/**
 * Custom error thrown when the server returns 422 Unprocessable Entity.
 *
 * ``field`` is the first erroring field name extracted from the FastAPI
 * validation detail array.  ``detail`` is the human-readable message.
 */
export class ArtifactValidationError extends Error {
  constructor(
    public field: string,
    public detail: string,
  ) {
    super(`Invalid value for ${field}: ${detail}`);
    this.name = "ArtifactValidationError";
  }
}

/**
 * Editable fields for a single artifact.
 *
 * Mirrors ``ArtifactPatchRequest`` in the backend
 * (portal/api/schemas/core.py).  All fields are optional; omit a field to
 * leave it unchanged.
 *
 * Note on tags: the backend uses ``tags_add`` / ``tags_remove`` for
 * additive tag mutation rather than a full replacement ``tags`` array.
 * Use ``owners`` as a full replacement list.
 */
export interface ArtifactPatchFields {
  title?: string | null;
  description?: string | null;
  status?: string | null;
  workspace?: string | null;
  /** Tags to add (backend: tags_add) */
  tags_add?: string[] | null;
  /** Tags to remove (backend: tags_remove) */
  tags_remove?: string[] | null;
  domain?: string | null;
  project?: string | null;
  freshness_class?: string | null;
  verification_status?: string | null;
  series?: string | null;
  publish_state?: string | null;
  owners?: string[] | null;
}

/**
 * PATCH a single artifact's editable fields.
 *
 * Sends ``If-Match: <etag>`` (required by the backend — missing header returns
 * 400; stale ETag returns 412).  Returns the updated ``ArtifactDetail`` and
 * the new ETag from the response ``ETag`` header.
 *
 * Uses a raw fetch path rather than ``apiFetch`` because ``apiFetch`` does not
 * expose response headers — the ETag must be read before the body is consumed.
 *
 * Throws:
 *   - ``ETagMismatchError``       on 412 (optimistic-concurrency conflict)
 *   - ``ArtifactValidationError`` on 422 (field-level validation failure)
 *   - ``ApiError``                on any other non-2xx status
 *
 * Backend: PATCH /api/artifacts/{artifact_id}
 * Portal v1.8 Phase 2 (P2-05).
 */
export async function patchArtifact(
  id: string,
  fields: Partial<ArtifactPatchFields>,
  etag: string,
): Promise<{ data: ArtifactDetail; etag: string }> {
  const { ApiError } = await import("./client");

  const url = `${getApiBase()}/artifacts/${encodeURIComponent(id)}`;

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("If-Match", etag);

  // Server-side: attach bearer token (mirrors apiFetch auth logic).
  if (typeof window === "undefined") {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("portal_session");
      if (sessionCookie?.value) {
        headers.set("Authorization", `Bearer ${sessionCookie.value}`);
      } else {
        const envToken = process.env.MEATYWIKI_PORTAL_TOKEN;
        if (envToken) headers.set("Authorization", `Bearer ${envToken}`);
      }
    } catch {
      const envToken = process.env.MEATYWIKI_PORTAL_TOKEN;
      if (envToken) headers.set("Authorization", `Bearer ${envToken}`);
    }
  }

  const response = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify(fields),
  });

  if (response.status === 412) {
    // Try to extract current ETag from the response body if the backend sends it.
    let currentEtag: string | undefined;
    try {
      const body = await response.json();
      currentEtag =
        (body as { etag?: string })?.etag ??
        response.headers.get("ETag") ??
        undefined;
    } catch {
      // body not parseable — leave currentEtag undefined
    }
    throw new ETagMismatchError(currentEtag);
  }

  if (response.status === 422) {
    // FastAPI validation errors: { detail: [{ loc: [...], msg: string, type: string }] }
    let field = "unknown";
    let detail = "Validation error";
    try {
      const body = (await response.json()) as {
        detail?: Array<{ loc?: string[]; msg?: string }>;
      };
      const first = body.detail?.[0];
      if (first) {
        // loc is ["body", "field_name"] — take the last element as the field name
        field = first.loc?.at(-1) ?? "unknown";
        detail = first.msg ?? "Validation error";
      }
    } catch {
      // keep defaults
    }
    throw new ArtifactValidationError(field, detail);
  }

  if (!response.ok) {
    const raw = await response.text();
    let body: unknown = raw;
    try {
      body = raw ? JSON.parse(raw) : raw;
    } catch {
      // keep raw text
    }
    throw new ApiError(response.status, body);
  }

  const responseEtag = response.headers.get("ETag") ?? etag;
  const data = (await response.json()) as ArtifactDetail;

  return { data, etag: responseEtag };
}

/**
 * Fetch the current ETag for an artifact without consuming the body.
 *
 * Performs a raw GET against the artifact detail endpoint and reads the
 * `ETag` response header before discarding the body.  Used to initialise
 * the ETag state in ArtifactDetailClient so the first inline-edit PATCH
 * has a valid `If-Match` value.
 *
 * Returns the ETag string, or `""` when the server omits the header.
 *
 * Backend: GET /api/artifacts/{artifact_id}
 * Portal v1.8 Phase 2 (P2-06).
 */
export async function fetchArtifactEtag(id: string): Promise<string> {
  const url = `${getApiBase()}/artifacts/${encodeURIComponent(id)}`;

  const headers = new Headers();
  headers.set("Accept", "application/json");

  if (typeof window === "undefined") {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("portal_session");
      if (sessionCookie?.value) {
        headers.set("Authorization", `Bearer ${sessionCookie.value}`);
      } else {
        const envToken = process.env.MEATYWIKI_PORTAL_TOKEN;
        if (envToken) headers.set("Authorization", `Bearer ${envToken}`);
      }
    } catch {
      const envToken = process.env.MEATYWIKI_PORTAL_TOKEN;
      if (envToken) headers.set("Authorization", `Bearer ${envToken}`);
    }
  }

  try {
    const response = await fetch(url, { method: "GET", headers });
    const etag = response.headers.get("ETag") ?? "";
    // Discard body — we only needed the header.
    await response.body?.cancel();
    return etag;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Link artifact (rail action — audit-wave-2 P2-02/03)
// ---------------------------------------------------------------------------

/**
 * Valid edge types for POST /api/artifacts/{id}/link.
 *
 * Mirrors EdgeType StrEnum in src/meatywiki/schema/edges.py.
 */
export type ArtifactEdgeType =
  | "derived_from"
  | "supports"
  | "relates_to"
  | "references"
  | "supersedes"
  | "contradicts"
  | "contains"
  | "generated_by"
  | "possible_duplicate_of"
  | "redirects_to"
  | "merged_into";

export interface LinkArtifactRequest {
  target_id: string;
  edge_type?: ArtifactEdgeType;
}

export interface LinkArtifactResponse {
  status: string;
}

/**
 * Create a directed edge between this artifact and a target artifact.
 *
 * Backend: POST /api/artifacts/{artifact_id}/link
 * Returns { status: "linked" } on success.
 * Throws Error with the server detail message on 400/5xx.
 */
export async function linkArtifact(
  id: string,
  body: LinkArtifactRequest,
): Promise<LinkArtifactResponse> {
  const res = await fetch(`/api/artifacts/${encodeURIComponent(id)}/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ edge_type: "relates_to", ...body }),
  });
  if (!res.ok) {
    let detail = `Link failed: ${res.status}`;
    try {
      const body = await res.json() as { detail?: { error?: { message?: string } } };
      if (body?.detail?.error?.message) detail = body.detail.error.message;
    } catch { /* keep default */ }
    throw new Error(detail);
  }
  return res.json() as Promise<LinkArtifactResponse>;
}

// ---------------------------------------------------------------------------
// Request review (rail action — audit-wave-2 P2-04)
// ---------------------------------------------------------------------------

/**
 * Valid review types for POST /api/artifacts/{id}/review.
 *
 * Mirrors ReviewType StrEnum in src/meatywiki/portal/db/models.py.
 */
export type ArtifactReviewType =
  | "lint"
  | "verification"
  | "promotion"
  | "freshness"
  | "contradiction";

export interface RequestReviewRequest {
  review_type: ArtifactReviewType;
  notes?: string | null;
}

export interface RequestReviewResponse {
  id: number;
}

/**
 * Add the artifact to the portal review queue.
 *
 * Backend: POST /api/artifacts/{artifact_id}/review
 * Returns { id: <review_item_id> } on success.
 * Throws Error with the server detail message on 422/5xx.
 */
export async function requestReview(
  id: string,
  body: RequestReviewRequest,
): Promise<RequestReviewResponse> {
  const res = await fetch(`/api/artifacts/${encodeURIComponent(id)}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `Review request failed: ${res.status}`;
    try {
      const body = await res.json() as { detail?: { error?: { message?: string } } };
      if (body?.detail?.error?.message) detail = body.detail.error.message;
    } catch { /* keep default */ }
    throw new Error(detail);
  }
  return res.json() as Promise<RequestReviewResponse>;
}

// ---------------------------------------------------------------------------
// Archive artifact (meatballs menu)
// ---------------------------------------------------------------------------

/**
 * Archive an artifact by ID.
 *
 * Backend: POST /api/artifacts/{artifact_id}/archive
 * Response: ArtifactDetail (envelope.data)
 */
export async function archiveArtifact(id: string): Promise<ArtifactDetail> {
  const res = await fetch(`/api/artifacts/${encodeURIComponent(id)}/archive`, { method: "POST" });
  if (!res.ok) throw new Error(`Archive failed: ${res.status}`);
  const envelope = await res.json();
  return envelope.data;
}

// ---------------------------------------------------------------------------
// Delete artifact (meatballs menu)
// ---------------------------------------------------------------------------

/**
 * Permanently delete an artifact by ID.
 *
 * Backend: DELETE /api/artifacts/{artifact_id}
 */
export async function deleteArtifact(id: string): Promise<void> {
  const res = await fetch(`/api/artifacts/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export async function patchArtifactLens(
  id: string,
  body: LensPatchRequest,
): Promise<ServiceModeEnvelope<ArtifactMetadataResponse>> {
  return apiFetch<ServiceModeEnvelope<ArtifactMetadataResponse>>(
    `/artifacts/${encodeURIComponent(id)}/lens`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

// ---------------------------------------------------------------------------
// Workspace PATCH — auto-route CTA (P7-02)
// ---------------------------------------------------------------------------

/**
 * Patch only the workspace field of an artifact.
 *
 * Used by the auto-route CTA in InboxContextRail (P7-02). Fires
 * PATCH /api/artifacts/{id}/workspace with { workspace: <target> }.
 *
 * Returns the updated ArtifactCard so callers can refresh derived state.
 * Throws ApiError on non-2xx responses.
 *
 * Note: This endpoint does NOT require an ETag because workspace routing is
 * a non-content mutation — the backend treats it as a cheap state transition
 * rather than a content edit. Omitting ETag avoids an extra GET round-trip
 * in the auto-route flow.
 */
export async function patchArtifactWorkspace(
  id: string,
  workspace: ArtifactWorkspace,
): Promise<ArtifactCard> {
  return apiFetch<ArtifactCard>(
    `/artifacts/${encodeURIComponent(id)}/workspace`,
    { method: "PATCH", body: JSON.stringify({ workspace }) },
  );
}

// ---------------------------------------------------------------------------
// Activity endpoint (P4-01 — Library card status badge)
// ---------------------------------------------------------------------------

import type { ActivityResponse } from "@/types/compileEvents";

export interface FetchArtifactActivityParams {
  /** Maximum number of events to fetch. Defaults to 10 for badge; 100 for full history. */
  limit?: number;
  /** ISO 8601 cursor — fetch events before this timestamp (DESC pagination). */
  before?: string;
}

/**
 * Fetch paginated workflow stage event history for a single artifact.
 *
 * Endpoint: GET /api/artifacts/{id}/activity?limit={n}&before={iso}
 * Response: { items: WorkflowStageEventDTO[], next_cursor: string | null }
 *
 * Returns an empty ActivityResponse on 404 (endpoint not yet live in dev).
 *
 * P4-01: Used by useArtifactActivity to power LibraryCardStatusBadge.
 */
export async function fetchArtifactActivity(
  artifactId: string,
  params: FetchArtifactActivityParams = {},
): Promise<ActivityResponse> {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.before) qs.set("before", params.before);
  const query = qs.toString() ? `?${qs.toString()}` : "";

  try {
    return await apiFetch<ActivityResponse>(
      `/artifacts/${encodeURIComponent(artifactId)}/activity${query}`,
    );
  } catch (err) {
    // Graceful degradation: treat 404 as "no history yet" (endpoint may not be
    // available in all deploy targets).
    if (err instanceof Error && err.message.includes("404")) {
      return { items: [], next_cursor: null };
    }
    throw err;
  }
}

/**
 * TanStack Query cache key for artifact activity.
 * Stable shape: ["artifact", "activity", artifactId].
 * Used by useArtifactActivity and for manual invalidation from InboxClient
 * on terminal-success events.
 */
export const artifactActivityQueryKey = (artifactId: string) =>
  ["artifact", "activity", artifactId] as const;

/**
 * Convenience helper: invalidate the activity cache for a single artifact.
 * Call this from InboxClient on terminal-success so Library badges for the
 * same artifact refresh within <5 s (query staleTime + refetch on focus).
 *
 * Requires a TanStack QueryClient instance.
 */
export function invalidateActivityCache(
  queryClient: import("@tanstack/react-query").QueryClient,
  artifactId: string,
): void {
  void queryClient.invalidateQueries({ queryKey: artifactActivityQueryKey(artifactId) });
}

// ---------------------------------------------------------------------------
// Move artifact workspace (P6-02 — InboxContextRail workspace action)
// ---------------------------------------------------------------------------

/**
 * Move an artifact to a different workspace.
 *
 * Backend: PATCH /api/artifacts/{id}/workspace
 * Body: { target_workspace: string }
 * Response: ArtifactDetail (the updated artifact, no envelope wrapper).
 *
 * Throws ApiError on 404 (unknown artifact) or 422 (invalid workspace value).
 *
 * P6-02: wired into useMoveArtifactWorkspace for InboxContextRail action.
 */
export async function moveArtifactWorkspace(
  id: string,
  targetWorkspace: string,
): Promise<ArtifactDetail> {
  return apiFetch<ArtifactDetail>(
    `/artifacts/${encodeURIComponent(id)}/workspace`,
    {
      method: "PATCH",
      body: JSON.stringify({ target_workspace: targetWorkspace }),
    },
  );
}

// ---------------------------------------------------------------------------
// Link artifact to project (P6-02 — InboxContextRail project link action)
// ---------------------------------------------------------------------------

export interface LinkArtifactToProjectResponse {
  artifact_id: string;
  project_id: string;
  status: string;
}

/**
 * Link an artifact to a project.
 *
 * Backend: POST /api/artifacts/{artifactId}/projects/{projectId}/link
 * Body: {} (empty — IDs are path params)
 * Response: { artifact_id, project_id, status }
 *
 * Throws ApiError on 404 (unknown artifact or project) or 409 (already linked).
 *
 * P6-02: wired into useLinkArtifactToProject for InboxContextRail action.
 */
export async function linkArtifactToProject(
  artifactId: string,
  projectId: string,
): Promise<LinkArtifactToProjectResponse> {
  return apiFetch<LinkArtifactToProjectResponse>(
    `/artifacts/${encodeURIComponent(artifactId)}/projects/${encodeURIComponent(projectId)}/link`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

// ---------------------------------------------------------------------------
// v1.7 additions — promoteArtifact, ReviewRequest, fetchRoutingRecommendation
// ---------------------------------------------------------------------------

/**
 * Response body for POST /api/artifacts/:id/promote.
 *
 * ``lifecycle_stage`` is the new stage after promotion
 * (raw → classified → compiled → reviewed → published).
 */
export interface PromoteArtifactResponse {
  artifact_id: string;
  lifecycle_stage: string;
}

/**
 * Promote an artifact's lifecycle stage.
 *
 * Backend: POST /api/artifacts/{artifact_id}/promote
 * Calls EngineAdapter.promote_artifact() which advances vault frontmatter
 * ``lifecycle_stage`` one step along the linear order.
 *
 * Throws ``ApiError`` with status 404 when the artifact is not found,
 * or 500 on engine adapter error.
 *
 * Portal v1.7 Phase 3 (P3-01 / P3-07).
 */
export async function promoteArtifact(
  artifactId: string,
): Promise<PromoteArtifactResponse> {
  return apiFetch<PromoteArtifactResponse>(
    `/artifacts/${encodeURIComponent(artifactId)}/promote`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

/**
 * Request body for POST /api/artifacts/:id/review.
 *
 * ``review_type`` must be one of: lint, verification, promotion, freshness,
 * contradiction. ``notes`` is optional free-text context.
 */
export interface ReviewRequest {
  review_type: string;
  notes?: string | null;
}

/**
 * Alias for ``getRoutingRecommendation`` — exposes the ``fetch*`` naming
 * convention used in Phase 3 component wiring (P3-04).
 *
 * Backend: GET /api/artifacts/{artifact_id}/routing-recommendation
 * Throws ``ApiError`` with status 404 when the artifact is not in the overlay.
 *
 * Portal v1.7 Phase 3 (P3-01 / P3-04).
 */
export { getRoutingRecommendation as fetchRoutingRecommendation };

// ---------------------------------------------------------------------------
// Reclassify artifact (P4-FE-006)
// ---------------------------------------------------------------------------

/**
 * Request body for POST /api/artifacts/{artifact_id}/reclassify.
 *
 * ``new_type`` is the target artifact type (e.g. "concept", "entity").
 * ``re_extract`` when true triggers a fresh extraction pass on reclassification.
 */
export interface ReclassifyArtifactRequest {
  new_type: string;
  re_extract?: boolean;
}

/**
 * Reclassify an artifact to a new type.
 *
 * Backend: POST /api/artifacts/{artifact_id}/reclassify
 * Body: { new_type: string; re_extract?: boolean }
 * Response: updated ArtifactDetail on success.
 * Error: { error: { code, message } }
 *
 * Throws ApiError on non-2xx responses.
 *
 * Audit Wave 3 — P4-FE-006.
 */
export async function reclassifyArtifact(
  id: string,
  body: ReclassifyArtifactRequest,
): Promise<ArtifactDetail> {
  return apiFetch<ArtifactDetail>(
    `/artifacts/${encodeURIComponent(id)}/reclassify`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

/**
 * Run a scoped lint pass on a single artifact.
 *
 * Backend: PATCH /api/artifacts/{artifact_id}/lint-scope
 * Request: { scope: "frontmatter" | "content" | "all" }
 * Response: LintScopeResponse with violations, severity, totals, and per-check
 *           results (P2-01 backend DTO).
 * Throws ApiError on non-2xx responses.
 *
 * Audit Wave 3 — P4-FE-008. Updated to PATCH + scope param: P2-02.
 */
export async function lintArtifactScope(
  id: string,
  scope: import("@/types/artifact").LintScope = "all",
): Promise<import("@/types/artifact").LintScopeResponse> {
  return apiFetch<import("@/types/artifact").LintScopeResponse>(
    `/artifacts/${encodeURIComponent(id)}/lint-scope`,
    { method: "PATCH", body: JSON.stringify({ scope }) },
  );
}

// ---------------------------------------------------------------------------
// Unlink edge between two artifacts (Portal v2.6 P2-04)
// ---------------------------------------------------------------------------

/**
 * Request parameters for DELETE /api/artifacts/{source_id}/edges/{target_id}.
 *
 * ``edgeType`` is an optional filter — when supplied, only the edge of that
 * specific type is removed; when omitted, all edges between source and target
 * are removed.
 */
export interface UnlinkEdgeParams {
  edgeType?: string;
}

/**
 * Remove one or all directed edges between two artifacts.
 *
 * Calls DELETE /api/artifacts/{source_id}/edges/{target_id} with an optional
 * ?edge_type= query parameter.
 *
 * When ``params.edgeType`` is provided, only the edge matching that type is
 * deleted. When omitted, the backend removes all edges between the two
 * artifacts regardless of type.
 *
 * Returns void on success (backend responds with 204 No Content).
 *
 * Throws ApiError on:
 *   - 404 — source or target artifact not found, or no matching edge exists
 *   - 422 — invalid edge_type value
 *
 * Portal v2.6 Phase 2 (P2-04 data layer).
 */
export async function unlinkEdge(
  sourceId: string,
  targetId: string,
  params: UnlinkEdgeParams = {},
): Promise<void> {
  const query = new URLSearchParams();
  if (params.edgeType) query.set("edge_type", params.edgeType);

  const qs = query.toString();
  const path =
    `/artifacts/${encodeURIComponent(sourceId)}/edges/${encodeURIComponent(targetId)}` +
    (qs ? `?${qs}` : "");

  return apiFetch<void>(path, { method: "DELETE" });
}
