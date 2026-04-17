/**
 * Shared pure helpers for workflow stage-state derivation.
 *
 * Used by StageTracker (compact bar + timeline variants) and the
 * Active Workflows panel (P4-08). Kept pure (no React, no side-effects)
 * so that it is trivially testable.
 *
 * Design spec §7 (Stage Tracker compact / timeline); Phase 4 P4-07.
 */

import type { WorkflowRunStatus } from "@/types/artifact";
import type { SSEWorkflowEvent } from "@/lib/sse/types";

// ---------------------------------------------------------------------------
// Fixed 6-stage linear pipeline (P4-07 spec)
// ---------------------------------------------------------------------------

export const TIMELINE_STAGES = [
  "ingest_start",
  "classify",
  "extract",
  "compile",
  "lint",
  "complete",
] as const;

export type TimelineStageKey = (typeof TIMELINE_STAGES)[number];

export const TIMELINE_STAGE_LABELS: Record<TimelineStageKey, string> = {
  ingest_start: "Ingest",
  classify: "Classify",
  extract: "Extract",
  compile: "Compile",
  lint: "Lint",
  complete: "Complete",
};

// ---------------------------------------------------------------------------
// Per-stage state
// ---------------------------------------------------------------------------

export type StageState = "completed" | "active" | "upcoming" | "failed";

export interface StageInfo {
  key: TimelineStageKey;
  label: string;
  state: StageState;
  /** ISO-8601 timestamp of the last event touching this stage, if known. */
  lastEventAt: string | null;
}

// ---------------------------------------------------------------------------
// Template stages (variable per template — used by bar + full variants)
// ---------------------------------------------------------------------------

export const TEMPLATE_STAGES: Record<string, string[]> = {
  source_ingest_v1: ["Receive", "Parse", "Classify", "Index"],
  research_synthesis_v1: ["Scope", "Compile", "Extract", "Synthesise", "Lint"],
  lint_scope_v1: ["Scan", "Lint", "Report"],
  compile_v1: ["Classify", "Extract", "Compile", "Lint"],
};

export const DEFAULT_TEMPLATE_STAGES = ["Stage 1", "Stage 2", "Stage 3"];

// ---------------------------------------------------------------------------
// Derive per-stage state from a WorkflowRun + optional SSE events array
// ---------------------------------------------------------------------------

/**
 * Derive the display state of each fixed timeline stage given the current run
 * status and index, plus an optional SSE events array for timestamps.
 *
 * Pure function — memoize at call site if needed.
 */
export function deriveStageInfos(
  currentStageIdx: number,
  runStatus: WorkflowRunStatus,
  events?: SSEWorkflowEvent[] | null,
): StageInfo[] {
  return TIMELINE_STAGES.map((key, idx) => {
    const label = TIMELINE_STAGE_LABELS[key];
    const lastEventAt = resolveLastEventAt(key, events);

    let state: StageState;

    if (runStatus === "failed") {
      if (idx < currentStageIdx) {
        state = "completed";
      } else if (idx === currentStageIdx) {
        state = "failed";
      } else {
        state = "upcoming";
      }
    } else if (runStatus === "complete") {
      state = "completed";
    } else if (idx < currentStageIdx) {
      state = "completed";
    } else if (idx === currentStageIdx) {
      state = "active";
    } else {
      state = "upcoming";
    }

    return { key, label, state, lastEventAt };
  });
}

/**
 * Resolve the most recent event timestamp for a given stage key.
 * Matches on `stage` field across StageStartedEvent / StageProgressEvent /
 * StageCompletedEvent variants.
 */
function resolveLastEventAt(
  stageKey: string,
  events?: SSEWorkflowEvent[] | null,
): string | null {
  if (!events || events.length === 0) return null;

  let latest: string | null = null;

  for (const ev of events) {
    if ("stage" in ev && ev.stage === stageKey) {
      if (latest === null || ev.timestamp > latest) {
        latest = ev.timestamp;
      }
    }
  }

  return latest;
}

// ---------------------------------------------------------------------------
// Colour helpers shared by both tracker variants
// ---------------------------------------------------------------------------

export function stageCircleClass(state: StageState): string {
  switch (state) {
    case "completed":
      return "bg-emerald-500 dark:bg-emerald-400 border-emerald-500 dark:border-emerald-400";
    case "active":
      return "bg-blue-500 dark:bg-blue-400 border-blue-500 dark:border-blue-400 animate-pulse";
    case "failed":
      return "bg-red-500 dark:bg-red-400 border-red-500 dark:border-red-400";
    case "upcoming":
      return "bg-transparent border-muted-foreground/40";
  }
}

export function stageConnectorClass(state: StageState): string {
  return state === "completed"
    ? "bg-emerald-500 dark:bg-emerald-400"
    : "bg-muted-foreground/20";
}
