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

/**
 * Alias for ``getContradictions`` — exposes the ``fetch*`` naming convention
 * used in Phase 3 component wiring (P3-02).
 *
 * Backend: GET /api/artifacts/research/contradictions
 * Throws ``ApiError`` on HTTP errors.
 *
 * Portal v1.7 Phase 3 (P3-01 / P3-02).
 */
export { getContradictions as fetchContradictions };

// ---------------------------------------------------------------------------
// Synthesis lineage (Portal v1.6 P2-03 / v1.7 P3-01 / P3-09)
// ---------------------------------------------------------------------------

/**
 * A single node in the synthesis lineage tree.
 *
 * ``children`` is recursively typed — the full nested tree is returned in one
 * response. ``next_sibling_cursor`` is present only when more siblings exist
 * beyond the default page size (50 siblings per parent node).
 *
 * Mirrors backend LineageNode from portal.db.lineage (Portal v1.6 P2-03).
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
 *
 * ``root`` is the queried artifact itself; its ``children`` list holds the
 * first level of the lineage tree. ``found`` is false when the artifact is
 * not in the overlay (root will be null in that case).
 *
 * Mirrors backend LineageTree from portal.db.lineage (Portal v1.6 P2-03).
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
 * Traverses ``derived_from`` and ``generated_by`` edges up to ``depth``
 * levels deep via a single recursive CTE round-trip.
 *
 * Returns a ``SynthesisLineage`` with ``found=false`` when the artifact is
 * not in the overlay. Throws ``ApiError`` with status 404 on other lookup
 * failures.
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
// P4-01: Research aggregate API client functions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Topics (GET /api/topics)
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
 * Minimal artifact card projection returned by list endpoints.
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
 * Ordered by updated_at DESC, id DESC (most-recently updated first).
 * ``priority`` is computed per-page from derivative count and freshness score.
 *
 * Portal v1.7 Phase 4 (P4-01).
 */
export async function fetchTopics(options?: {
  limit?: number;
  cursor?: string;
  topic_id?: string;
}): Promise<TopicsEnvelope> {
  const query = new URLSearchParams();
  if (options?.limit !== undefined) query.set("limit", String(options.limit));
  if (options?.cursor) query.set("cursor", options.cursor);
  if (options?.topic_id) query.set("topic_id", options.topic_id);

  const qs = query.toString();
  const path = `/topics${qs ? `?${qs}` : ""}`;

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
 * Returns an ETag for conditional GET caching.
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

export interface PriorityTopicsEnvelope {
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
}): Promise<PriorityTopicsEnvelope> {
  const query = new URLSearchParams();
  if (options?.limit !== undefined) query.set("limit", String(options.limit));
  if (options?.topic_id) query.set("topic_id", options.topic_id);

  const qs = query.toString();
  const path = `/research/priority-topics${qs ? `?${qs}` : ""}`;

  return apiFetch<PriorityTopicsEnvelope>(path, { method: "GET" });
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
  /** ULID of the artifact. */
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

export interface CrossEntitySynthesisEnvelope {
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
}): Promise<CrossEntitySynthesisEnvelope> {
  const query = new URLSearchParams();
  if (options?.cursor) query.set("cursor", options.cursor);
  if (options?.limit !== undefined) query.set("limit", String(options.limit));

  const qs = query.toString();
  const path = `/research/cross-entity-synthesis${qs ? `?${qs}` : ""}`;

  return apiFetch<CrossEntitySynthesisEnvelope>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Evidence pulse — contradictions (GET /api/research/evidence-pulse/contradictions)
// ---------------------------------------------------------------------------

/**
 * A single detected contradiction between two evidence artifacts.
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
 * data[0] carries the current page of pairs plus corpus-level aggregates.
 */
export interface EvidencePulseContradictionsResponse {
  contradictions: EvidenceContradictionPair[];
  total_count: number;
  trend: EvidencePulseContradictionsTrend;
}

export interface EvidencePulseContradictionsEnvelope {
  /** Contains a single EvidencePulseContradictionsResponse per page. */
  data: EvidencePulseContradictionsResponse[];
  cursor: string | null;
  etag?: string | null;
}

/**
 * Fetch cursor-paginated contradiction pairs with aggregate trend data.
 *
 * Backend: GET /api/research/evidence-pulse/contradictions
 * data[0].total_count reflects the full corpus count.
 * data[0].trend provides the 7-day rolling delta for the pulse badge.
 * An empty corpus returns a zeroed response — never a 404.
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
