"use client";

/**
 * ActiveResearchRuns — live research run status widget for the /research page.
 *
 * Displays the current list of external_research_v1 workflow runs with their
 * statuses, polling the backend every 5 s with exponential backoff on errors
 * (capped at 30 s). A manual refresh button is always available.
 *
 * State:
 *   activeRuns   — ResearchRun[] from GET /api/workflows/runs?template_id=external_research_v1
 *   loading      — true on initial fetch and on explicit refresh
 *   error        — error message string, or null when healthy
 *   lastFetchedAt — ISO timestamp of the most recent successful fetch
 *
 * Polling contract (P5-02 / P5-04):
 *   - Interval: 5 s nominal; backed off exponentially on fetch errors (max 30 s).
 *   - In-flight guard: a new poll is skipped when the previous one has not yet settled.
 *   - Backoff resets to 5 s on next successful fetch.
 *   - Cleanup: interval cleared on unmount via useEffect return.
 *   - Error toast: shown on fetch failure using the lightweight local toast pattern
 *     (same as PendingApprovalPanel / PendingApprovalItem).
 *
 * ResearchRunCard placeholder (P5-03):
 *   Rendered as a skeleton grid cell until P5-03 lands the full card component.
 *   The import stub is below; remove TODO comment and uncomment when P5-03 ships.
 *
 * SSE migration note:
 *   // TODO(OQ-5): migrate polling to SSE when external_research_v1 SSE contract
 *   //   is proven. Backend SSE infrastructure exists (portal-pipeline-observability)
 *   //   but this is the first research consumer — polling is the MVP choice per the
 *   //   OQ-5 decision in phase-5-progress.md.
 *
 * P5-01 / P5-02 / P5-04 (audit-wave-2-phase-5).
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { RefreshCw, FlaskConical, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { listActiveResearchRuns } from "@/lib/api/research";
import {
  toResearchRun,
  DEFAULT_BACKOFF,
  type ResearchRun,
  type PollingStatus,
} from "@/types/research-runs";

import { ResearchRunCard } from "@/components/research/ResearchRunCard";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = DEFAULT_BACKOFF.baseIntervalMs; // 5 000 ms
const MAX_BACKOFF_MS = DEFAULT_BACKOFF.maxIntervalMs;    // 30 000 ms
const BACKOFF_FACTOR = DEFAULT_BACKOFF.factor;            // 2×

// ---------------------------------------------------------------------------
// Lightweight toast (same pattern as PendingApprovalPanel)
// ---------------------------------------------------------------------------

type ToastKind = "success" | "error";

interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

let _toastSeq = 0;

function useLocalToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((kind: ToastKind, text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ id: ++_toastSeq, kind, text });
    timerRef.current = setTimeout(() => setToast(null), 4_000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, show };
}

function ToastBanner({ toast }: { toast: ToastMessage }) {
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
      <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
      <span>{toast.text}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center">
      <FlaskConical
        aria-hidden="true"
        className="size-8 text-muted-foreground/50"
      />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">
          No active research runs
        </p>
        <p className="text-xs text-muted-foreground">
          Start a research run from the inbox or use the Research wizard to
          create one.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ActiveResearchRuns() {
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<PollingStatus>("idle");

  const { toast, show: showToast } = useLocalToast();

  // Refs for polling state — kept outside React state to avoid re-render cycles
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const intervalMsRef = useRef(POLL_INTERVAL_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveErrorsRef = useRef(0);

  // ------------------------------------------------------------------
  // Core fetch
  // ------------------------------------------------------------------

  const fetchRuns = useCallback(async (isManual = false): Promise<void> => {
    // Skip if another request is already in-flight (unless manual refresh)
    if (inFlightRef.current && !isManual) return;

    inFlightRef.current = true;
    setPollingStatus("fetching");
    if (isManual) setLoading(true);

    try {
      const envelope = await listActiveResearchRuns();
      if (!mountedRef.current) return;

      const mapped = (envelope.data ?? []).map(toResearchRun);
      setRuns(mapped);
      setError(null);
      setLastFetchedAt(new Date().toISOString());
      setPollingStatus("idle");

      // Reset backoff on success
      consecutiveErrorsRef.current = 0;
      intervalMsRef.current = POLL_INTERVAL_MS;
    } catch (err) {
      if (!mountedRef.current) return;

      consecutiveErrorsRef.current += 1;
      const message =
        err instanceof Error ? err.message : "Failed to fetch research runs";
      setError(message);
      setPollingStatus("error");
      showToast("error", `Research runs: ${message}`);

      // Exponential backoff
      intervalMsRef.current = Math.min(
        intervalMsRef.current * BACKOFF_FACTOR,
        MAX_BACKOFF_MS,
      );
    } finally {
      if (mountedRef.current) {
        inFlightRef.current = false;
        // Always clear the loading spinner after the first fetch (initial or manual).
        setLoading(false);
      }
    }
  }, [showToast]);

  // ------------------------------------------------------------------
  // Polling scheduler
  // ------------------------------------------------------------------

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void fetchRuns().finally(() => {
        if (mountedRef.current) scheduleNext();
      });
    }, intervalMsRef.current);
  }, [fetchRuns]);

  // ------------------------------------------------------------------
  // Mount / unmount
  // ------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch (loading=true)
    void fetchRuns().finally(() => {
      if (mountedRef.current) scheduleNext();
    });

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // fetchRuns and scheduleNext are stable (useCallback with no deps that change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // Manual refresh handler
  // ------------------------------------------------------------------

  const handleManualRefresh = useCallback(() => {
    // Reset backoff immediately on manual trigger
    consecutiveErrorsRef.current = 0;
    intervalMsRef.current = POLL_INTERVAL_MS;
    void fetchRuns(true);
  }, [fetchRuns]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const hasRuns = runs.length > 0;

  return (
    <section aria-label="Active Research Runs" className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">
            Active Research Runs
          </h2>
          {hasRuns && (
            <span
              aria-label={`${runs.length} run${runs.length === 1 ? "" : "s"}`}
              className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
            >
              {runs.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {lastFetchedAt && (
            <span
              aria-label={`Last refreshed at ${formatTimestamp(lastFetchedAt)}`}
              className="hidden text-xs text-muted-foreground sm:block"
              title={`Last refreshed: ${lastFetchedAt}`}
            >
              {formatTimestamp(lastFetchedAt)}
            </span>
          )}

          {/* Polling indicator */}
          {pollingStatus === "fetching" && (
            <span
              aria-hidden="true"
              className="size-1.5 animate-ping rounded-full bg-blue-400"
              title="Fetching..."
            />
          )}
          {pollingStatus === "error" && (
            <span
              aria-label="Polling error — using backoff retry"
              className="size-1.5 rounded-full bg-destructive"
              title={`Polling error (backoff: ${intervalMsRef.current / 1000}s)`}
            />
          )}

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={loading}
            aria-label="Refresh research runs"
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md border",
              "text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <RefreshCw
              aria-hidden="true"
              className={cn("size-3.5", loading && "animate-spin")}
            />
          </button>
        </div>
      </div>

      {/* Error banner (non-dismissible inline; toast shown separately) */}
      {error && !loading && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton (initial load only) */}
      {loading && !hasRuns && (
        <div
          aria-busy="true"
          aria-label="Loading research runs"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="flex flex-col gap-3 rounded-lg border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasRuns && !error && <EmptyState />}

      {/* Run grid */}
      {hasRuns && (
        <div
          aria-label={`${runs.length} active research run${runs.length === 1 ? "" : "s"}`}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {runs.map((run) => (
            <ResearchRunCard
              key={run.run_id}
              run={run}
              onResultUploaded={handleManualRefresh}
            />
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && <ToastBanner toast={toast} />}
    </section>
  );
}
