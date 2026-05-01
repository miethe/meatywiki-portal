"use client";

/**
 * PendingApprovalPanel — section panel for intake jobs awaiting approval.
 *
 * Wraps a list of PendingApprovalItem components with:
 *   - A StatusGroupSection-style header ("PENDING APPROVAL" label + count pill)
 *   - A "Scan Inbox" button that triggers a manual inbox directory scan
 *   - An error banner (with Retry) when the polling fetch fails
 *   - A loading skeleton when the initial fetch is in-flight
 *   - The PendingApprovalItem list
 *
 * Data is passed in as props — this component does NOT call useInboxPending.
 * The parent (InboxClient or equivalent) is responsible for the count > 0 gate
 * and for calling the hook, then passing results down.
 *
 * P2-02 (inbox approval UI).
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PendingApprovalItem } from "@/components/inbox/PendingApprovalItem";
import { approveIntake, rejectIntake, scanInbox } from "@/lib/api/intake";
import type { IntakePendingItem } from "@/lib/api/intake";

// ---------------------------------------------------------------------------
// Inline spinner (mirrors PendingApprovalItem's Spinner)
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
// Lightweight toast (same pattern as PendingApprovalItem)
// ---------------------------------------------------------------------------

type ToastKind = "success" | "error";

interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

let panelToastSeq = 0;

function usePanelToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((kind: ToastKind, text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ id: ++panelToastSeq, kind, text });
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
// Loading skeleton
// ---------------------------------------------------------------------------

function PendingItemSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-start gap-3 rounded-md border bg-card p-3 animate-pulse"
    >
      <div className="min-w-0 flex-1 space-y-2">
        {/* Badge row */}
        <div className="flex gap-1.5">
          <div className="h-4 w-16 rounded-sm bg-muted" />
        </div>
        {/* Display name */}
        <div className="h-3.5 w-2/3 rounded bg-muted" />
        {/* Timestamp */}
        <div className="h-3 w-20 rounded bg-muted/60" />
      </div>
      {/* Action buttons placeholder */}
      <div className="flex shrink-0 gap-2">
        <div className="h-7 w-16 rounded-md bg-muted" />
        <div className="h-7 w-14 rounded-md bg-muted" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm"
    >
      <span className="text-destructive">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "shrink-0 text-xs font-medium text-destructive underline-offset-2",
          "hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Count pill — matches StatusGroupSection styling (normal urgency only)
// ---------------------------------------------------------------------------

function CountPill({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} item${count !== 1 ? "s" : ""}`}
      className={cn(
        "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5",
        "text-[11px] font-semibold leading-none tabular-nums",
        "bg-muted text-muted-foreground",
      )}
    >
      {count}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PendingApprovalPanelProps {
  items: IntakePendingItem[];
  count: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the "Pending Approval" inbox section.
 *
 * Displays a section header with count badge, a Scan Inbox action button,
 * and a list of PendingApprovalItem rows. Shows a loading skeleton on initial
 * load and an inline error banner (with Retry) if the polling fetch fails.
 *
 * The parent controls the count > 0 gate — this panel renders whatever it
 * receives. Data is passed in as props; the hook is called upstream.
 */
export function PendingApprovalPanel({
  items,
  count,
  isLoading,
  error,
  refetch,
}: PendingApprovalPanelProps) {
  const [scanState, setScanState] = useState<"idle" | "scanning">("idle");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{
    current: number;
    total: number;
    action: "approve" | "reject";
  } | null>(null);
  const { toast, show: showToast } = usePanelToast();

  /**
   * Ref for the section header element — used as the focus fallback when the
   * last pending item is optimistically removed from the list.
   */
  const headerRef = useRef<HTMLDivElement>(null);

  /**
   * Per-item focus refs.  For item at index i, focusRefs[i] holds a ref whose
   * `.current` points to the root div of the *next* item (i + 1), or the panel
   * header when i is the last item.  These are rebuilt whenever the item array
   * changes identity so they always reflect the current ordering.
   *
   * We store an array of stable ref objects; the actual `.current` values are
   * assigned in the render loop below.
   */
  const focusRefs = useMemo(
    () => items.map(() => React.createRef<HTMLElement | null>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.length],
  );

  // Reset selection when item list changes (e.g. after approve/reject/scan)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [items]);

  const toggleItem = useCallback((runId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(runId);
      } else {
        next.delete(runId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.run_id)));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length && items.length > 0) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [selectedIds.size, items, selectAll, deselectAll]);

  const handleScan = useCallback(async () => {
    if (scanState === "scanning") return;
    setScanState("scanning");
    try {
      const result = await scanInbox();
      showToast(
        "success",
        `Scan complete: ${result.files_enqueued} file${result.files_enqueued !== 1 ? "s" : ""} enqueued`,
      );
      refetch();
    } catch {
      showToast("error", "Inbox scan failed. Please try again.");
    } finally {
      setScanState("idle");
    }
  }, [scanState, refetch, showToast]);

  const handleBulkApprove = useCallback(async () => {
    if (selectedIds.size === 0 || bulkProgress !== null) return;
    const ids = Array.from(selectedIds);
    const total = ids.length;
    setBulkProgress({ current: 0, total, action: "approve" });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < ids.length; i++) {
      setBulkProgress({ current: i + 1, total, action: "approve" });
      try {
        await approveIntake(ids[i]);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setBulkProgress(null);

    if (failCount === 0) {
      showToast("success", `Approved ${successCount} item${successCount !== 1 ? "s" : ""}`);
    } else {
      showToast("error", `Approved ${successCount}, failed ${failCount}`);
    }

    refetch();
    setSelectedIds(new Set());
  }, [selectedIds, bulkProgress, showToast, refetch]);

  const handleBulkReject = useCallback(async () => {
    if (selectedIds.size === 0 || bulkProgress !== null) return;
    const ids = Array.from(selectedIds);
    const total = ids.length;
    setBulkProgress({ current: 0, total, action: "reject" });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < ids.length; i++) {
      setBulkProgress({ current: i + 1, total, action: "reject" });
      try {
        await rejectIntake(ids[i]);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setBulkProgress(null);

    if (failCount === 0) {
      showToast("success", `Rejected ${successCount} item${successCount !== 1 ? "s" : ""}`);
    } else {
      showToast("error", `Rejected ${successCount}, failed ${failCount}`);
    }

    refetch();
    setSelectedIds(new Set());
  }, [selectedIds, bulkProgress, showToast, refetch]);

  const isScanning = scanState === "scanning";
  const showSkeleton = isLoading && items.length === 0;
  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;
  const hasSelection = selectedIds.size > 0;
  const isBulkBusy = bulkProgress !== null;
  const bulkApproving = bulkProgress?.action === "approve";
  const bulkRejecting = bulkProgress?.action === "reject";

  return (
    <>
      <section className="space-y-2">
        {/* ---------------------------------------------------------------- */}
        {/* Section header — matches StatusGroupSection layout exactly        */}
        {/* ---------------------------------------------------------------- */}
        <div ref={headerRef} tabIndex={-1} className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            {/* Select-all checkbox — only visible when there are items */}
            {items.length > 0 && (
              <Checkbox
                checked={allSelected}
                // Radix Checkbox doesn't support indeterminate via `checked`;
                // we use the data attribute via ref workaround by wrapping in a
                // native span with aria attributes instead.
                data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                disabled={isBulkBusy}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all pending items"
                aria-checked={someSelected ? "mixed" : allSelected}
                className={cn(someSelected && "opacity-60")}
              />
            )}
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Approval
            </span>
            <CountPill count={count} />
          </div>

          <div className="flex items-center gap-1.5">
            {/* Bulk action buttons — only visible when items are selected */}
            {hasSelection && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Approve ${selectedIds.size} selected item${selectedIds.size !== 1 ? "s" : ""}`}
                  aria-disabled={isBulkBusy}
                  aria-busy={bulkApproving}
                  disabled={isBulkBusy}
                  onClick={handleBulkApprove}
                  className={cn(
                    "h-7 gap-1.5 px-2.5 text-xs",
                    bulkApproving
                      ? "cursor-not-allowed"
                      : "hover:border-emerald-500/60 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400",
                  )}
                >
                  {bulkApproving ? (
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
                  Approve selected
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Reject ${selectedIds.size} selected item${selectedIds.size !== 1 ? "s" : ""}`}
                  aria-disabled={isBulkBusy}
                  aria-busy={bulkRejecting}
                  disabled={isBulkBusy}
                  onClick={handleBulkReject}
                  className={cn(
                    "h-7 gap-1.5 px-2.5 text-xs",
                    bulkRejecting
                      ? "cursor-not-allowed"
                      : "hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive",
                  )}
                >
                  {bulkRejecting ? (
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
                  Reject selected
                </Button>
              </>
            )}

            {/* Inline bulk progress indicator */}
            {bulkProgress && (
              <span className="text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
                {bulkProgress.action === "approve" ? "Approving" : "Rejecting"}{" "}
                {bulkProgress.current} of {bulkProgress.total}…
              </span>
            )}

            {/* Scan Inbox button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Scan inbox for new files"
              aria-disabled={isScanning || isBulkBusy}
              aria-busy={isScanning}
              disabled={isScanning || isBulkBusy}
              onClick={handleScan}
              className={cn(
                "h-7 gap-1.5 px-2.5 text-xs",
                isScanning ? "cursor-not-allowed" : "",
              )}
            >
              {isScanning ? (
                <Spinner />
              ) : (
                /* Refresh/scan icon */
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
              {isScanning ? "Scanning…" : "Scan Inbox"}
            </Button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Error banner                                                      */}
        {/* ---------------------------------------------------------------- */}
        {error && (
          <ErrorBanner
            message={error.message || "Failed to load pending items."}
            onRetry={refetch}
          />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Loading skeleton — only when initial fetch is in-flight           */}
        {/* ---------------------------------------------------------------- */}
        {showSkeleton && (
          <ul
            role="list"
            aria-label="Loading pending approval items"
            className="flex flex-col gap-2"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable id
              <li key={i}>
                <PendingItemSkeleton />
              </li>
            ))}
          </ul>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Item list                                                          */}
        {/* ---------------------------------------------------------------- */}
        {!showSkeleton && items.length > 0 && (
          <ul
            role="list"
            aria-label="Pending approval items"
            className="flex flex-col gap-2"
          >
            {items.map((item, index) => {
              // focusRefs[index] targets the NEXT item's <li> so keyboard
              // focus jumps forward after optimistic removal.  For the last
              // item it falls back to the section header (tabIndex={-1}).
              const nextRef = focusRefs[index + 1] ?? (headerRef as React.RefObject<HTMLElement | null>);
              return (
                <li
                  key={item.run_id}
                  ref={focusRefs[index] as React.RefObject<HTMLLIElement>}
                >
                  <PendingApprovalItem
                    item={item}
                    onActionComplete={refetch}
                    selected={selectedIds.has(item.run_id)}
                    onSelectionChange={toggleItem}
                    disabled={isBulkBusy}
                    focusTargetOnRemoveRef={nextRef}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Toast banner — fixed-position, auto-dismisses after 3 s */}
      {toast && <ToastBanner key={toast.id} toast={toast} />}
    </>
  );
}
