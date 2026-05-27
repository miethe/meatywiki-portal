"use client";

/**
 * ReconcileModal — vault-overlay drift inspection dialog.
 *
 * Opens as a full-screen dialog. On mount the user manually triggers a drift
 * check via "Check Drift". The flow is:
 *
 *   1. Initial state — "Check Drift" button idle.
 *   2. Loading — spinner while POST /api/vault/reconcile-check (dry_run=true) is in flight.
 *   3. No-drift — "Vault and overlay are in sync" success message.
 *   4. Drift found — summary counts (added/modified/deleted/unchanged) + optional
 *      per-file detail list (toggled with "Show Details" / re-fetch with ?detail=true).
 *   5. Apply — visible only when drift > 0; requires inline confirmation before
 *      calling POST with { dry_run: false, confirm: true }.
 *   6. Error — inline error message, retry available.
 *
 * Props: { open, onOpenChange } — follows the shadcn Dialog convention used
 * throughout the codebase (see RouteModal for reference).
 *
 * Keyboard:
 *   - Escape closes the dialog.
 *   - Tab / Shift+Tab cycles through focusable elements (focus trap).
 *
 * WCAG 2.1 AA:
 *   - role="dialog", aria-modal="true", aria-labelledby.
 *   - aria-live="polite" on the result region.
 *   - Focus trap while open; focus returns to trigger on close.
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  checkReconcileDrift,
  type ReconcileCheckResponse,
  type ReconcileDriftItem,
} from "@/lib/api/vault";

// ---------------------------------------------------------------------------
// Focus trap helper (mirrors RouteModal pattern)
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
  ).filter((el) => el.offsetParent !== null);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Pill showing a count for one drift category. */
function DriftCountPill({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "added" | "modified" | "deleted" | "unchanged";
}) {
  const colors: Record<typeof variant, string> = {
    added:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800",
    modified:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-800",
    deleted:
      "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-800",
    unchanged:
      "bg-muted text-muted-foreground ring-1 ring-border",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-lg px-4 py-2.5 min-w-[72px]",
        colors[variant],
      )}
    >
      <span className="text-xl font-bold tabular-nums leading-none">
        {count}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

/** Single drift item row in the expandable detail list. */
function DriftItemRow({ item }: { item: ReconcileDriftItem }) {
  const badgeColors: Record<ReconcileDriftItem["drift_type"], string> = {
    added:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    modified:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    deleted: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };

  return (
    <li className="flex items-start gap-3 px-4 py-2.5 odd:bg-muted/30">
      <span
        className={cn(
          "mt-px shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          badgeColors[item.drift_type],
        )}
      >
        {item.drift_type}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-snug">{item.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground font-mono">
          {item.artifact_id}
        </p>
        {item.diff_summary && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {item.diff_summary}
          </p>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ReconcileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PhaseState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "result"; data: ReconcileCheckResponse; showDetail: boolean; loadingDetail: boolean }
  | { phase: "confirm-apply" }
  | { phase: "applying" }
  | { phase: "applied" }
  | { phase: "error"; message: string };

export function ReconcileModal({ open, onOpenChange }: ReconcileModalProps) {
  const titleId = useId();
  const contentRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<PhaseState>({ phase: "idle" });

  // ---------------------------------------------------------------------------
  // Lifecycle: reset on open, scroll lock, keyboard
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (open) setState({ phase: "idle" });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  // Focus first button on open
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      const el = contentRef.current;
      if (!el) return;
      getFocusable(el)[0]?.focus();
    }, 50);
    return () => clearTimeout(id);
  }, [open]);

  // ---------------------------------------------------------------------------
  // Focus trap on Tab
  // ---------------------------------------------------------------------------

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const el = contentRef.current;
    if (!el) return;
    const focusable = getFocusable(el);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleCheck = useCallback(async () => {
    setState({ phase: "checking" });
    try {
      const data = await checkReconcileDrift({ dry_run: true, confirm: false });
      setState({ phase: "result", data, showDetail: false, loadingDetail: false });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Drift check failed. Please try again.";
      setState({ phase: "error", message });
    }
  }, []);

  const handleShowDetails = useCallback(async () => {
    if (state.phase !== "result") return;
    // If we already have detail data, just toggle the view off/on
    if (state.showDetail) {
      setState({ ...state, showDetail: false });
      return;
    }
    setState({ ...state, loadingDetail: true });
    try {
      const data = await checkReconcileDrift({ dry_run: true, confirm: false }, true);
      setState({ phase: "result", data, showDetail: true, loadingDetail: false });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load details.";
      setState({ phase: "error", message });
    }
  }, [state]);

  const handleRequestApply = useCallback(() => {
    setState({ phase: "confirm-apply" });
  }, []);

  const handleCancelApply = useCallback(() => {
    // Return to the previous result — re-run dry check to restore state cleanly
    void handleCheck();
  }, [handleCheck]);

  const handleApply = useCallback(async () => {
    setState({ phase: "applying" });
    try {
      await checkReconcileDrift({ dry_run: false, confirm: true });
      setState({ phase: "applied" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Apply failed. Please try again.";
      setState({ phase: "error", message });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Derived state helpers
  // ---------------------------------------------------------------------------

  const hasDrift = (data: ReconcileCheckResponse): boolean =>
    data.summary.added + data.summary.modified + data.summary.deleted > 0;

  // ---------------------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------------------

  if (!open) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative z-50 w-full max-w-lg overflow-hidden rounded-xl",
          "bg-background shadow-2xl ring-1 ring-border",
          "animate-in fade-in-0 zoom-in-95 duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ------------------------------------------------------------------ */}
        {/* Header                                                              */}
        {/* ------------------------------------------------------------------ */}

        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <RefreshCw
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            <h2
              id={titleId}
              className="text-sm font-semibold leading-none tracking-tight"
            >
              Vault reconciliation
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close reconcile dialog"
            onClick={handleClose}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground",
              "transition-colors hover:bg-muted hover:text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Body — state machine rendered content                               */}
        {/* ------------------------------------------------------------------ */}

        <div
          aria-live="polite"
          aria-atomic="false"
          className="min-h-[140px]"
        >
          {/* ---- Idle ---- */}
          {state.phase === "idle" && (
            <div className="flex flex-col items-center gap-4 px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground max-w-xs">
                Check whether the Postgres overlay is in sync with the vault.
                No changes will be made until you confirm.
              </p>
              <button
                type="button"
                onClick={() => void handleCheck()}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground",
                  "transition-colors hover:bg-primary/90",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
              >
                <RefreshCw aria-hidden="true" className="size-3.5" />
                Check drift
              </button>
            </div>
          )}

          {/* ---- Checking ---- */}
          {state.phase === "checking" && (
            <div className="flex flex-col items-center gap-3 px-5 py-10">
              <Loader2
                aria-hidden="true"
                className="size-6 animate-spin text-muted-foreground"
              />
              <p className="text-sm text-muted-foreground">
                Running dry-run check…
              </p>
            </div>
          )}

          {/* ---- Result ---- */}
          {state.phase === "result" && (() => {
            const { data, showDetail, loadingDetail } = state;
            const drifted = hasDrift(data);

            return (
              <div>
                {/* Summary counts */}
                <div className="px-5 py-5">
                  {!drifted ? (
                    <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3.5 dark:border-emerald-800 dark:bg-emerald-950/30">
                      <CheckCircle2
                        aria-hidden="true"
                        className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      />
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        No drift detected — vault and overlay are in sync
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 flex items-center gap-2">
                        <AlertTriangle
                          aria-hidden="true"
                          className="size-4 shrink-0 text-amber-500"
                        />
                        <p className="text-sm font-medium">
                          Drift detected
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <DriftCountPill
                          label="Added"
                          count={data.summary.added}
                          variant="added"
                        />
                        <DriftCountPill
                          label="Modified"
                          count={data.summary.modified}
                          variant="modified"
                        />
                        <DriftCountPill
                          label="Deleted"
                          count={data.summary.deleted}
                          variant="deleted"
                        />
                        <DriftCountPill
                          label="Unchanged"
                          count={data.summary.unchanged}
                          variant="unchanged"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Detail list — collapsible */}
                {drifted && (
                  <>
                    <div className="border-t">
                      <button
                        type="button"
                        onClick={() => void handleShowDetails()}
                        disabled={loadingDetail}
                        className={cn(
                          "flex w-full items-center justify-between px-5 py-2.5",
                          "text-xs font-medium text-muted-foreground",
                          "transition-colors hover:bg-muted/50",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          "disabled:pointer-events-none disabled:opacity-50",
                        )}
                        aria-expanded={showDetail}
                      >
                        <span>
                          {showDetail ? "Hide details" : "Show details"}
                        </span>
                        {loadingDetail ? (
                          <Loader2
                            aria-hidden="true"
                            className="size-3.5 animate-spin"
                          />
                        ) : showDetail ? (
                          <ChevronUp aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ChevronDown
                            aria-hidden="true"
                            className="size-3.5"
                          />
                        )}
                      </button>
                    </div>

                    {showDetail && data.drift_items && data.drift_items.length > 0 && (
                      <ul
                        aria-label="Drift items"
                        className="max-h-52 overflow-y-auto border-t divide-y divide-border/50"
                      >
                        {data.drift_items.map((item) => (
                          <DriftItemRow key={item.artifact_id} item={item} />
                        ))}
                      </ul>
                    )}
                  </>
                )}

                {/* Footer actions */}
                <div className="flex items-center justify-between border-t px-5 py-3.5 gap-3">
                  <button
                    type="button"
                    onClick={() => void handleCheck()}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium",
                      "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <RefreshCw aria-hidden="true" className="size-3" />
                    Re-check
                  </button>

                  {drifted && (
                    <button
                      type="button"
                      onClick={handleRequestApply}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground",
                        "transition-colors hover:bg-destructive/90",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      <ShieldAlert aria-hidden="true" className="size-3" />
                      Apply changes
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ---- Confirm apply ---- */}
          {state.phase === "confirm-apply" && (
            <div className="px-5 py-6">
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Are you sure?
                  </p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    This will write all detected drift into the Postgres overlay.
                    The vault remains unchanged, but overlay data may be
                    overwritten. This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelApply}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium",
                    "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleApply()}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground",
                    "transition-colors hover:bg-destructive/90",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  Yes, apply changes
                </button>
              </div>
            </div>
          )}

          {/* ---- Applying ---- */}
          {state.phase === "applying" && (
            <div className="flex flex-col items-center gap-3 px-5 py-10">
              <Loader2
                aria-hidden="true"
                className="size-6 animate-spin text-muted-foreground"
              />
              <p className="text-sm text-muted-foreground">
                Applying changes to overlay…
              </p>
            </div>
          )}

          {/* ---- Applied ---- */}
          {state.phase === "applied" && (
            <div className="px-5 py-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2
                  aria-hidden="true"
                  className="size-8 text-emerald-500"
                />
                <p className="text-sm font-medium">Changes applied</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  The Postgres overlay has been updated to match the vault.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCheck()}
                className={cn(
                  "mt-5 inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium",
                  "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <RefreshCw aria-hidden="true" className="size-3" />
                Run another check
              </button>
            </div>
          )}

          {/* ---- Error ---- */}
          {state.phase === "error" && (
            <div className="px-5 py-6">
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30"
              >
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400"
                />
                <p className="text-sm text-red-700 dark:text-red-400">
                  {state.message}
                </p>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleCheck()}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium",
                    "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <RefreshCw aria-hidden="true" className="size-3" />
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
