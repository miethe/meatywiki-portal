/**
 * Research Home API helpers — P5-05.
 *
 * Typed wrappers for the three Research Home backend endpoints shipped in P5-04:
 *   GET /api/research/runs?status=active|completed
 *   GET /api/research/artifacts?workspace_id=<slug>
 *   GET /api/research/packages
 *
 * Response shapes verified against:
 *   src/meatywiki/portal/api/research.py  WorkflowRunItem / ResearchArtifactItem / ResearchPackageItem
 *
 * TODO: regenerate from openapi once backend regen lands (post-P5 merge).
 */

import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Shared envelope type for all three paginated endpoints
// ---------------------------------------------------------------------------

export interface ResearchHomeEnvelope<T> {
  data: T[];
  cursor: string | null;
  etag?: string | null;
}

// ---------------------------------------------------------------------------
// WorkflowRunItem — GET /api/research/runs
// ---------------------------------------------------------------------------

/** Valid status-group filter values for listResearchRuns. */
export type ResearchRunStatusFilter = "active" | "completed";

/**
 * Single workflow run item from GET /api/research/runs.
 * Mirrors backend WorkflowRunItem (research.py).
 */
export interface WorkflowRunItem {
  run_id: string;
  template_id: string;
  /** WorkflowStatus value (e.g. "pending", "running", "complete", "failed"). */
  status: string;
  started_at: string | null;
  completed_at: string | null;
  summary: string | null;
  artifacts_count: number;
}

export interface ListResearchRunsParams {
  status: ResearchRunStatusFilter;
  cursor?: string | null;
  limit?: number;
}

/**
 * Fetch cursor-paginated workflow runs filtered by status group.
 *
 * Backend: GET /api/research/runs?status=active|completed
 * "active"    → pending / running / paused runs
 * "completed" → complete / failed / abandoned runs
 */
export async function listResearchRuns(
  params: ListResearchRunsParams,
): Promise<ResearchHomeEnvelope<WorkflowRunItem>> {
  const { status, cursor, limit = 20 } = params;

  const query = new URLSearchParams();
  query.set("status", status);
  query.set("limit", String(limit));
  if (cursor) query.set("cursor", cursor);

  return apiFetch<ResearchHomeEnvelope<WorkflowRunItem>>(
    `/research/runs?${query.toString()}`,
    { method: "GET" },
  );
}

// ---------------------------------------------------------------------------
// ResearchArtifactItem — GET /api/research/artifacts
// ---------------------------------------------------------------------------

/** Valid workspace_id values for listResearchArtifacts. */
export type ResearchWorkspaceSlug =
  | "inbox"
  | "library"
  | "research"
  | "blog"
  | "projects";

/**
 * Single research-derived artifact stub from GET /api/research/artifacts.
 * Mirrors backend ResearchArtifactItem (research.py).
 */
export interface ResearchArtifactItem {
  artifact_id: string;
  title: string;
  type: string;
  subtype: string | null;
  workspace: string;
  research_workflow_id: string | null;
  created_at: string | null;
}

export interface ListResearchArtifactsParams {
  workspace_id: ResearchWorkspaceSlug;
  cursor?: string | null;
  limit?: number;
}

/**
 * Fetch cursor-paginated research-derived artifacts for a workspace.
 *
 * Backend: GET /api/research/artifacts?workspace_id=<slug>
 * Filters to artifacts where research_origin=true in the given workspace.
 */
export async function listResearchArtifacts(
  params: ListResearchArtifactsParams,
): Promise<ResearchHomeEnvelope<ResearchArtifactItem>> {
  const { workspace_id, cursor, limit = 20 } = params;

  const query = new URLSearchParams();
  query.set("workspace_id", workspace_id);
  query.set("limit", String(limit));
  if (cursor) query.set("cursor", cursor);

  return apiFetch<ResearchHomeEnvelope<ResearchArtifactItem>>(
    `/research/artifacts?${query.toString()}`,
    { method: "GET" },
  );
}

// ---------------------------------------------------------------------------
// ResearchPackageItem — GET /api/research/packages
// ---------------------------------------------------------------------------

/**
 * Single research package item from GET /api/research/packages.
 * Mirrors backend ResearchPackageItem (research.py).
 */
export interface ResearchPackageItem {
  artifact_id: string;
  title: string;
  type: string;
  subtype: string | null;
  /** Count of artifacts derived from this package (derived-from edge count). */
  artifact_count: number;
  created_at: string | null;
}

export interface ListResearchPackagesParams {
  cursor?: string | null;
  limit?: number;
}

/**
 * Fetch cursor-paginated saved research packages.
 *
 * Backend: GET /api/research/packages
 * Filters to artifacts whose type or subtype is external_research_package.
 */
export async function listResearchPackages(
  params: ListResearchPackagesParams = {},
): Promise<ResearchHomeEnvelope<ResearchPackageItem>> {
  const { cursor, limit = 20 } = params;

  const query = new URLSearchParams();
  query.set("limit", String(limit));
  if (cursor) query.set("cursor", cursor);

  const qs = query.toString();
  return apiFetch<ResearchHomeEnvelope<ResearchPackageItem>>(
    `/research/packages${qs ? `?${qs}` : ""}`,
    { method: "GET" },
  );
}
