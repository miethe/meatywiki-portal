/**
 * Project Directories API — typed wrappers for /api/project-directories/ CRUD.
 *
 * Backend endpoints (Phase 4 — Cross-Project Knowledge Hub):
 *   GET    /api/project-directories/        → { data: ProjectDirRead[] }
 *   POST   /api/project-directories/        → 201 ProjectDirRead
 *   PATCH  /api/project-directories/{id}    → 200 ProjectDirRead
 *   DELETE /api/project-directories/{id}    → 204
 *   POST   /api/project-directories/{id}/sync → SSE stream
 *
 * The SSE stream emits:
 *   sync_started | sync_file_checked | sync_file_updated | sync_completed | sync_error
 *
 * Traces: Cross-Project Knowledge Hub v2 / P5-01.
 */

import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectDirRead {
  id: string;
  path: string;
  project_id: string;
  workspace: string | null;
  patterns: string[];
  enabled: boolean;
  git_branch: string | null;
  auto_detected: boolean;
  artifact_count: number;
  last_synced_at: string | null;
}

export interface ProjectDirCreateRequest {
  path: string;
  project_id: string;
  workspace?: string | null;
  patterns?: string[];
  enabled?: boolean;
  git_branch?: string | null;
}

export interface ProjectDirUpdateRequest {
  path?: string;
  workspace?: string | null;
  patterns?: string[];
  enabled?: boolean;
  git_branch?: string | null;
}

export interface ListProjectDirsResponse {
  data: ProjectDirRead[];
}

// ---------------------------------------------------------------------------
// Sync SSE event types
// ---------------------------------------------------------------------------

export type SyncEventType =
  | "sync_started"
  | "sync_file_checked"
  | "sync_file_updated"
  | "sync_completed"
  | "sync_error";

export interface SyncEvent {
  type: SyncEventType;
  /** Relative file path (present on file-level events). */
  path?: string;
  /** Human-readable message (present on all events). */
  message?: string;
  /** Files checked so far (sync_completed). */
  files_checked?: number;
  /** Files updated (sync_completed). */
  files_updated?: number;
  /** Error detail (sync_error). */
  error?: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * GET /api/project-directories/
 * Returns all registered project directories.
 */
export async function listProjectDirs(): Promise<ProjectDirRead[]> {
  const resp = await apiFetch<ListProjectDirsResponse>("/project-directories/");
  return resp.data ?? [];
}

/**
 * POST /api/project-directories/
 * Registers a new project directory.
 */
export async function createProjectDir(
  body: ProjectDirCreateRequest,
): Promise<ProjectDirRead> {
  return apiFetch<ProjectDirRead>("/project-directories/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * PATCH /api/project-directories/{project_id}
 * Partially updates a project directory record.
 */
export async function updateProjectDir(
  projectId: string,
  body: ProjectDirUpdateRequest,
): Promise<ProjectDirRead> {
  return apiFetch<ProjectDirRead>(
    `/project-directories/${encodeURIComponent(projectId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

/**
 * DELETE /api/project-directories/{project_id}
 * Removes a project directory record.
 */
export async function deleteProjectDir(projectId: string): Promise<void> {
  await apiFetch<void>(
    `/project-directories/${encodeURIComponent(projectId)}`,
    { method: "DELETE" },
  );
}
