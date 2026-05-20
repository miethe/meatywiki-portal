"use client";

/**
 * CompileStageIndicator — per-row compile progress display.
 *
 * Renders the current pipeline stage label with an animated dot.
 * On terminal success: shows "Done" briefly (3 s) then calls onDone so the
 * parent can unmount or hide the indicator.
 * On terminal failure: delegates rendering to CompileErrorPill via the parent
 * (this component shows nothing extra on error — the parent mounts the error pill).
 *
 * Designed to be minimal: a small inline element inside the card row's right
 * action area, not a modal or panel.
 */

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { WorkflowStageEventDTO, CompileTerminalState } from "@/types/compileEvents";

// ---------------------------------------------------------------------------
// Stage label map
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  classify:  "Classifying…",
  extract:   "Extracting…",
  compile:   "Compiling…",
  file_back: "Filing back…",
  lint:      "Linting…",
  terminal:  "Done",
};

function stageLabelFor(stage: string): string {
  return STAGE_LABELS[stage] ?? `${stage}…`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CompileStageIndicatorProps {
  /** All compile stage events received so far (ordered, deduped). */
  events: WorkflowStageEventDTO[];
  /** Set by parent once a terminal event arrives. */
  terminal: CompileTerminalState | null;
  /**
   * Called ~3 s after a successful terminal event so the parent can hide
   * the indicator row.  Not called on failure — the parent should show the
   * error pill instead.
   */
  onDone?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompileStageIndicator({
  events,
  terminal,
  onDone,
  className,
}: CompileStageIndicatorProps) {
  const [showDone, setShowDone] = useState(false);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine the current stage from the last non-terminal event.
  const currentStage = (() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.stage !== "terminal") return e.stage;
    }
    return null;
  })();

  // When terminal success arrives, briefly show "Done" then call onDone.
  useEffect(() => {
    if (terminal?.status === "success") {
      setShowDone(true);
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
      doneTimerRef.current = setTimeout(() => {
        onDone?.();
      }, 3000);
    }
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, [terminal, onDone]);

  // Don't render anything on failure — parent handles the error pill.
  if (terminal?.status === "error") return null;
  // Don't render if no events yet and not streaming.
  if (!currentStage && !showDone) return null;

  const label = showDone
    ? "Done"
    : currentStage
    ? stageLabelFor(currentStage)
    : "Starting…";

  return (
    <span
      aria-live="polite"
      aria-label={`Compile stage: ${label}`}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        showDone && "text-emerald-600 dark:text-emerald-400",
        className,
      )}
    >
      {/* Animated pulse dot — hidden on "Done" state */}
      {!showDone && (
        <span
          aria-hidden="true"
          className="relative inline-flex size-1.5 shrink-0"
        >
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
        </span>
      )}
      {showDone && (
        <svg
          aria-hidden="true"
          className="size-3 text-emerald-600 dark:text-emerald-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="m5 13 4 4L19 7"
          />
        </svg>
      )}
      <span>{label}</span>
    </span>
  );
}
