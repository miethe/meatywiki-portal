"use client";

/**
 * LibraryCardStatusBadge — per-card compile status pill for the Library view.
 *
 * Fetches the most recent compile-workflow event for an artifact via
 * useArtifactCompileActivity and renders a concise status pill:
 *
 *   "Compiled 2h ago"  (terminal/completed)    → green/neutral tone
 *   "Compile failed"   (terminal/failed)        → red/destructive tone
 *   "Compiling…"       (non-terminal latest)    → neutral with pulse dot
 *   (hidden)           (no compile events)      → nothing rendered
 *
 * OQ-4 (resolved P4-01): badge shows most-recent COMPILE workflow event only.
 *
 * P4-04: lives inside ActivityHistoryTooltip so the tooltip open/close state
 * can gate the SSE subscription (enabled=isTooltipOpen) for live updates.
 * The badge itself only needs the cached result from useArtifactCompileActivity;
 * live SSE events invalidate that cache externally via invalidateActivityCache.
 */

import React from "react";
import { cn } from "@/lib/utils";
import { useArtifactCompileActivity } from "@/hooks/useArtifactCompileActivity";
import type { WorkflowStageEventDTO } from "@/types/compileEvents";

// ---------------------------------------------------------------------------
// Time-ago helper (inline — no extra dep; mirrors formatRelativeTime in ArtifactCard)
// ---------------------------------------------------------------------------

function formatTimeAgo(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Badge tone derivation
// ---------------------------------------------------------------------------

type BadgeTone = "success" | "error" | "in-progress";

function deriveTone(event: WorkflowStageEventDTO): BadgeTone {
  if (event.stage === "terminal") {
    return event.status === "completed" ? "success" : "error";
  }
  return "in-progress";
}

function deriveLabel(event: WorkflowStageEventDTO): string {
  const timeAgo = formatTimeAgo(event.created_at);
  if (event.stage === "terminal") {
    if (event.status === "completed") {
      return timeAgo ? `Compiled ${timeAgo}` : "Compiled";
    }
    return "Compile failed";
  }
  return "Compiling…"; // "Compiling…"
}

// ---------------------------------------------------------------------------
// Tone → Tailwind classes
// ---------------------------------------------------------------------------

const TONE_CLASSES: Record<BadgeTone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
  error:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
  "in-progress":
    "border-primary/20 bg-primary/5 text-primary dark:border-primary/30",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LibraryCardStatusBadgeProps {
  artifactId: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LibraryCardStatusBadge({
  artifactId,
  className,
}: LibraryCardStatusBadgeProps) {
  const { latestCompile, isLoading } = useArtifactCompileActivity({
    artifactId,
    limit: 10,
    enabled: true,
  });

  // Don't render anything while loading or when there are no compile events.
  if (isLoading || !latestCompile) return null;

  const tone = deriveTone(latestCompile);
  const label = deriveLabel(latestCompile);
  const isInProgress = tone === "in-progress";

  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5",
        "text-[10px] font-medium leading-none whitespace-nowrap",
        "select-none",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {/* Pulse dot for in-progress state */}
      {isInProgress && (
        <span aria-hidden="true" className="relative inline-flex size-1.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
        </span>
      )}
      <span>{label}</span>
    </span>
  );
}
