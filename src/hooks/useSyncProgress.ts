"use client";

/**
 * useSyncProgress — hook for streaming sync progress via SSE.
 *
 * Endpoint: POST /api/project-directories/{project_id}/sync
 *
 * The backend responds with an SSE stream emitting JSON-encoded SyncEvent
 * objects on each `data:` frame.  Each line is a JSON object with a `type`
 * discriminant matching SyncEventType.
 *
 * Design:
 *   - `startSync(projectId)` POST triggers the sync and returns a URL that
 *     the EventSource will connect to.  The backend uses a two-step dance:
 *     POST starts the job, then the same SSE endpoint streams progress.
 *     We call POST once (fire-and-forget), then open the EventSource to the
 *     streaming URL returned in the Location header (or the same endpoint).
 *   - Because native EventSource only supports GET, we POST first to start
 *     the job, then open a GET-based SSE stream on the same path using
 *     the existing `useSSE` hook pattern.  The backend queues the job on
 *     POST and streams from GET.  If the backend uses the same POST path for
 *     streaming (SSE on POST), we switch to a manual fetch-based reader.
 *   - We use a manual ReadableStream approach (fetch + getReader) so we can
 *     POST with auth cookie and still stream, avoiding EventSource's GET-only
 *     limitation.
 *
 * Returns:
 *   { startSync, events, status, isStreaming, error, reset }
 *
 * Traces: Cross-Project Knowledge Hub v2 / P5-01.
 */

import { useCallback, useRef, useState } from "react";
import { getApiBase } from "@/lib/api/config";
import type { SyncEvent } from "@/lib/api/project-directories";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncStatus = "idle" | "connecting" | "streaming" | "done" | "error";

export interface UseSyncProgressResult {
  /**
   * Initiate a sync for the given project directory.
   * Calling this while a sync is already in progress is a no-op.
   */
  startSync: (projectId: string) => void;
  /** Accumulated events from the current (or most recent) sync run. */
  events: SyncEvent[];
  /** High-level status of the sync stream. */
  status: SyncStatus;
  /** True while the stream is open. */
  isStreaming: boolean;
  /** Non-null when an error occurred. */
  error: string | null;
  /** Reset state to idle (clears events). */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// SSE line parser — each data: frame is a JSON-encoded SyncEvent
// ---------------------------------------------------------------------------

function parseSyncEvent(raw: string): SyncEvent | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith(":")) return null;
  // Handle "data: {...}" SSE lines
  const dataMatch = trimmed.match(/^data:\s*(.+)$/);
  const payload = dataMatch ? dataMatch[1] : trimmed;
  try {
    return JSON.parse(payload) as SyncEvent;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSyncProgress(): UseSyncProgressResult {
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to the AbortController so we can cancel on unmount or reset.
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setEvents([]);
    setStatus("idle");
    setError(null);
  }, []);

  const startSync = useCallback((projectId: string) => {
    // Don't start a second sync if one is already running.
    if (status === "connecting" || status === "streaming") return;

    // Cancel any lingering connection.
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setEvents([]);
    setError(null);
    setStatus("connecting");

    const url = `${getApiBase()}/project-directories/${encodeURIComponent(projectId)}/sync`;

    void (async () => {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          let detail = `HTTP ${response.status}`;
          try {
            const body = await response.json() as { detail?: string };
            if (body.detail) detail = body.detail;
          } catch {
            // ignore parse errors
          }
          throw new Error(detail);
        }

        if (!response.body) {
          throw new Error("No response body for SSE stream");
        }

        setStatus("streaming");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines from the buffer.
          const lines = buffer.split("\n");
          // Keep the last (potentially incomplete) line in the buffer.
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const event = parseSyncEvent(line);
            if (event) {
              setEvents((prev) => [...prev, event]);
              // Terminal events close the stream.
              if (event.type === "sync_completed" || event.type === "sync_error") {
                setStatus(event.type === "sync_completed" ? "done" : "error");
                if (event.type === "sync_error") {
                  setError(event.error ?? event.message ?? "Sync failed");
                }
                reader.cancel();
                return;
              }
            }
          }
        }

        // Stream ended without a terminal event — treat as done.
        setStatus("done");
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // Intentional cancellation — reset to idle.
          setStatus("idle");
          return;
        }
        setError(err instanceof Error ? err.message : "Sync request failed");
        setStatus("error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- status is intentionally not in deps (avoid loop)
  }, []);

  return {
    startSync,
    events,
    status,
    isStreaming: status === "connecting" || status === "streaming",
    error,
    reset,
  };
}
