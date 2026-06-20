/**
 * Projects API wrappers.
 *
 * Portal v2 context packs are overlay-local records. Creation is synchronous:
 * POST /api/projects/ returns { pack_id }; callers can then fetch the pack and
 * version history from the overlay APIs.
 */

import { apiFetch } from "./client";
import type { ServiceModeEnvelope } from "@/types/artifact";
import type {
  ContextPack,
  ContextPackCreateRequest,
  ContextPackCreateResponse,
  ContextPackVersion,
  ProjectAttachment,
  ProjectMilestone,
  CreateMilestoneBody,
  UpdateMilestoneBody,
  ProjectDecisionLink,
} from "@/types/projects";

export interface ListContextPacksParams {
  limit?: number;
  cursor?: string | null;
  includeArchived?: boolean;
}

export interface ListContextPackVersionsParams {
  limit?: number;
  cursor?: string | null;
}

export async function createContextPack(
  body: ContextPackCreateRequest,
): Promise<ContextPackCreateResponse> {
  return apiFetch<ContextPackCreateResponse>("/projects/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listContextPacks(
  params: ListContextPacksParams = {},
): Promise<ServiceModeEnvelope<ContextPack>> {
  const { limit = 20, cursor, includeArchived = false } = params;
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  if (cursor) query.set("cursor", cursor);
  if (includeArchived) query.set("include_archived", "true");

  const qs = query.toString();
  return apiFetch<ServiceModeEnvelope<ContextPack>>(
    `/projects/${qs ? `?${qs}` : ""}`,
    { method: "GET" },
  );
}

export async function getContextPack(packId: string): Promise<ContextPack> {
  return apiFetch<ContextPack>(`/projects/${encodeURIComponent(packId)}`, {
    method: "GET",
  });
}

export async function listContextPackVersions(
  packId: string,
  params: ListContextPackVersionsParams = {},
): Promise<ServiceModeEnvelope<ContextPackVersion>> {
  const { limit = 20, cursor } = params;
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  if (cursor) query.set("cursor", cursor);

  const qs = query.toString();
  return apiFetch<ServiceModeEnvelope<ContextPackVersion>>(
    `/projects/${encodeURIComponent(packId)}/versions${qs ? `?${qs}` : ""}`,
    { method: "GET" },
  );
}

// ---------------------------------------------------------------------------
// Attachments API (P5-FE-003)
// ---------------------------------------------------------------------------

export interface ListProjectAttachmentsParams {
  limit?: number;
  cursor?: string | null;
}

export async function listProjectAttachments(
  projectId: string,
  params: ListProjectAttachmentsParams = {},
): Promise<ServiceModeEnvelope<ProjectAttachment>> {
  const { limit = 20, cursor } = params;
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  if (cursor) query.set("cursor", cursor);

  const qs = query.toString();
  return apiFetch<ServiceModeEnvelope<ProjectAttachment>>(
    `/projects/${encodeURIComponent(projectId)}/attachments${qs ? `?${qs}` : ""}`,
    { method: "GET" },
  );
}

export async function attachArtifactToProject(
  projectId: string,
  artifactId: string,
): Promise<ProjectAttachment> {
  return apiFetch<ProjectAttachment>(
    `/projects/${encodeURIComponent(projectId)}/attachments`,
    {
      method: "POST",
      body: JSON.stringify({ artifact_id: artifactId }),
    },
  );
}

export async function detachArtifactFromProject(
  projectId: string,
  artifactId: string,
): Promise<void> {
  return apiFetch<void>(
    `/projects/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(artifactId)}`,
    { method: "DELETE" },
  );
}

// ---------------------------------------------------------------------------
// Milestones API
// ---------------------------------------------------------------------------

export async function listMilestones(
  projectId: string,
): Promise<ServiceModeEnvelope<ProjectMilestone>> {
  return apiFetch<ServiceModeEnvelope<ProjectMilestone>>(
    `/projects/${encodeURIComponent(projectId)}/milestones/`,
    { method: "GET" },
  );
}

export async function createMilestone(
  projectId: string,
  body: CreateMilestoneBody,
): Promise<ProjectMilestone> {
  return apiFetch<ProjectMilestone>(
    `/projects/${encodeURIComponent(projectId)}/milestones/`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function updateMilestone(
  projectId: string,
  milestoneId: string,
  body: UpdateMilestoneBody,
): Promise<ProjectMilestone> {
  return apiFetch<ProjectMilestone>(
    `/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export async function deleteMilestone(
  projectId: string,
  milestoneId: string,
): Promise<void> {
  return apiFetch<void>(
    `/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`,
    { method: "DELETE" },
  );
}

// ---------------------------------------------------------------------------
// Decision links API
// ---------------------------------------------------------------------------

export async function listProjectDecisions(
  projectId: string,
): Promise<ServiceModeEnvelope<ProjectDecisionLink>> {
  return apiFetch<ServiceModeEnvelope<ProjectDecisionLink>>(
    `/projects/${encodeURIComponent(projectId)}/decisions/`,
    { method: "GET" },
  );
}

export async function linkDecisionToProject(
  projectId: string,
  decisionId: string,
): Promise<ProjectDecisionLink> {
  return apiFetch<ProjectDecisionLink>(
    `/projects/${encodeURIComponent(projectId)}/decisions/`,
    { method: "POST", body: JSON.stringify({ decision_id: decisionId }) },
  );
}

export async function unlinkDecisionFromProject(
  projectId: string,
  linkId: string,
): Promise<void> {
  return apiFetch<void>(
    `/projects/${encodeURIComponent(projectId)}/decisions/${encodeURIComponent(linkId)}`,
    { method: "DELETE" },
  );
}

// ---------------------------------------------------------------------------
// Project merge API (Portal v2.6 P2-04)
// ---------------------------------------------------------------------------

/**
 * Request body for POST /api/projects/{pack_id}/merge.
 *
 * ``target_pack_id`` is the project that will absorb the source.
 * ``final_name`` is an optional override for the surviving project's name;
 * when omitted, the backend keeps the target's existing name.
 * ``delete_source`` controls whether the source project is deleted after merge
 * (defaults to true on the backend when omitted).
 */
export interface MergeProjectRequest {
  target_pack_id: string;
  final_name?: string;
  delete_source?: boolean;
}

/**
 * Response body for POST /api/projects/{pack_id}/merge.
 *
 * ``surviving_pack_id`` is the ID of the project that remains after the merge.
 * ``absorbed_artifact_count`` is the number of artifact attachments that were
 * migrated from the source to the surviving project.
 */
export interface MergeProjectResponse {
  surviving_pack_id: string;
  absorbed_artifact_count: number;
}

/**
 * Merge one project into another.
 *
 * Calls POST /api/projects/{pack_id}/merge with the given body. The source
 * project (``packId``) is merged into ``body.target_pack_id``. All artifact
 * attachments from the source are re-linked to the target before the source
 * is optionally deleted.
 *
 * Returns a MergeProjectResponse with the surviving project ID and the count
 * of attachments moved.
 *
 * Throws ApiError on:
 *   - 404 — source or target project not found
 *   - 409 — source and target are the same project
 *   - 422 — validation failure (e.g. invalid target_pack_id format)
 *
 * Portal v2.6 Phase 2 (P2-04 data layer).
 */
export async function mergeProject(
  packId: string,
  body: MergeProjectRequest,
): Promise<MergeProjectResponse> {
  return apiFetch<MergeProjectResponse>(
    `/projects/${encodeURIComponent(packId)}/merge`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

// ---------------------------------------------------------------------------
// Project delete API (Portal v2.6 P4-01)
// ---------------------------------------------------------------------------

/**
 * Delete a project (context pack) by ID.
 *
 * Calls DELETE /api/projects/{pack_id}. This is a destructive operation;
 * the project and all its overlay records (attachments, milestones, decisions)
 * are removed. Vault artifacts are NOT deleted — only the project envelope.
 *
 * Throws ApiError on:
 *   - 404 — project not found
 *   - 422 — validation failure
 *
 * Portal v2.6 Phase 4 (P4-01 action bar).
 */
export async function deleteProject(packId: string): Promise<void> {
  return apiFetch<void>(
    `/projects/${encodeURIComponent(packId)}`,
    { method: "DELETE" },
  );
}
