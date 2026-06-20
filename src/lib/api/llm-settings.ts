/**
 * LLM Settings API — typed wrappers for /api/portal/llm-settings/*.
 *
 * All 10 endpoints:
 *   1. getActiveProfile      — GET  /profile
 *   2. switchProfile         — POST /profile
 *   3. listProfiles          — GET  /profiles          (envelope → unwrapped)
 *   4. getModels             — GET  /models
 *   5. patchModels           — PATCH /models
 *   6. listProviders         — GET  /providers         (envelope → unwrapped)
 *   7. upsertProvider        — PUT  /providers/{id}
 *   8. listSecrets           — GET  /secrets           (envelope → unwrapped)
 *   9. putSecret             — PUT  /secrets/{key}     (204 → void)
 *  10. triggerReload         — POST /reload
 *
 * Conventions:
 *   - `api.get/post/patch/put` helpers from client.ts are used throughout.
 *   - List endpoints unwrap the ServiceModeEnvelope and return the `data` array.
 *   - putSecret returns void on 204 (apiFetch handles 204 → undefined).
 *   - Error body shape: { code: LlmSettingsErrorCode; message: string; details? }
 *     Callers can inspect ApiError.body to distinguish error codes.
 */

import { api, apiFetch } from "@/lib/api/client";
import type {
  ActiveProfileResponse,
  ModelMapPatchRequest,
  ModelMapResponse,
  ProfileSummary,
  ProviderDescriptor,
  ProviderRead,
  ReloadResponse,
  SecretKeyStatus,
  SecretPutRequest,
  ServiceModeEnvelope,
} from "./llm-settings.types";

const BASE = "/portal/llm-settings";

// ---------------------------------------------------------------------------
// 1. GET /profile → ActiveProfileResponse (bare)
// ---------------------------------------------------------------------------

export async function getActiveProfile(): Promise<ActiveProfileResponse> {
  return api.get<ActiveProfileResponse>(`${BASE}/profile`);
}

// ---------------------------------------------------------------------------
// 2. POST /profile → ActiveProfileResponse (bare)
//    Errors: 404 PROFILE_NOT_FOUND, 409 PROFILE_ALREADY_ACTIVE
// ---------------------------------------------------------------------------

export async function switchProfile(name: string): Promise<ActiveProfileResponse> {
  return api.post<ActiveProfileResponse>(`${BASE}/profile`, { name });
}

// ---------------------------------------------------------------------------
// 3. GET /profiles → ProfileSummary[] (envelope unwrapped)
// ---------------------------------------------------------------------------

export async function listProfiles(): Promise<ProfileSummary[]> {
  const envelope = await api.get<ServiceModeEnvelope<ProfileSummary>>(
    `${BASE}/profiles`,
  );
  return envelope.data;
}

// ---------------------------------------------------------------------------
// 4. GET /models → ModelMapResponse (bare)
//    restart_required defaults to false when absent.
// ---------------------------------------------------------------------------

export async function getModels(): Promise<ModelMapResponse> {
  const raw = await api.get<Partial<ModelMapResponse>>(`${BASE}/models`);
  return { restart_required: false, ...raw } as ModelMapResponse;
}

// ---------------------------------------------------------------------------
// 5. PATCH /models → ModelMapResponse (bare)
//    Error: 422 CONFIG_INVALID
//    restart_required defaults to false when absent.
// ---------------------------------------------------------------------------

export async function patchModels(
  body: ModelMapPatchRequest,
): Promise<ModelMapResponse> {
  const raw = await api.patch<Partial<ModelMapResponse>>(`${BASE}/models`, body);
  return { restart_required: false, ...raw } as ModelMapResponse;
}

// ---------------------------------------------------------------------------
// 6. GET /providers → ProviderRead[] (envelope unwrapped)
//    Note: api_key value is never returned; only api_key_is_set.
// ---------------------------------------------------------------------------

export async function listProviders(): Promise<ProviderRead[]> {
  const envelope = await api.get<ServiceModeEnvelope<ProviderRead>>(
    `${BASE}/providers`,
  );
  return envelope.data;
}

// ---------------------------------------------------------------------------
// 7. PUT /providers/{id} → ProviderRead (bare)
//    Error: 422 CONFIG_INVALID
// ---------------------------------------------------------------------------

export async function upsertProvider(
  id: string,
  body: ProviderDescriptor,
): Promise<ProviderRead> {
  return apiFetch<ProviderRead>(`${BASE}/providers/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// 8. GET /secrets → SecretKeyStatus[] (envelope unwrapped)
//    SecretKeyStatus has NO value field.
// ---------------------------------------------------------------------------

export async function listSecrets(): Promise<SecretKeyStatus[]> {
  const envelope = await api.get<ServiceModeEnvelope<SecretKeyStatus>>(
    `${BASE}/secrets`,
  );
  return envelope.data;
}

// ---------------------------------------------------------------------------
// 9. PUT /secrets/{key} → 204 No Content (void)
//    Errors: 403 SECRET_KEY_FORBIDDEN, 422 CONFIG_INVALID
// ---------------------------------------------------------------------------

export async function putSecret(key: string, value: string): Promise<void> {
  const body: SecretPutRequest = { value };
  await apiFetch<void>(`${BASE}/secrets/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// 10. POST /reload → ReloadResponse (bare)
//     Error: 409 RELOAD_IN_PROGRESS
//     restart_required defaults to false when absent.
// ---------------------------------------------------------------------------

export async function triggerReload(): Promise<ReloadResponse> {
  const raw = await api.post<Partial<ReloadResponse>>(`${BASE}/reload`, {});
  return { restart_required: false, ...raw } as ReloadResponse;
}
