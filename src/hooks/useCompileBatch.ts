"use client";

/**
 * useCompileBatch — group concurrent artifact compiles by a time-window heuristic.
 *
 * Grouping strategy: artifacts whose compile-start timestamps fall within
 * BATCH_WINDOW_MS of the earliest start in the candidate set are considered
 * part of the same batch. There is NO job_id or batch_id on the backend;
 * grouping is purely client-side, based on start-time proximity.
 *
 * Real-time: re-evaluates on every SSE event change (<100ms path).
 *
 * Usage:
 *   const { batch, isBatch } = useCompileBatch({ artifactIds, startTimes, terminalMap });
 *
 * Returns:
 *   - batch: null when <2 artifacts are in the same window (standalone mode).
 *   - isBatch: convenience boolean (batch !== null).
 */

import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Time window used to group concurrent compiles into a single batch. */
export const BATCH_WINDOW_MS = 5_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompileBatchEntry {
  artifactId: string;
  /** Epoch ms of the first compile SSE event (or the compile POST 202 ack). */
  startTimeMs: number;
  /** True once a terminal (completed or failed) event has arrived. */
  isTerminal: boolean;
  /** True when terminal status is "success". */
  isSuccess: boolean;
}

export interface CompileBatch {
  /** Artifact IDs that form this batch (≥2). */
  artifactIds: string[];
  /** How many have reached a terminal state. */
  completedCount: number;
  /** Total artifacts in this batch. */
  totalCount: number;
  /** True once ALL members have reached a terminal state. */
  allTerminal: boolean;
  /** Epoch ms of the earliest start in the batch. */
  windowStartMs: number;
}

export interface UseCompileBatchOptions {
  /** All candidate entries — one per currently-compiling artifact. */
  entries: CompileBatchEntry[];
}

export interface UseCompileBatchResult {
  /**
   * The detected batch, or null when fewer than 2 entries fall within the
   * BATCH_WINDOW_MS window (i.e. each artifact is standalone — no batch chrome).
   */
  batch: CompileBatch | null;
  /** Convenience: batch !== null. */
  isBatch: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCompileBatch({
  entries,
}: UseCompileBatchOptions): UseCompileBatchResult {
  const batch = useMemo<CompileBatch | null>(() => {
    if (entries.length < 2) return null;

    // Sort by start time to find the earliest candidate.
    const sorted = [...entries].sort((a, b) => a.startTimeMs - b.startTimeMs);
    const windowStart = sorted[0].startTimeMs;
    const windowEnd = windowStart + BATCH_WINDOW_MS;

    // Only include entries that started within the batch window.
    const inWindow = sorted.filter((e) => e.startTimeMs <= windowEnd);

    // Need ≥2 within the window to form a batch.
    if (inWindow.length < 2) return null;

    const completedCount = inWindow.filter((e) => e.isTerminal).length;
    const allTerminal = completedCount === inWindow.length;

    return {
      artifactIds: inWindow.map((e) => e.artifactId),
      completedCount,
      totalCount: inWindow.length,
      allTerminal,
      windowStartMs: windowStart,
    };
  }, [entries]);

  return { batch, isBatch: batch !== null };
}
