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
 *
 * P3-01: "Related Artifacts" section — upstream/downstream relations rendered as
 * clickable chips. Gated by `isOpen` (same SSE pattern used by useCompileEvents).
 * Chips navigate to /artifact/{relation_artifact_id} via router.push.
 *
 * P3-02: Clickable stage rows — each row navigates to
 * /artifact/{artifactId}/compile/stages/{stage} with hover affordance and full
 * keyboard accessibility (focus ring, aria-label).
 */

import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useArtifactCompileActivity } from "@/hooks/useArtifactCompileActivity";
import { useCompileEvents } from "@/hooks/useCompileEvents";
import { useArtifactRelationships } from "@/hooks/useArtifactRelationships";
import type { Relation } from "@/hooks/useArtifactRelationships";
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
// Related Artifacts section (P3-01)
// ---------------------------------------------------------------------------

interface RelatedArtifactsSectionProps {
  upstream: Relation[];
  downstream: Relation[];
  isLoading: boolean;
  isError: boolean;
  onChipClick: () => void;
}

function RelatedArtifactsSection({
  upstream,
  downstream,
  isLoading,
  isError,
  onChipClick,
}: RelatedArtifactsSectionProps) {
  const hasRelations = upstream.length > 0 || downstream.length > 0;

  return (
    <div className="border-t px-3 py-2">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Related Artifacts
      </p>

      {isLoading ? (
        <p className="text-[11px] text-muted-foreground italic">Loading…</p>
      ) : isError ? (
        <p className="text-[11px] text-muted-foreground">— Unavailable</p>
      ) : !hasRelations ? (
        <p className="text-[11px] text-muted-foreground">No related artifacts</p>
      ) : (
        <div className="space-y-1.5">
          {upstream.length > 0 && (
            <RelationGroup
              label="Sources"
              relations={upstream}
              onChipClick={onChipClick}
            />
          )}
          {downstream.length > 0 && (
            <RelationGroup
              label="Derived"
              relations={downstream}
              onChipClick={onChipClick}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface RelationGroupProps {
  label: string;
  relations: Relation[];
  onChipClick: () => void;
}

function RelationGroup({ label, relations, onChipClick }: RelationGroupProps) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {relations.map((rel) => (
          <Link
            key={rel.artifact_id}
            href={`/artifact/${rel.artifact_id}`}
            onClick={onChipClick}
            title={rel.artifact_type ? `${rel.relationship} — ${rel.artifact_type}` : rel.relationship}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
              "text-[10px] font-medium text-foreground",
              "bg-secondary/50 hover:bg-secondary border-border/60",
              "transition-colors duration-100",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "max-w-[120px]",
            )}
          >
            <span className="truncate">{rel.title ?? "Untitled"}</span>
            <span className="shrink-0 text-muted-foreground opacity-70">
              ·{rel.relationship}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
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
  const router = useRouter();

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

  // P3-01: Relationships — only fetch while tooltip is open.
  const {
    upstream,
    downstream,
    isLoading: relsLoading,
    isError: relsError,
  } = useArtifactRelationships({
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
  const close = useCallback(() => setIsOpen(false), []);

  // Capped timeline: max 10 items (already limited by fetch).
  const showViewAll =
    nextCursor !== null || items.length >= 10;

  // P3-02: navigate to stage detail on row click.
  const handleStageRowClick = useCallback(
    (stage: string) => {
      close();
      router.push(`/artifact/${artifactId}/compile/stages/${stage}`);
    },
    [artifactId, close, router],
  );

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
          data-testid="activity-history-tooltip"
          className={cn(
            // Positioning: above the trigger when near bottom, below otherwise.
            // Simple: use bottom-full + small offset, fallback via CSS if clipped.
            "absolute bottom-full left-0 z-50 mb-1.5",
            "w-72 rounded-md border bg-popover shadow-lg",
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

          {/* Timeline body — P3-02: rows are clickable */}
          <div className="max-h-48 overflow-y-auto px-3 py-2">
            {isLoading ? (
              <p className="py-2 text-center text-xs text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                No compile activity yet.
              </p>
            ) : (
              <ol aria-label="Compile stage timeline" className="space-y-1">
                {items.map((event) => {
                  const stageLabel = deriveStageLabel(event);
                  const timeAgo = formatTimeAgo(event.created_at);
                  const isSuccess =
                    event.stage === "terminal" && event.status === "completed";
                  const isFailure =
                    event.stage === "terminal" && event.status === "failed";
                  const statusIcon = isSuccess ? "✔" : isFailure ? "✖" : "·";
                  const humanStage = humaniseStageName(event.stage);

                  return (
                    <li key={event.id}>
                      {/* P3-02: entire row is a button navigating to stage detail */}
                      <button
                        type="button"
                        onClick={() => handleStageRowClick(event.stage)}
                        aria-label={`View ${humanStage} stage event log`}
                        className={cn(
                          "group w-full flex items-baseline gap-2 rounded px-1 py-0.5 text-xs",
                          "text-left cursor-pointer",
                          "hover:bg-accent hover:text-accent-foreground",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                          "transition-colors duration-100",
                        )}
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
                          <span
                            className={cn(
                              "text-muted-foreground",
                              "group-hover:underline group-hover:underline-offset-2",
                            )}
                          >
                            {stageLabel}
                          </span>
                        </span>
                        <time
                          dateTime={event.created_at}
                          className="shrink-0 text-[10px] text-muted-foreground"
                        >
                          {timeAgo}
                        </time>
                      </button>
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
                onClick={close}
              >
                View all activity
              </Link>
            </div>
          )}

          {/* P3-01: Related Artifacts section — below timeline, above footer */}
          <RelatedArtifactsSection
            upstream={upstream}
            downstream={downstream}
            isLoading={relsLoading}
            isError={relsError}
            onChipClick={close}
          />
        </div>
      )}
    </div>
  );
}
