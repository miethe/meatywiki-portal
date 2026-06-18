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
 * P5-01: Active research runs endpoint wiring.
 *   GET /api/workflows/runs?template_id=external_research_v1
 *   Returns cursor-paginated WorkflowRun list for the ActiveResearchRuns widget.
 *
 * Envelope shape: { data: T[], cursor: string | null, etag: string | null }
 * Compatible with ServiceModeEnvelope<T>.
 */

import { apiFetch } from "./client";
import type { WorkflowRun, ServiceModeEnvelope } from "@/types/artifact";

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

// ---------------------------------------------------------------------------
// Active Research Runs (P5-01)
// ---------------------------------------------------------------------------

/**
 * Fetch cursor-paginated list of external_research_v1 workflow runs.
 *
 * Backend: GET /api/workflows/runs?template_id=external_research_v1
 *
 * CONTRACT NOTE: The endpoint is /api/workflows/runs (not /api/workflows).
 * Filters by template_id to return only external research runs.
 * Runs in all statuses are included; the widget filters client-side for active.
 */
export async function listActiveResearchRuns(
  cursor?: string | null,
  limit = 50,
): Promise<ServiceModeEnvelope<WorkflowRun>> {
  const query = new URLSearchParams();
  query.set("template_id", "external_research_v1");
  query.set("limit", String(limit));
  if (cursor) query.set("cursor", cursor);

  const qs = query.toString();
  return apiFetch<ServiceModeEnvelope<WorkflowRun>>(
    `/workflows/runs?${qs}`,
    { method: "GET" },
  );
}

// ---------------------------------------------------------------------------
// Run detail (P5-03)
// ---------------------------------------------------------------------------

import type {
  WorkflowRunDetail,
  SingleEnvelope,
  ExternalResearchTaskRow,
  PatchTaskStatusBody,
  UploadResultJsonBody,
  UploadResultResponse,
  PackageUploadResponse,
  PackageUploadFieldError,
} from "@/types/workflows/research";

// ---------------------------------------------------------------------------
// Package upload — POST /api/workflows/external-research/package-upload (P3-01)
// ---------------------------------------------------------------------------

export { ApiError } from "@/lib/api/client";

export interface PackageUploadResult {
  /** Parsed parameters on success. */
  data: PackageUploadResponse;
  /** Field-level errors present when the backend returned 422. */
  fieldErrors: PackageUploadFieldError[];
  /** True when backend returned 422 (validation failure). */
  hasFieldErrors: boolean;
  /** Top-level backend error message for 422s without field detail. */
  message: string | null;
}

/**
 * Upload a .json research package file.
 *
 * Backend: POST /api/workflows/external-research/package-upload
 * Accepts: multipart/form-data with a single `file` field (JSON)
 * Returns 200 with parsed ExternalResearchParams on success.
 * Returns 422 with Pydantic field errors on validation failure.
 *
 * NOTE: Do NOT set Content-Type header — fetch sets it with the multipart boundary.
 */
export async function uploadResearchPackage(
  file: File,
): Promise<PackageUploadResult> {
  const form = new FormData();
  form.append("file", file);

  // We need raw response access for 422 handling, so use fetch directly
  // rather than apiFetch (which throws on non-ok responses).
  const { getApiBase } = await import("@/lib/api/config");
  const url = `${getApiBase()}/workflows/external-research/package-upload`;

  const response = await fetch(url, { method: "POST", body: form });

  if (response.status === 422) {
    // Backend 422 detail is a DICT: { code, message, errors?: PydanticErrorList }
    // rather than the default FastAPI array shape.
    let fieldErrors: PackageUploadFieldError[] = [];
    let topLevelMessage: string | null = null;
    try {
      const raw = (await response.json()) as {
        detail?:
          | { loc?: (string | number)[]; msg?: string }[]
          | { code?: string; message?: string; errors?: { loc?: (string | number)[]; msg?: string }[] };
      };
      if (Array.isArray(raw.detail)) {
        // (a) Standard FastAPI array shape
        fieldErrors = raw.detail.map((err) => ({
          field: (err.loc ?? []).filter((s) => s !== "body").join("."),
          message: err.msg ?? "Validation error",
        }));
      } else if (raw.detail !== null && typeof raw.detail === "object") {
        // (b) Dict shape from the package-upload endpoint
        const detail = raw.detail as { code?: string; message?: string; errors?: { loc?: (string | number)[]; msg?: string }[] };
        if (detail.message) topLevelMessage = detail.message;
        if (Array.isArray(detail.errors)) {
          fieldErrors = detail.errors.map((err) => ({
            field: (err.loc ?? []).filter((s) => s !== "body").join("."),
            message: err.msg ?? "Validation error",
          }));
        }
      }
      // (c) Unparseable → both stay at defaults (empty array, null message)
    } catch {
      // keep empty fieldErrors and null message
    }
    // Return an empty-but-typed data object; callers check hasFieldErrors.
    return {
      data: { params: { topic: "", research_question: "" }, filename: "", size_bytes: 0 },
      fieldErrors,
      hasFieldErrors: true,
      message: topLevelMessage,
    };
  }

  if (!response.ok) {
    throw new Error(`Package upload failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as PackageUploadResponse;
  return { data, fieldErrors: [], hasFieldErrors: false, message: null };
}

/**
 * Fetch full workflow run detail (includes events, stage_durations).
 *
 * Backend: GET /api/workflows/{run_id}
 * Returns SingleEnvelope<WorkflowRunDetail>.
 */
export async function getWorkflowRunDetail(
  runId: string,
): Promise<SingleEnvelope<WorkflowRunDetail>> {
  return apiFetch<SingleEnvelope<WorkflowRunDetail>>(
    `/workflows/${encodeURIComponent(runId)}`,
    { method: "GET" },
  );
}

/**
 * Transition the external research task status.
 *
 * Backend: PATCH /api/workflows/{run_id}/external-research/task
 * Body: PatchTaskStatusBody
 * Returns the updated ExternalResearchTaskRow.
 */
export async function patchResearchTaskStatus(
  runId: string,
  body: PatchTaskStatusBody,
): Promise<ExternalResearchTaskRow> {
  return apiFetch<ExternalResearchTaskRow>(
    `/workflows/${encodeURIComponent(runId)}/external-research/task`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

/**
 * Upload an external research result as JSON.
 *
 * Backend: POST /api/workflows/{run_id}/external-research/result
 * Accepts application/json body: { content, content_type?, filename? }
 * Returns UploadResultResponse.
 */
export async function uploadResearchResultJson(
  runId: string,
  body: UploadResultJsonBody,
): Promise<UploadResultResponse> {
  return apiFetch<UploadResultResponse>(
    `/workflows/${encodeURIComponent(runId)}/external-research/result`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

/**
 * Upload an external research result as a multipart file.
 *
 * Backend: POST /api/workflows/{run_id}/external-research/result
 * Accepts multipart/form-data with file= field.
 * Returns UploadResultResponse.
 *
 * NOTE: Do NOT set Content-Type header manually; fetch sets it with boundary.
 */
export async function uploadResearchResultFile(
  runId: string,
  file: File,
): Promise<UploadResultResponse> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<UploadResultResponse>(
    `/workflows/${encodeURIComponent(runId)}/external-research/result`,
    {
      method: "POST",
      body: form,
    },
  );
}

// ---------------------------------------------------------------------------
// v1.7 aggregate API additions — appended to avoid modifying existing exports
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ArtifactMetadataCard + ArtifactCard (shared card types for research surfaces)
// ---------------------------------------------------------------------------

/**
 * Lens Badge metadata sub-object embedded in artifact cards.
 */
export interface ArtifactMetadataCard {
  fidelity: string | null;
  freshness: string | null;
  verification_state: string | null;
}

/**
 * Minimal artifact card projection returned by research list endpoints.
 * Mirrors backend ArtifactCard from portal.api.schemas.core.
 */
export interface ArtifactCard {
  id: string;
  workspace: string;
  type: string;
  subtype: string | null;
  title: string;
  status: string;
  schema_version: string | null;
  created: string | null;
  updated: string | null;
  file_path: string;
  metadata: ArtifactMetadataCard | null;
  priority: number | null;
}

// ---------------------------------------------------------------------------
// Topics (GET /api/topics)
// ---------------------------------------------------------------------------

/**
 * Topic artifact card with a computed priority score in [0, 1].
 * Returned by GET /api/topics.
 */
export interface TopicItem extends ArtifactCard {
  priority: number | null;
}

export interface TopicsEnvelope {
  data: TopicItem[];
  cursor: string | null;
  etag?: string | null;
}

/**
 * Fetch a cursor-paginated list of topic_note artifacts.
 *
 * Backend: GET /api/topics
 * Ordered by priority DESC, then updated DESC.
 *
 * Portal v1.7 Phase 4 (P4-01).
 */
export async function fetchTopics(options?: {
  limit?: number;
  cursor?: string;
}): Promise<TopicsEnvelope> {
  const query = new URLSearchParams();
  if (options?.limit !== undefined) query.set("limit", String(options.limit));
  if (options?.cursor) query.set("cursor", options.cursor);

  const qs = query.toString();
  const path = `/topics/${qs ? `?${qs}` : ""}`;

  return apiFetch<TopicsEnvelope>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Recent syntheses (GET /api/research/recent-syntheses)
// ---------------------------------------------------------------------------

/**
 * Synthesis artifact card for the research workspace recent-syntheses list.
 * Structurally identical to ArtifactCard; typed separately for clarity.
 */
export type RecentSynthesisItem = ArtifactCard;

export interface RecentSynthesesEnvelope {
  data: RecentSynthesisItem[];
  cursor: string | null;
  etag?: string | null;
}

/**
 * Fetch a cursor-paginated list of recently-updated synthesis artifacts.
 *
 * Backend: GET /api/research/recent-syntheses
 * Ordered by updated_at DESC. Optionally filtered by topic_id.
 *
 * Portal v1.7 Phase 4 (P4-01).
 */
export async function fetchRecentSyntheses(options?: {
  limit?: number;
  cursor?: string;
  topic_id?: string;
}): Promise<RecentSynthesesEnvelope> {
  const query = new URLSearchParams();
  if (options?.limit !== undefined) query.set("limit", String(options.limit));
  if (options?.cursor) query.set("cursor", options.cursor);
  if (options?.topic_id) query.set("topic_id", options.topic_id);

  const qs = query.toString();
  const path = `/research/recent-syntheses${qs ? `?${qs}` : ""}`;

  return apiFetch<RecentSynthesesEnvelope>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Evidence pulse — new (GET /api/research/evidence-pulse/new)
// ---------------------------------------------------------------------------

/**
 * Evidence artifact card for the research workspace evidence-pulse list.
 * Structurally identical to ArtifactCard; typed separately for clarity.
 */
export type EvidencePulseNewItem = ArtifactCard;

export interface EvidencePulseNewEnvelope {
  data: EvidencePulseNewItem[];
  cursor: string | null;
  etag?: string | null;
}

/**
 * Fetch cursor-paginated evidence artifacts created within the last N days.
 *
 * Backend: GET /api/research/evidence-pulse/new
 * Ordered by created_at DESC. days=0 returns an empty list immediately.
 * Optionally filtered by topic_id.
 *
 * Portal v1.7 Phase 4 (P4-01).
 */
export async function fetchEvidencePulseNew(options?: {
  days?: number;
  limit?: number;
  cursor?: string;
  topic_id?: string;
}): Promise<EvidencePulseNewEnvelope> {
  const query = new URLSearchParams();
  if (options?.days !== undefined) query.set("days", String(options.days));
  if (options?.limit !== undefined) query.set("limit", String(options.limit));
  if (options?.cursor) query.set("cursor", options.cursor);
  if (options?.topic_id) query.set("topic_id", options.topic_id);

  const qs = query.toString();
  const path = `/research/evidence-pulse/new${qs ? `?${qs}` : ""}`;

  return apiFetch<EvidencePulseNewEnvelope>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Workspace health (GET /api/research/workspace-health)
// ---------------------------------------------------------------------------

/**
 * Breakdown of artifact counts by lifecycle status.
 */
export interface ArtifactStatusBreakdown {
  draft: number;
  active: number;
  stale: number;
  archived: number;
}

/**
 * Distribution of artifacts across freshness bands.
 */
export interface FreshnessDistribution {
  current: number;
  stale: number;
  outdated: number;
}

/**
 * Aggregate health statistics for the research workspace.
 * Returned by GET /api/research/workspace-health.
 */
export interface WorkspaceHealthSummary {
  total_artifacts: number;
  by_status: ArtifactStatusBreakdown;
  freshness_distribution: FreshnessDistribution;
  contradiction_count: number;
  review_queue_depth: number;
}

export interface WorkspaceHealthEnvelope {
  data: WorkspaceHealthSummary;
  etag?: string | null;
}

/**
 * Fetch aggregate health statistics for the research workspace.
 *
 * Backend: GET /api/research/workspace-health
 * Returns a singleton WorkspaceHealthSummary (not a paginated list).
 *
 * Portal v1.7 Phase 4 (P4-01).
 */
export async function fetchWorkspaceHealth(): Promise<WorkspaceHealthEnvelope> {
  return apiFetch<WorkspaceHealthEnvelope>("/research/workspace-health", { method: "GET" });
}

// ---------------------------------------------------------------------------
// Priority topics (GET /api/research/priority-topics)
// ---------------------------------------------------------------------------

/**
 * Topic artifact card enriched with operator-control priority signals.
 * Returned by GET /api/research/priority-topics.
 */
export interface PriorityTopicItem extends ArtifactCard {
  priority_score: number;
  derivative_count: number;
  stale_count: number;
  contradiction_count: number;
}

export interface PriorityTopicEnvelope {
  data: PriorityTopicItem[];
  cursor: string | null;
  etag?: string | null;
}

/**
 * Fetch up to 20 topic_note artifacts ranked by composite priority score.
 *
 * Backend: GET /api/research/priority-topics
 * No cursor pagination — fixed limit of 20 per PRD.
 * Optionally filtered to a single topic via topic_id.
 *
 * Portal v1.7 Phase 4 (P4-01).
 */
export async function fetchPriorityTopics(options?: {
  limit?: number;
  topic_id?: string;
}): Promise<PriorityTopicEnvelope> {
  const query = new URLSearchParams();
  if (options?.limit !== undefined) query.set("limit", String(options.limit));
  if (options?.topic_id) query.set("topic_id", options.topic_id);

  const qs = query.toString();
  const path = `/research/priority-topics${qs ? `?${qs}` : ""}`;

  return apiFetch<PriorityTopicEnvelope>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Featured topics (GET /api/research/featured-topics)
// ---------------------------------------------------------------------------

/**
 * Topic artifact card with an activity score for featured-topic surfaces.
 * Returned by GET /api/research/featured-topics.
 */
export interface FeaturedTopicItem extends ArtifactCard {
  activity_score: number;
}

export interface FeaturedTopicsEnvelope {
  data: FeaturedTopicItem[];
  cursor: string | null;
  etag?: string | null;
}

/**
 * Fetch up to 8 topic_note artifacts ordered by recent derivative activity.
 *
 * Backend: GET /api/research/featured-topics
 * No cursor pagination — fixed limit of 8 per PRD.
 * activity_score is the count of recently-updated derivatives within the
 * given days window.
 *
 * Portal v1.7 Phase 4 (P4-01).
 */
export async function fetchFeaturedTopics(options?: {
  days?: number;
  limit?: number;
}): Promise<FeaturedTopicsEnvelope> {
  const query = new URLSearchParams();
  if (options?.days !== undefined) query.set("days", String(options.days));
  if (options?.limit !== undefined) query.set("limit", String(options.limit));

  const qs = query.toString();
  const path = `/research/featured-topics${qs ? `?${qs}` : ""}`;

  return apiFetch<FeaturedTopicsEnvelope>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Synthesis narrative (GET /api/research/synthesis-narrative)
// ---------------------------------------------------------------------------

/**
 * Minimal artifact reference embedded in SynthesisNarrativeSummary.
 */
export interface NarrativeArtifactRef {
  id: string;
  title: string;
}

/**
 * Corpus-level synthesis narrative summary.
 * Returned by GET /api/research/synthesis-narrative as a singleton.
 */
export interface SynthesisNarrativeSummary {
  total_syntheses: number;
  average_source_count: number;
  /** Fraction of active topics with at least one linked synthesis. [0, 1] */
  coverage_ratio: number;
  /** Most active topic; null when no syntheses exist. */
  most_active_topic: ArtifactCard | null;
  /** Most recently updated synthesis; null when no syntheses exist. */
  recent_synthesis: ArtifactCard | null;
}

export interface SynthesisNarrativeEnvelope {
  data: SynthesisNarrativeSummary;
  etag?: string | null;
}

/**
 * Fetch corpus-level synthesis narrative statistics.
 *
 * Backend: GET /api/research/synthesis-narrative
 * Returns a singleton SynthesisNarrativeSummary (not a paginated list).
 * An empty corpus returns a zeroed summary — never a 404.
 *
 * Portal v1.7 Phase 4 (P4-01).
 */
export async function fetchSynthesisNarrative(): Promise<SynthesisNarrativeEnvelope> {
  return apiFetch<SynthesisNarrativeEnvelope>("/research/synthesis-narrative", { method: "GET" });
}

// ---------------------------------------------------------------------------
// Cross-entity synthesis (GET /api/research/cross-entity-synthesis)
// ---------------------------------------------------------------------------

/**
 * One entry grouping synthesis artifacts by their associated entity.
 * Returned by GET /api/research/cross-entity-synthesis.
 */
export interface CrossEntitySynthesisEntry {
  entity: ArtifactCard;
  syntheses: ArtifactCard[];
}

export interface CrossEntitySynthesesEnvelope {
  data: CrossEntitySynthesisEntry[];
  cursor: string | null;
  etag?: string | null;
}

/**
 * Fetch cursor-paginated synthesis artifacts grouped by entity.
 *
 * Backend: GET /api/research/cross-entity-synthesis
 * Each entry contains an entity card and up to 5 syntheses (most-recently
 * updated first). Entities are sorted title ASC for stable pagination.
 * An empty corpus returns data: [] — never a 404.
 *
 * Portal v1.7 Phase 4 (P4-01).
 */
export async function fetchCrossEntitySynthesis(options?: {
  cursor?: string;
  limit?: number;
}): Promise<CrossEntitySynthesesEnvelope> {
  const query = new URLSearchParams();
  if (options?.cursor) query.set("cursor", options.cursor);
  if (options?.limit !== undefined) query.set("limit", String(options.limit));

  const qs = query.toString();
  const path = `/research/cross-entity-synthesis${qs ? `?${qs}` : ""}`;

  return apiFetch<CrossEntitySynthesesEnvelope>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Synthesis lineage (GET /api/artifacts/:id/synthesis-lineage)
// ---------------------------------------------------------------------------

/**
 * A single node in the synthesis lineage tree.
 */
export interface SynthesisLineageNode {
  artifact_id: string;
  artifact_type: string;
  title: string;
  depth: number;
  edge_type: string;
  children: SynthesisLineageNode[];
  next_sibling_cursor?: string | null;
}

/**
 * Root-level response for GET /api/artifacts/:id/synthesis-lineage.
 */
export interface SynthesisLineage {
  found: boolean;
  root: SynthesisLineageNode | null;
  /** Effective traversal depth (clamped to max 10). */
  depth: number;
  /** Total edge rows fetched by the CTE (diagnostic). */
  raw_edge_count: number;
}

export interface GetSynthesisLineageParams {
  /** Traversal depth (1–10, default 5). */
  depth?: number;
  /** Max siblings per parent node (default 50, max 200). */
  sibling_limit?: number;
  /** Opaque sibling cursor for paginating siblings at a given depth level. */
  sibling_cursor?: string | null;
}

/**
 * Fetch the synthesis lineage tree rooted at an artifact.
 *
 * Backend: GET /api/artifacts/{artifact_id}/synthesis-lineage
 *
 * Portal v1.7 Phase 3 (P3-01 / P3-09 / P3-10).
 */
export async function fetchSynthesisLineage(
  artifactId: string,
  params: GetSynthesisLineageParams = {},
): Promise<SynthesisLineage> {
  const { depth, sibling_limit, sibling_cursor } = params;

  const query = new URLSearchParams();
  if (depth !== undefined) query.set("depth", String(depth));
  if (sibling_limit !== undefined) query.set("sibling_limit", String(sibling_limit));
  if (sibling_cursor) query.set("sibling_cursor", sibling_cursor);

  const qs = query.toString();
  const path = `/artifacts/${encodeURIComponent(artifactId)}/synthesis-lineage${qs ? `?${qs}` : ""}`;

  return apiFetch<SynthesisLineage>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Evidence pulse — contradictions (GET /api/research/evidence-pulse/contradictions)
// ---------------------------------------------------------------------------

/**
 * A single detected contradiction between two evidence artifacts.
 * Named EvidenceContradictionPair to distinguish from ContradictionPair above.
 */
export interface EvidenceContradictionPair {
  artifact_a: ArtifactCard;
  artifact_b: ArtifactCard;
}

/**
 * Rolling 7-day trend for evidence-pulse contradiction counts.
 */
export interface EvidencePulseContradictionsTrend {
  last_7_days: number;
  prior_7_days: number;
}

/**
 * Response envelope item for the evidence-pulse contradictions endpoint.
 */
export interface EvidencePulseContradictionsResponse {
  contradictions: EvidenceContradictionPair[];
  total_count: number;
  trend: EvidencePulseContradictionsTrend;
}

export interface EvidencePulseContradictionsEnvelope {
  data: EvidencePulseContradictionsResponse[];
  cursor: string | null;
  etag?: string | null;
}

/**
 * Fetch cursor-paginated contradiction pairs with aggregate trend data.
 *
 * Backend: GET /api/research/evidence-pulse/contradictions
 *
 * Portal v1.7 Phase 4 (P4-01).
 */
export async function fetchEvidencePulseContradictions(options?: {
  limit?: number;
  cursor?: string;
}): Promise<EvidencePulseContradictionsEnvelope> {
  const query = new URLSearchParams();
  if (options?.limit !== undefined) query.set("limit", String(options.limit));
  if (options?.cursor) query.set("cursor", options.cursor);

  const qs = query.toString();
  const path = `/research/evidence-pulse/contradictions${qs ? `?${qs}` : ""}`;

  return apiFetch<EvidencePulseContradictionsEnvelope>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// fetchContradictions alias — re-exports getContradictions under the fetch* name
// ---------------------------------------------------------------------------

/** Alias for getContradictions — exposes the fetch* naming convention. */
export { getContradictions as fetchContradictions };
