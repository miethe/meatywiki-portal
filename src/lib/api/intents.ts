/**
 * Intents API wrappers.
 *
 * Intent artifacts represent versioned planning entities with a hierarchy of
 * layers (root → domain → project → feature → cycle → daily → session).
 * Creation and revision flow through the backend engine via EngineAdapter;
 * the frontend uses these wrappers to read and write intent state.
 *
 * Endpoints:
 *   GET  /api/intents                    -> ServiceModeEnvelope<IntentDTO>
 *   GET  /api/intents/{art_id}           -> IntentDTO
 *   GET  /api/intents/{art_id}/versions  -> ServiceModeEnvelope<IntentDTO>
 *   POST /api/intents                    -> IntentMutationResponse
 *   POST /api/intents/{art_id}/revise    -> IntentMutationResponse
 */

import { apiFetch } from "./client";
import type { ServiceModeEnvelope } from "@/types/artifact";
import type {
  IntentDTO,
  ListIntentVersionsParams,
  ListIntentsParams,
  CreateIntentBody,
  ReviseIntentBody,
  IntentMutationResponse,
} from "@/types/intents";

export async function listIntents(
  params: ListIntentsParams = {},
): Promise<ServiceModeEnvelope<IntentDTO>> {
  const { limit = 20, cursor } = params;
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  if (cursor) query.set("cursor", cursor);

  const qs = query.toString();
  return apiFetch<ServiceModeEnvelope<IntentDTO>>(
    `/intents${qs ? `?${qs}` : ""}`,
    { method: "GET" },
  );
}

export async function getIntent(artId: string): Promise<IntentDTO> {
  return apiFetch<IntentDTO>(`/intents/${encodeURIComponent(artId)}`, {
    method: "GET",
  });
}

export async function listIntentVersions(
  artId: string,
  params: ListIntentVersionsParams = {},
): Promise<ServiceModeEnvelope<IntentDTO>> {
  const { limit = 20, cursor } = params;
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  if (cursor) query.set("cursor", cursor);

  const qs = query.toString();
  return apiFetch<ServiceModeEnvelope<IntentDTO>>(
    `/intents/${encodeURIComponent(artId)}/versions${qs ? `?${qs}` : ""}`,
    { method: "GET" },
  );
}

export async function createIntent(
  body: CreateIntentBody,
): Promise<IntentMutationResponse> {
  return apiFetch<IntentMutationResponse>("/intents", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function reviseIntent(
  artId: string,
  body: ReviseIntentBody,
): Promise<IntentMutationResponse> {
  return apiFetch<IntentMutationResponse>(
    `/intents/${encodeURIComponent(artId)}/revise`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
