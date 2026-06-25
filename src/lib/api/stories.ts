/**
 * Stories API — typed wrappers for the op-story catalog endpoints.
 *
 * Endpoints:
 *   GET /api/stories                     — list stories (filtered, paginated)
 *   GET /api/stories/:story_id           — get story detail
 *
 * Collection routes have NO trailing slash (backend invariant).
 * Paths passed to apiFetch do NOT include the /api prefix — getApiBase() adds it.
 */

import { apiFetch } from "@/lib/api/client";
import type { StoriesEnvelope, StoryDetail, StoryFilters } from "@/types/stories";

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function listStories(filters: StoryFilters = {}): Promise<StoriesEnvelope> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.project) params.set("project", filters.project);
  if (filters.source_type) params.set("source_type", filters.source_type);
  if (filters.sensitivity) params.set("sensitivity", filters.sensitivity);
  if (filters.publication) params.set("publication", filters.publication);
  if (filters.q) params.set("q", filters.q);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.cursor) params.set("cursor", filters.cursor);
  const qs = params.toString();
  return apiFetch<StoriesEnvelope>(`/stories${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export function getStory(storyId: string): Promise<StoryDetail> {
  return apiFetch<StoryDetail>(`/stories/${encodeURIComponent(storyId)}`, {
    method: "GET",
  });
}
