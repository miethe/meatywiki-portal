"use client";

/**
 * useActiveWorkflowCount — lightweight hook for the top-bar badge.
 *
 * Fetches only active (pending | running) runs via GET /api/workflows/runs
 * and returns the count. Polls every 30 s to keep the badge reasonably fresh
 * without requiring a WebSocket or SSE just for the count.
 *
 * Intentionally separate from useWorkflowRuns — the header mounts on every
 * authenticated page; this hook must be minimal and not pull down the full
 * 24-hour run history.
 *
 * When the user navigates to /workflows, the full useWorkflowRuns hook there
 * provides richer data independently.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { listWorkflows } from "@/lib/api/workflows";

const POLL_INTERVAL_MS = 30_000;

export function useActiveWorkflowCount(): number {
  const [count, setCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = useCallback(async (): Promise<void> => {
    try {
      const envelope = await listWorkflows({
        status: ["running", "pending"],
        limit: 100,
      });
      setCount(envelope.data?.length ?? 0);
    } catch {
      // Fail silently — badge simply shows stale count (or 0 on first failure).
    }
  }, []);

  useEffect(() => {
    void fetchCount();

    timerRef.current = setInterval(() => {
      void fetchCount();
    }, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fetchCount]);

  return count;
}
