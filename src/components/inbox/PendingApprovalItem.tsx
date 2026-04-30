"use client";

/**
 * PendingApprovalItem — renders a single intake job awaiting approval.
 *
 * Displays the item's display name, artifact type badge, relative timestamp,
 * and optional file size. Approve and Reject buttons each own independent
 * loading state — only the clicked button shows a spinner while the other is
 * disabled. A fixed-position toast banner surfaces success and error outcomes.
 *
 * P2-01 (inbox approval UI).
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { approveIntake, rejectIntake } from "@/lib/api/intake";
import type { IntakePendingItem } from "@/lib/api/intake";

// ---------------------------------------------------------------------------
// Display name extraction
// ---------------------------------------------------------------------------

/**
 * Extract a human-readable label for the intake item.
 *
 * Priority: original_filename → url → first 12 chars of run_id.
 * Never throws — any error falls back to the run_id slice.
 */
function extractDisplayName(item: IntakePendingItem): string {
  try {
    if (
      typeof item.payload.original_filename === "string" &&
      item.payload.original_filename.trim()
    ) {
      return item.payload.original_filename.trim();
    }
    if (
      typeof item.payload.url === "string" &&
      item.payload.url.trim()
    ) {
      return item.payload.url.trim();
    }
  } catch {
    // intentional fallthrough
  }
  return item.run_id.slice(0, 12);
}

// ---------------------------------------------------------------------------
// Relative timestamp helper
// ---------------------------------------------------------------------------

/**
 * Format a creation timestamp as a short human-readable relative string.
 * e.g. "just now", "3 min ago", "2 hr ago", "4 days ago".
 */
function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    if (diffMs < 0) return "just now";

    const secs = Math.floor(diffMs / 1_000);
    if (secs < 60) return "just now";

    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} min ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// File size formatter
// ---------------------------------------------------------------------------

/**
 * Format raw byte count into a compact human-readable string.
 * e.g. 1_234_567 → "1.2 MB"
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

// ---------------------------------------------------------------------------
// Inline spinner
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Lightweight toast
// ---------------------------------------------------------------------------

type ToastKind = "success" | "error";

interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

let toastSeq = 0;

function useItemToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((kind: ToastKind, text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ id: ++toastSeq, kind, text });
    timerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, show };
}

interface ToastBannerProps {
  toast: ToastMessage;
}

function ToastBanner({ toast }: ToastBannerProps) {
  const isSuccess = toast.kind === "success";
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={toast.text}
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium shadow-lg",
        "transition-all duration-200",
        isSuccess
          ? "border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-950/80 dark:text-emerald-300"
          : "border-destructive/30 bg-destructive/5 text-destructive",
      )}
    >
      {isSuccess ? (
        // Checkmark circle
        <svg
          aria-hidden="true"
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
          />
        </svg>
      ) : (
        // X circle
        <svg
          aria-hidden="true"
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0 2-2m-2 2-2-2m2 2 2 2m7-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
          />
        </svg>
      )}
      <span>{toast.text}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PendingApprovalItemProps {
  item: IntakePendingItem;
  /** Called after a successful approve or reject to trigger a list refetch. */
  onActionComplete: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a single pending intake item with approve and reject actions.
 *
 * Each action button owns its own loading state. While one action is
 * in-flight the other button is disabled to prevent double-submission.
 * A fixed-position toast banner reports the outcome of each action.
 */
export function PendingApprovalItem({
  item,
  onActionComplete,
}: PendingApprovalItemProps) {
  const [approvingState, setApprovingState] = useState<"idle" | "loading">(
    "idle",
  );
  const [rejectingState, setRejectingState] = useState<"idle" | "loading">(
    "idle",
  );
  const { toast, show: showToast } = useItemToast();

  const displayName = extractDisplayName(item);
  const relativeTime = formatRelativeTime(item.created_at);

  const fileSizeBytes =
    typeof item.payload.file_size_bytes === "number"
      ? item.payload.file_size_bytes
      : null;

  const isAnyLoading =
    approvingState === "loading" || rejectingState === "loading";

  const handleApprove = async () => {
    if (isAnyLoading) return;
    setApprovingState("loading");
    try {
      await approveIntake(item.run_id);
      showToast("success", `Approved: ${displayName}`);
      onActionComplete();
    } catch {
      showToast("error", `Failed to approve: ${displayName}`);
    } finally {
      setApprovingState("idle");
    }
  };

  const handleReject = async () => {
    if (isAnyLoading) return;
    setRejectingState("loading");
    try {
      await rejectIntake(item.run_id);
      showToast("success", `Rejected: ${displayName}`);
      onActionComplete();
    } catch {
      showToast("error", `Failed to reject: ${displayName}`);
    } finally {
      setRejectingState("idle");
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex items-start gap-3 rounded-md border bg-card p-3",
          "transition-colors hover:bg-accent/30",
        )}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Left: metadata column                                             */}
        {/* ---------------------------------------------------------------- */}
        <div className="min-w-0 flex-1">
          {/* Badge row: artifact type + optional file size */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="font-mono text-[10px] uppercase tracking-wide"
            >
              {item.artifact_type}
            </Badge>
            {fileSizeBytes !== null && (
              <span className="text-[10px] text-muted-foreground">
                {formatFileSize(fileSizeBytes)}
              </span>
            )}
          </div>

          {/* Display name */}
          <p
            className="truncate text-sm font-medium leading-snug text-foreground"
            title={displayName}
          >
            {displayName}
          </p>

          {/* Relative timestamp */}
          {relativeTime && (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {relativeTime}
            </p>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Right: action buttons                                             */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Approve */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Approve ${displayName}`}
            aria-busy={approvingState === "loading"}
            disabled={isAnyLoading}
            onClick={handleApprove}
            className={cn(
              "h-7 gap-1.5 px-2.5 text-xs",
              approvingState === "loading"
                ? "cursor-not-allowed"
                : "hover:border-emerald-500/60 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400",
            )}
          >
            {approvingState === "loading" ? (
              <Spinner />
            ) : (
              <svg
                aria-hidden="true"
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="m5 13 4 4L19 7"
                />
              </svg>
            )}
            Approve
          </Button>

          {/* Reject */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Reject ${displayName}`}
            aria-busy={rejectingState === "loading"}
            disabled={isAnyLoading}
            onClick={handleReject}
            className={cn(
              "h-7 gap-1.5 px-2.5 text-xs",
              rejectingState === "loading"
                ? "cursor-not-allowed"
                : "hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive",
            )}
          >
            {rejectingState === "loading" ? (
              <Spinner />
            ) : (
              <svg
                aria-hidden="true"
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            )}
            Reject
          </Button>
        </div>
      </div>

      {/* Toast banner — fixed-position, auto-dismisses after 3 s */}
      {toast && <ToastBanner key={toast.id} toast={toast} />}
    </>
  );
}
