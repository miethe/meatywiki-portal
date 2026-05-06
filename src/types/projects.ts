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
