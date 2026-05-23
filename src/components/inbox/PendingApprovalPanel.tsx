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

import React, { useState, useCallback, useRef, useEffect, useMemo, useId } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PendingApprovalItem } from "@/components/inbox/PendingApprovalItem";
import { approveIntake, rejectIntake, scanInbox } from "@/lib/api/intake";
import type { IntakePendingItem } from "@/lib/api/intake";
import { useToast } from "@/hooks/use-toast";

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
// (Inline toast hooks removed — toast now dispatched via global useToast())
// ---------------------------------------------------------------------------

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
  /**
   * Optional info element rendered inline next to the "Pending Approval" label.
   * Accepts any ReactNode — typically an <InfoTooltip> icon. When undefined,
   * no extra element is rendered and existing callers are unaffected.
   */
  info?: React.ReactNode;
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
  info,
}: PendingApprovalPanelProps) {
  const [scanState, setScanState] = useState<"idle" | "scanning">("idle");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{
    current: number;
    total: number;
    action: "approve" | "reject";
    cancelled: boolean;
  } | null>(null);
  // P2-09 / F-14: per-item failure list surfaced in expandable section.
  const [bulkFailures, setBulkFailures] = useState<{ id: string; label: string }[]>([]);
  const [showFailures, setShowFailures] = useState(false);
  const failuresId = useId();
  // P2-09: cancellation signal ref — set to true when user hits "Cancel".
  const cancelBulkRef = useRef(false);
  const { add: showToast } = useToast();

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
      showToast({
        type: "success",
        message: `Scan complete: ${result.files_enqueued} file${result.files_enqueued !== 1 ? "s" : ""} enqueued`,
      });
      refetch();
    } catch {
      showToast({ type: "error", message: "Inbox scan failed. Please try again." });
    } finally {
      setScanState("idle");
    }
  }, [scanState, refetch, showToast]);

  /**
   * P2-09 / F-14: cancel bulk operation in progress.
   * Sets the cancellation signal so the in-flight loop stops before the next
   * item. Already-submitted requests are not aborted (network is in-flight);
   * only items not yet started are skipped.
   */
  const handleCancelBulk = useCallback(() => {
    cancelBulkRef.current = true;
  }, []);

  /**
   * Runs a bulk action (approve or reject) over the selected items.
   *
   * P2-09 / F-14 improvements over the original sequential loop:
   *   - Concurrency cap of 3 (BULK_CONCURRENCY): fan-out is bounded so we
   *     don't slam the server with N simultaneous requests, but also don't
   *     force fully sequential execution.
   *   - Cancel button: cancelBulkRef.current is checked before each new
   *     batch slot is filled. Already-started requests finish naturally.
   *   - Promise.allSettled semantics per batch: every item in the current
   *     concurrency window resolves before starting the next window.
   *   - Per-item failure list: failures are collected with display name so
   *     the user can see exactly which items failed.
   */
  const BULK_CONCURRENCY = 3;

  const runBulkAction = useCallback(
    async (action: "approve" | "reject") => {
      if (selectedIds.size === 0 || bulkProgress !== null) return;
      const ids = Array.from(selectedIds);
      const total = ids.length;
      cancelBulkRef.current = false;
      setBulkProgress({ current: 0, total, action, cancelled: false });
      setBulkFailures([]);
      setShowFailures(false);

      const fn = action === "approve" ? approveIntake : rejectIntake;
      const failures: { id: string; label: string }[] = [];
      let processed = 0;

      // Process in windows of BULK_CONCURRENCY
      for (let i = 0; i < ids.length; i += BULK_CONCURRENCY) {
        if (cancelBulkRef.current) break;

        const chunk = ids.slice(i, i + BULK_CONCURRENCY);
        const results = await Promise.allSettled(chunk.map((id) => fn(id)));

        for (let j = 0; j < chunk.length; j++) {
          const result = results[j];
          processed++;
          if (result.status === "rejected") {
            // Extract a readable label for the failure report.
            // Mirrors PendingApprovalItem.extractDisplayName priority.
            const matchItem = items.find((it) => it.run_id === chunk[j]);
            const label = matchItem
              ? (
                  (typeof matchItem.payload.original_filename === "string" && matchItem.payload.original_filename.trim())
                    ? matchItem.payload.original_filename.trim()
                    : (typeof matchItem.payload.url === "string" && matchItem.payload.url.trim())
                    ? matchItem.payload.url.trim()
                    : chunk[j].slice(0, 12)
                )
              : chunk[j].slice(0, 12);
            failures.push({ id: chunk[j], label });
          }
        }

        setBulkProgress((prev) =>
          prev ? { ...prev, current: processed, cancelled: cancelBulkRef.current } : null,
        );
      }

      const successCount = processed - failures.length;
      setBulkProgress(null);

      if (failures.length > 0) {
        setBulkFailures(failures);
        showToast({
          type: "error",
          message: `${action === "approve" ? "Approved" : "Rejected"} ${successCount}; ${failures.length} failed`,
          // Bulk failures need extra read time — 15s so the detail section can be reviewed
          duration: 15_000,
        });
      } else {
        showToast({
          type: "success",
          message: `${action === "approve" ? "Approved" : "Rejected"} ${successCount} item${successCount !== 1 ? "s" : ""}`,
        });
      }

      refetch();
      setSelectedIds(new Set());
    },
    [selectedIds, bulkProgress, showToast, refetch, items],
  );

  const handleBulkApprove = useCallback(() => runBulkAction("approve"), [runBulkAction]);
  const handleBulkReject = useCallback(() => runBulkAction("reject"), [runBulkAction]);

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
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Approval
              {info ?? null}
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

            {/* P2-09 / F-14: bulk progress indicator + cancel button */}
            {bulkProgress && (
              <>
                <span className="text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
                  {bulkProgress.action === "approve" ? "Approving" : "Rejecting"}{" "}
                  {bulkProgress.current} of {bulkProgress.total}
                  {bulkProgress.cancelled ? " (cancelling…)" : "…"}
                </span>
                {/* Cancel button — stops the loop before the next concurrency window */}
                {!bulkProgress.cancelled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Cancel bulk operation"
                    onClick={handleCancelBulk}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                )}
              </>
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
        {/* P2-09 / F-14: per-item bulk failure detail (expandable)          */}
        {/* Shown after a bulk operation completes with partial failures.     */}
        {/* ---------------------------------------------------------------- */}
        {bulkFailures.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-destructive">
                {bulkFailures.length} item{bulkFailures.length !== 1 ? "s" : ""} failed
              </span>
              <button
                type="button"
                aria-expanded={showFailures}
                aria-controls={failuresId}
                onClick={() => setShowFailures((v) => !v)}
                className={cn(
                  "shrink-0 text-[11px] font-medium text-destructive/80 underline-offset-2",
                  "hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                {showFailures ? "Hide details" : "Show details"}
              </button>
            </div>
            {showFailures && (
              <ul
                id={failuresId}
                role="list"
                aria-label="Failed items"
                className="mt-2 flex flex-col gap-1"
              >
                {bulkFailures.map(({ id, label }) => (
                  <li key={id} className="truncate text-destructive/80">
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </div>
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
                  tabIndex={-1}
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

      {/* Toast banners are rendered globally by <ToastRenderer> in root layout.
          Portal Global Toast Consolidation — F-13 full resolution. */}
    </>
  );
}
