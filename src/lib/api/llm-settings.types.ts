/**
 * LLM Settings DTOs — aligned with GET/POST/PATCH/PUT/DELETE
 * /api/portal/llm-settings/* backend responses.
 *
 * Rules:
 *   - No `any` types.
 *   - SecretKeyStatus has NO value field — secrets are write-only.
 *   - All errors share { code: LlmSettingsErrorCode; message: string; details? }.
 *   - Missing restart_required must default to false at the call site.
 *
 * Backend: src/meatywiki/portal/api/llm_settings.py (P0-P3 shipped @ 8c8d8c1c).
 */

import type { ServiceModeEnvelope } from "@/types/artifact";

// Re-export for convenience so callers can import everything from one place.
export type { ServiceModeEnvelope };

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export const LLM_SETTINGS_ERROR_CODES = [
  "PROFILE_NOT_FOUND",
  "PROFILE_ALREADY_ACTIVE",
  "RELOAD_IN_PROGRESS",
  "SECRET_KEY_FORBIDDEN",
  "CONFIG_INVALID",
  "PROVIDER_NOT_FOUND",
] as const;

export type LlmSettingsErrorCode = (typeof LLM_SETTINGS_ERROR_CODES)[number];

export interface LlmSettingsError {
  code: LlmSettingsErrorCode;
  message: string;
  details?: unknown;
}

// ---------------------------------------------------------------------------
// Profile types
// ---------------------------------------------------------------------------

/**
 * Lightweight summary of a named LLM provider profile.
 * Returned in both ActiveProfileResponse and the profiles list.
 */
export interface ProfileSummary {
  name: string;
  description?: string | null;
  provider?: string | null;
}

/**
 * Response for GET /profile and POST /profile.
 * Bare (not envelope-wrapped).
 */
export interface ActiveProfileResponse {
  active_profile: string | null;
  config: ProfileSummary | null;
}

// ---------------------------------------------------------------------------
// Model map types
// ---------------------------------------------------------------------------

/**
 * Per-purpose model assignment map.
 * Response for GET /models and PATCH /models. Bare (not envelope-wrapped).
 *
 * restart_required defaults to false when absent from the response.
 */
export interface ModelMapResponse {
  classify: string | null;
  extract: string | null;
  compile: string | null;
  query: string | null;
  lint: string | null;
  embed: string | null;
  /** True when the engine must be restarted for the change to take effect. */
  restart_required: boolean;
}

/**
 * Request body for PATCH /models.
 * All fields are optional — only changed purposes need to be sent.
 */
export type ModelMapPatchRequest = Partial<
  Omit<ModelMapResponse, "restart_required">
>;

// ---------------------------------------------------------------------------
// Provider types
// ---------------------------------------------------------------------------

/**
 * A configured LLM provider entry.
 * Returned by GET /providers (in envelope) and PUT /providers/{id} (bare).
 *
 * NOTE: api_key value is NEVER returned — only api_key_is_set is exposed.
 */
export interface ProviderRead {
  id: string;
  adapter: string;
  base_url: string | null;
  api_key_env: string | null;
  /** True when the referenced env var is non-empty at runtime. */
  api_key_is_set: boolean;
}

/**
 * Request body for PUT /providers/{id}.
 * Full replacement; all fields are required.
 */
export interface ProviderDescriptor {
  adapter: string;
  base_url?: string | null;
  api_key_env?: string | null;
}

// ---------------------------------------------------------------------------
// Secret types
// ---------------------------------------------------------------------------

/**
 * Status of a single secret key.
 * Returned inside ServiceModeEnvelope by GET /secrets.
 *
 * INVARIANT: NO value field — secrets are write-only. The frontend
 * must never display or persist a secret value.
 */
export interface SecretKeyStatus {
  key: string;
  is_set: boolean;
}

/**
 * Request body for PUT /secrets/{key}.
 */
export interface SecretPutRequest {
  value: string;
}

// ---------------------------------------------------------------------------
// Reload types
// ---------------------------------------------------------------------------

/**
 * Response for POST /reload. Bare (not envelope-wrapped).
 *
 * restart_required defaults to false when absent.
 */
export interface ReloadResponse {
  success: boolean;
  /** True when the engine needs a full process restart to apply changes. */
  restart_required: boolean;
  message: string;
  reloaded_at: string;
}
