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
 * Draft run support (P5-02 / P5-03):
 *   - Runs with status="draft" are shown with a "Draft" badge.
 *   - Clicking a draft run card opens the research wizard at Step 3 pre-populated
 *     with the saved draft data (fetched via GET /api/workflows/{run_id}).
 *   - onDraftReEntry callback is called with ResearchRun when a draft card is clicked.
 *     The parent (/research page) manages the wizard dialog open state.
 *
 * SSE migration note:
 *   // TODO(OQ-5): migrate polling to SSE when external_research_v1 SSE contract
 *   //   is proven. Backend SSE infrastructure exists (portal-pipeline-observability)
 *   //   but this is the first research consumer — polling is the MVP choice per the
 *   //   OQ-5 decision in phase-5-progress.md.
 *
 * P5-01 / P5-02 / P5-03 / P5-04 (audit-wave-2-phase-5).
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { RefreshCw, FlaskConical, AlertCircle, FileEdit } from "lucide-react";
import { cn } from "@/lib/utils";
import { listActiveResearchRuns } from "@/lib/api/research";
import {
  toResearchRun,
  DEFAULT_BACKOFF,
  type ResearchRun,
  type PollingStatus,
} from "@/types/research-runs";
import InfoTooltip from "@/components/ui/info-tooltip";
import { TOOLTIP_COPY } from "@/lib/copy/tooltips";
import { InitiationWizardDialog } from "@/components/workflow/initiation-wizard";

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

/**
 * P1-02: Empty state with "Start Research" CTA.
 *
 * Renders a dashed-border placeholder when the active runs list is empty.
 * The "Start Research" button opens the research wizard (external_research_v1)
 * via InitiationWizardDialog with a custom trigger so no default trigger
 * button is rendered — the CTA is fully inline.
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center">
      <FlaskConical
        aria-hidden="true"
        className="size-8 text-muted-foreground/50"
      />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">
          No active research runs
        </p>
        <p className="text-xs text-muted-foreground">
          Start a new research run to begin.
        </p>
      </div>
      <InitiationWizardDialog
        template_id="external_research_v1"
        trigger={
          <button
            type="button"
            aria-label="Start a new research run"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-4 py-2",
              "bg-foreground text-background text-sm font-semibold",
              "transition-colors hover:bg-foreground/90",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            <FlaskConical aria-hidden="true" className="size-3.5" />
            Start Research
          </button>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draft badge
// ---------------------------------------------------------------------------

function DraftBadge() {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        "text-[10px] font-semibold uppercase tracking-wide",
        "border-amber-300 bg-amber-50 text-amber-700",
        "dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      )}
    >
      <FileEdit aria-hidden="true" className="size-2.5" />
      Draft
    </span>
  );
}

// ---------------------------------------------------------------------------
// Draft run card (simplified — clicking re-opens wizard)
// ---------------------------------------------------------------------------

interface DraftRunCardProps {
  run: ResearchRun;
  onClick: (run: ResearchRun) => void;
}

function DraftRunCard({ run, onClick }: DraftRunCardProps) {
  const shortId = run.run_id.slice(-8);

  function formatRelativeTime(isoDate: string): string {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
  }

  return (
    <button
      type="button"
      aria-label={`Resume draft run: ${run.topic ?? "Untitled"}`}
      onClick={() => onClick(run)}
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border bg-card p-4 text-left shadow-sm",
        "border-amber-200 dark:border-amber-800/60",
        "transition-colors hover:border-amber-300 hover:bg-amber-50/40",
        "dark:hover:border-amber-700 dark:hover:bg-amber-950/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-sm font-medium text-foreground">
            {run.topic ?? "Untitled research run"}
          </p>
          {run.research_question && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {run.research_question}
            </p>
          )}
        </div>
        <DraftBadge />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-mono">{shortId}</span>
        <span aria-hidden="true">·</span>
        <span>{formatRelativeTime(run.created_at)}</span>
        <span aria-hidden="true">·</span>
        <span className="text-amber-600 dark:text-amber-400">
          Click to resume
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ActiveResearchRunsProps {
  /**
   * Called when a draft run card is clicked.
   * The parent is responsible for opening the wizard with the draft data.
   */
  onDraftReEntry?: (run: ResearchRun) => void;
}

export function ActiveResearchRuns({ onDraftReEntry }: ActiveResearchRunsProps = {}) {
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
  const draftRuns = runs.filter((r) => r.status === "draft");
  const activeRuns = runs.filter((r) => r.status !== "draft");
  const hasDrafts = draftRuns.length > 0;
  const hasActiveRuns = activeRuns.length > 0;

  const handleDraftCardClick = useCallback(
    (run: ResearchRun) => {
      onDraftReEntry?.(run);
    },
    [onDraftReEntry],
  );

  return (
    <section aria-label="Active Research Runs" className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">
            Active Research Runs
          </h2>
          <InfoTooltip
            content={TOOLTIP_COPY.research.activeRuns}
            side="right"
            label="About Active Research Runs"
          />
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

      {/* Draft runs — shown above active runs with amber treatment */}
      {hasDrafts && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Drafts
          </p>
          <div
            aria-label={`${draftRuns.length} draft run${draftRuns.length === 1 ? "" : "s"}`}
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            {draftRuns.map((run) => (
              <DraftRunCard
                key={run.run_id}
                run={run}
                onClick={handleDraftCardClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active run grid */}
      {hasActiveRuns && (
        <div
          aria-label={`${activeRuns.length} active research run${activeRuns.length === 1 ? "" : "s"}`}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {activeRuns.map((run) => (
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
