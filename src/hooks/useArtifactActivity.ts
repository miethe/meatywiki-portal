"use client";

/**
 * useArtifactActivity — fetch activity entries for a single artifact.
 *
 * Attempts GET /api/artifacts/:id/activity. If the endpoint is absent
 * (404 or ECONNREFUSED) or not yet wired, falls back to deterministic
 * mock fixture data so the inline Activity Timeline (P4-04) always renders.
 *
 * **Mock fallback is intentional per phase-4 plan Notes section:**
 * "If `/api/artifact/{id}/activity` endpoint missing, mock with fixture data
 *  for now. Wire real endpoint post-v1.5."
 *
 * The HistoryPanel in ContextRail (P4-03) renders a graceful empty state
 * instead of mocking — that decision is preserved; this hook is only used
 * by the inline body timeline (ActivityTimeline component).
 *
 * Data shape (activity entry):
 *   { id, actor: { name, avatar? }, action, timestamp, summary? }
 *
 * P4-04 — Handoff Chain + Activity Timeline.
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ActivityActor {
  name: string;
  /** Optional avatar URL. Falls back to initials when absent. */
  avatar?: string | null;
}

export interface ActivityEntry {
  id: string;
  actor: ActivityActor;
  action: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Optional mutation summary — collapsed by default, expandable. */
  summary?: string | null;
}

export interface ActivityResponse {
  id: string;
  activity: ActivityEntry[];
}

// ---------------------------------------------------------------------------
// Mock fixture factory
// Generates plausible entries seeded on the artifact ID so the UI is
// visually stable across re-renders and navigation.
// ---------------------------------------------------------------------------

function mockActivity(artifactId: string): ActivityEntry[] {
  // Deterministic seed from last 4 chars of artifact ID
  const seed = artifactId.slice(-4).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const actors: ActivityActor[] = [
    { name: "Nick Miethe" },
    { name: "System" },
    { name: "Compiler" },
  ];

  const actions = [
    { action: "made revisions", summary: "Updated section headings and added cross-references" },
    { action: "promoted to active", summary: "Promoted from Draft to Active status" },
    { action: "compiled successfully", summary: "Compilation pass completed — 0 lint warnings" },
    { action: "tagged artifact", summary: null },
    { action: "linked related artifact", summary: null },
  ];

  const now = Date.now();
  const entries: ActivityEntry[] = [];

  // Generate 2–4 entries
  const count = 2 + (seed % 3);
  for (let i = 0; i < count; i++) {
    const idx = (seed + i * 7) % actions.length;
    const actorIdx = (seed + i * 3) % actors.length;
    const hoursAgo = [2, 26, 72, 168][i] ?? 336;

    entries.push({
      id: `mock-${artifactId}-${i}`,
      actor: actors[actorIdx],
      action: actions[idx].action,
      timestamp: new Date(now - hoursAgo * 3_600_000).toISOString(),
      summary: actions[idx].summary,
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

async function fetchArtifactActivity(id: string): Promise<ActivityEntry[]> {
  try {
    const res = await apiFetch<ActivityResponse>(
      `/artifacts/${encodeURIComponent(id)}/activity`,
      { method: "GET" },
    );
    return res.activity ?? [];
  } catch (err) {
    // Graceful fallback: if endpoint is 404 (not yet shipped) or the request
    // fails for any reason, return mock fixture data.
    if (err instanceof ApiError && err.status === 404) {
      return mockActivity(id);
    }
    if (err instanceof ApiError && err.status === 405) {
      return mockActivity(id);
    }
    // Network / unexpected errors also fall back to mock in local-only context
    return mockActivity(id);
  }
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const artifactActivityQueryKey = (id: string) =>
  ["artifact", "activity", id] as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseArtifactActivityResult {
  activity: ActivityEntry[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch activity entries for an artifact.
 *
 * Falls back to deterministic mock data when the backend endpoint is absent
 * (404/405). This ensures the inline ActivityTimeline always renders.
 *
 * @param id Artifact UUID. Pass null/undefined to disable the query.
 */
export function useArtifactActivity(id: string | null | undefined): UseArtifactActivityResult {
  const { data, isLoading, isError, error, refetch } = useQuery<ActivityEntry[], Error>({
    queryKey: artifactActivityQueryKey(id ?? ""),
    queryFn: () => fetchArtifactActivity(id!),
    enabled: Boolean(id),
    staleTime: 60_000,  // 1 min — activity is less dynamic than artifact detail
    gcTime: 5 * 60_000,
    retry: false,
  });

  return {
    activity: data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
