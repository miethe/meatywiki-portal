"use client";

/**
 * CompileErrorPill — inline sticky error surface for compile failures.
 *
 * Shows the error code and human-readable message from the compile terminal
 * event's payload. Provides explicit Dismiss and Retry buttons.
 *
 * Anti-features (per spec):
 *   - No auto-dismiss timer (F-03 regression guard).
 *   - Does not replace or compete with the panel-scoped toast system (DI-067).
 *     This pill is an inline row component only.
 *
 * Accessibility: role="alert" so assistive technology announces the error
 * immediately when the component mounts.
 */

import React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CompileErrorPillProps {
  error: {
    code: string;
    message: string;
  };
  /** Called when the user clicks Retry. Parent should trigger a fresh compile POST. */
  onRetry: () => void;
  /** Called when the user clicks Dismiss. Parent should unmount this component. */
  onDismiss: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompileErrorPill({
  error,
  onRetry,
  onDismiss,
  className,
}: CompileErrorPillProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5",
        "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs",
        className,
      )}
    >
      {/* Error message */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-destructive">Compile failed</span>
        <span className="text-destructive/80">
          {error.message}
          {error.code !== "UNKNOWN" && (
            <span className="ml-1.5 font-mono opacity-60">[{error.code}]</span>
          )}
        </span>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry compilation"
          className={cn(
            "inline-flex h-6 items-center rounded border border-destructive/40 px-2",
            "text-xs font-medium text-destructive transition-colors",
            "hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss compile error"
          className={cn(
            "inline-flex h-6 items-center rounded px-2",
            "text-xs font-medium text-muted-foreground transition-colors",
            "hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
