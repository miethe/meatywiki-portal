/**
 * Projects context-pack DTOs.
 *
 * Mirrors the Portal overlay-only Projects API:
 *   POST /api/projects/ -> { pack_id }
 *   GET /api/projects/ -> ServiceModeEnvelope<ContextPack>
 *   GET /api/projects/{pack_id} -> ContextPack
 *   GET /api/projects/{pack_id}/versions -> ServiceModeEnvelope<ContextPackVersion>
 */

export interface ContextPackCreateRequest {
  name: string;
  description?: string | null;
  artifact_ids: string[];
}

export interface ContextPackCreateResponse {
  pack_id: string;
}

export interface ContextPack {
  pack_id: string;
  name: string;
  description?: string | null;
  artifact_ids: string[];
  artifact_count: number;
  version: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ContextPackVersion {
  version: number;
  updated_at: string;
  description?: string | null;
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export interface ProjectMilestone {
  id: string;
  title: string;
  due_date: string | null;
  status: "open" | "done";
  created_at: string;
  updated_at: string;
}

export interface CreateMilestoneBody {
  title: string;
  due_date?: string | null;
}

export interface UpdateMilestoneBody {
  title?: string;
  due_date?: string | null;
  status?: "open" | "done";
}

// ---------------------------------------------------------------------------
// Attachments (P5-FE-003)
// ---------------------------------------------------------------------------

export interface ProjectAttachment {
  artifact_id: string;
  /** Display name of the attached artifact */
  name: string;
  /** artifact_type from the artifact row */
  type: string;
  /** ISO 8601 timestamp when the artifact was attached */
  attached_at: string;
}

// ---------------------------------------------------------------------------
// Decision links
// ---------------------------------------------------------------------------

export interface ProjectDecisionLink {
  id: string;
  decision_table_id: string;
  decision_table_name: string;
  linked_at: string;
}
