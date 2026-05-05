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
