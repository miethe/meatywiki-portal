"use client";

/**
 * InboxBatchCompileHeader — collapsible header for a batch of concurrent compiles.
 *
 * Shows "X of Y compiled" progress summary and an indeterminate progress bar
 * while the batch is in flight. Children (individual artifact rows) are
 * collapsible via an aria-expanded disclosure pattern matching PendingApprovalPanel.
 *
 * Keyboard: Enter/Space on the toggle button expands/collapses children.
 * Accessibility: aria-expanded, aria-controls, descriptive aria-label.
 */

import React, { useId, useState } from "react";
import { cn } from "@/lib/utils";
import type { CompileBatch } from "@/hooks/useCompileBatch";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InboxBatchCompileHeaderProps {
  /** Batch descriptor from useCompileBatch. */
  batch: CompileBatch;
  /** Individual artifact rows — rendered as collapsible children. */
  children: React.ReactNode;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InboxBatchCompileHeader({
  batch,
  children,
  className,
}: InboxBatchCompileHeaderProps) {
  const [expanded, setExpanded] = useState(true);
  const contentId = useId();

  const { completedCount, totalCount, allTerminal } = batch;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const statusLabel = allTerminal
    ? `${completedCount} of ${totalCount} compiled`
    : `${completedCount} of ${totalCount} compiled`;

  const ariaLabel = allTerminal
    ? `Batch compile complete — ${statusLabel}. ${expanded ? "Collapse" : "Expand"} batch rows.`
    : `Batch compile in progress — ${statusLabel}. ${expanded ? "Collapse" : "Expand"} batch rows.`;

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-testid="batch-compile-header"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header row                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
        {/* Status label */}
        <span
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            "min-w-0 flex-1 text-xs font-medium tabular-nums",
            allTerminal
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground",
          )}
          data-testid="batch-status-label"
        >
          {/* Animated dot — only while in-flight */}
          {!allTerminal && (
            <span className="relative mr-1.5 inline-flex size-1.5 shrink-0 align-middle">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
          )}
          {allTerminal && (
            <svg
              aria-hidden="true"
              className="mr-1 inline-block size-3 text-emerald-600 dark:text-emerald-400"
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
          {statusLabel}
        </span>

        {/* Expand/collapse toggle */}
        <button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded((v) => !v);
            }
          }}
          className={cn(
            "shrink-0 rounded p-1 text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        >
          <svg
            aria-hidden="true"
            className={cn(
              "size-3.5 transition-transform duration-200",
              expanded ? "rotate-0" : "-rotate-90",
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="m6 9 6 6 6-6"
            />
          </svg>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Progress bar — only while batch is in-flight                        */}
      {/* ------------------------------------------------------------------ */}
      {!allTerminal && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          aria-label={`Batch compile progress: ${progressPercent}%`}
          className="h-0.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Collapsible children (artifact rows)                               */}
      {/* ------------------------------------------------------------------ */}
      {expanded && (
        <div
          id={contentId}
          role="list"
          aria-label={`Batch compile artifacts — ${statusLabel}`}
          className="flex flex-col gap-2"
        >
          {children}
        </div>
      )}
    </div>
  );
}
