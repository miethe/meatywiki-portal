"use client";

/**
 * ActivityHistoryTooltip — click/tap-to-open popover showing the compile stage
 * event timeline for a Library card.
 *
 * Design choices (P4-02 / P4-03):
 *
 * • Uses a controlled Popover pattern rather than shadcn Tooltip because:
 *     1. shadcn Tooltip is hover-only — doesn't open on tap/keyboard.
 *     2. The project has no @radix-ui/react-tooltip installed.
 *     3. A click-to-open Popover works for both desktop (click badge) and
 *        mobile (tap badge) with no primitive detection needed.
 *
 * • The trigger child (LibraryCardStatusBadge or any node) gets role="button"
 *   and keyboard handlers for Enter/Space so it is WCAG 2.1 AA keyboard-navigable.
 *
 * • P4-04 live updates: `isOpen` is passed as `enabled` to useCompileEvents so
 *   an SSE subscription is only opened while the tooltip is visible. While closed,
 *   the badge relies on stale-while-revalidate (30 s staleTime) + cache invalidation
 *   from InboxClient on terminal-success.
 *
 * • The popover closes on Escape, outside click, and focus loss (blur outside).
 *
 * Timeline entries are rendered newest-first (items come DESC from API).
 * Stage names are humanised: file_back → "file back", terminal/completed → "complete",
 * terminal/failed → "failed", others → as-is.
 *
 * "View all" link to /artifact/{id}?tab=activity renders when nextCursor is non-null
 * (more history exists) OR when items.length >= 10 (cap hint).
 */

import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useArtifactCompileActivity } from "@/hooks/useArtifactCompileActivity";
import { useCompileEvents } from "@/hooks/useCompileEvents";
import { useQueryClient } from "@tanstack/react-query";
import { artifactActivityQueryKey } from "@/lib/api/artifacts";
import type { WorkflowStageEventDTO } from "@/types/compileEvents";

// ---------------------------------------------------------------------------
// Stage name humanisation
// ---------------------------------------------------------------------------

function humaniseStageName(stage: string): string {
  const MAP: Record<string, string> = {
    classify: "classify",
    extract: "extract",
    compile: "compile",
    file_back: "file back",
    lint: "lint",
    terminal: "complete", // default — override with status below
  };
  return MAP[stage] ?? stage.replace(/_/g, " ");
}

function deriveStageLabel(event: WorkflowStageEventDTO): string {
  if (event.stage === "terminal") {
    return event.status === "completed" ? "complete" : "failed";
  }
  return humaniseStageName(event.stage);
}

// ---------------------------------------------------------------------------
// Time-ago helper
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
    return `${diffDays}d ago`;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ActivityHistoryTooltipProps {
  artifactId: string;
  /**
   * The badge or node that triggers the popover.
   * Rendered as the visible trigger element.
   */
  children: React.ReactNode;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityHistoryTooltip({
  artifactId,
  children,
  className,
}: ActivityHistoryTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const queryClient = useQueryClient();

  // Fetch compile activity — always enabled so badge is warm on mount.
  // When tooltip opens, we also enable the SSE stream (P4-04 Option A).
  const { items, nextCursor, isLoading } = useArtifactCompileActivity({
    artifactId,
    limit: 10,
    enabled: true,
  });

  // P4-04 Option A: SSE subscription gated by tooltip open state.
  // When a stage event arrives, invalidate the TanStack cache so timeline refreshes.
  const { latest: sseLatest } = useCompileEvents({
    artifactId,
    enabled: isOpen,
  });

  // On any new SSE event while open → invalidate activity cache.
  const prevSseLatest = useRef<WorkflowStageEventDTO | null>(null);
  useEffect(() => {
    if (sseLatest && sseLatest !== prevSseLatest.current) {
      prevSseLatest.current = sseLatest;
      void queryClient.invalidateQueries({
        queryKey: artifactActivityQueryKey(artifactId),
      });
    }
  }, [sseLatest, artifactId, queryClient]);

  // Close on outside click / focus outside.
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  // Capped timeline: max 10 items (already limited by fetch).
  const showViewAll =
    nextCursor !== null || items.length >= 10;

  return (
    <div className={cn("relative inline-flex", className)}>
      {/* Trigger: badge wrapper with button semantics */}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-label="Show compile activity history"
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className={cn(
          "inline-flex items-center focus:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
        )}
      >
        {children}
      </button>

      {/* Popover panel */}
      {isOpen && (
        <div
          id={popoverId}
          ref={popoverRef}
          role="dialog"
          aria-label="Compile activity history"
          className={cn(
            // Positioning: above the trigger when near bottom, below otherwise.
            // Simple: use bottom-full + small offset, fallback via CSS if clipped.
            "absolute bottom-full left-0 z-50 mb-1.5",
            "w-64 rounded-md border bg-popover shadow-lg",
            "text-popover-foreground",
            // Animate in
            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1 duration-100",
          )}
        >
          {/* Header */}
          <div className="border-b px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Compile history
            </p>
          </div>

          {/* Timeline body */}
          <div className="max-h-48 overflow-y-auto px-3 py-2">
            {isLoading ? (
              <p className="py-2 text-center text-xs text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                No compile activity yet.
              </p>
            ) : (
              <ol aria-label="Compile stage timeline" className="space-y-1.5">
                {items.map((event) => {
                  const stageLabel = deriveStageLabel(event);
                  const timeAgo = formatTimeAgo(event.created_at);
                  const isSuccess =
                    event.stage === "terminal" && event.status === "completed";
                  const isFailure =
                    event.stage === "terminal" && event.status === "failed";
                  const statusIcon = isSuccess ? "✔" : isFailure ? "✖" : "·";

                  return (
                    <li
                      key={event.id}
                      className="flex items-baseline gap-2 text-xs"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "shrink-0 font-semibold",
                          isSuccess && "text-emerald-600 dark:text-emerald-400",
                          isFailure && "text-red-600 dark:text-red-400",
                          !isSuccess && !isFailure && "text-muted-foreground",
                        )}
                      >
                        {statusIcon}
                      </span>
                      <span className="min-w-0 flex-1 text-foreground">
                        <span className="font-medium">compile</span>
                        <span className="mx-1 text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{stageLabel}</span>
                      </span>
                      <time
                        dateTime={event.created_at}
                        className="shrink-0 text-[10px] text-muted-foreground"
                      >
                        {timeAgo}
                      </time>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Footer — "view all" link */}
          {showViewAll && (
            <div className="border-t px-3 py-1.5">
              <Link
                href={`/artifact/${artifactId}?tab=activity`}
                className={cn(
                  "text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
                )}
                onClick={() => setIsOpen(false)}
              >
                View all activity
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
