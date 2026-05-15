"use client";

// TODO: migrate to SSE (OQ-5) — this component currently uses on-demand fetch
// to load run detail when expanded. Migrate to SSE when the external_research_v1
// SSE contract is proven (see OQ-5 decision in phase-5-progress.md).

/**
 * ResearchRunCard — collapsible card for a single external_research_v1 run.
 *
 * Collapsed view: header (topic, venue/template), status pill, run ID + timestamp.
 * Expanded view: full task list with per-task status icons, action buttons per row.
 *
 * Task detail is fetched lazily (GET /api/workflows/{run_id}) on first expand.
 * Task state transitions call PATCH /api/workflows/{run_id}/external-research/task.
 *
 * Upload Result opens <UploadResultModal> (P5-05).
 *
 * P5-03 (audit-wave-2-phase-5).
 */

import React, { useCallback, useId, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Pause,
  Play,
  Upload,
  AlertCircle,
  CheckCircle2,
  Circle,
  XCircle,
  Loader,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getWorkflowRunDetail, patchResearchTaskStatus } from "@/lib/api/research";
import type { ResearchRun } from "@/types/research-runs";
import type {
  WorkflowRunDetail,
  ExternalResearchTaskStatus,
} from "@/types/workflows/research";
import { UploadResultModal } from "@/components/research/UploadResultModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResearchRunCardProps {
  run: ResearchRun;
  /** Called after a successful result upload so the parent can trigger a poll. */
  onResultUploaded?: () => void;
}

// ---------------------------------------------------------------------------
// Task status icon map
// ---------------------------------------------------------------------------

type TaskIconProps = { status: ExternalResearchTaskStatus; className?: string };

function TaskStatusIcon({ status, className }: TaskIconProps) {
  const base = cn("size-4 shrink-0", className);
  switch (status) {
    case "created":
      return <Circle aria-hidden="true" className={cn(base, "text-slate-400")} />;
    case "exported":
    case "waiting_external":
      return <Loader aria-hidden="true" className={cn(base, "animate-spin text-blue-500")} />;
    case "result_uploaded":
    case "synthesizing":
      return <Loader2 aria-hidden="true" className={cn(base, "animate-spin text-amber-500")} />;
    case "review_pending":
      return <Info aria-hidden="true" className={cn(base, "text-violet-500")} />;
    case "complete":
      return <CheckCircle2 aria-hidden="true" className={cn(base, "text-emerald-500")} />;
    case "cancelled":
      return <XCircle aria-hidden="true" className={cn(base, "text-slate-400")} />;
    default:
      return <Circle aria-hidden="true" className={cn(base, "text-muted-foreground")} />;
  }
}

// ---------------------------------------------------------------------------
// Status pill (run-level)
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: ResearchRun["status"] }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
    running: { label: "Running", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
    paused: { label: "Paused", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
    complete: { label: "Complete", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
    failed: { label: "Failed", cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
    abandoned: { label: "Abandoned", cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500" },
  };
  const { label, cls } = cfg[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        cls,
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

const TASK_STATUS_LABEL: Record<ExternalResearchTaskStatus, string> = {
  created: "Created",
  exported: "Exported",
  waiting_external: "Waiting (external)",
  result_uploaded: "Result uploaded",
  synthesizing: "Synthesizing",
  review_pending: "Review pending",
  complete: "Complete",
  cancelled: "Cancelled",
};

// ---------------------------------------------------------------------------
// Task row action button
// ---------------------------------------------------------------------------

interface ActionButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
}

function ActionButton({ label, icon, onClick, disabled, variant = "default" }: ActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded border text-xs",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variant === "destructive"
          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Task row
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: WorkflowRunDetail;
  onTaskAction: (action: ExternalResearchTaskStatus) => Promise<void>;
  onUploadResult: () => void;
  actionInFlight: boolean;
}

/**
 * Renders the external research task state machine row.
 *
 * The backend's external_research_tasks table is one-row-per-run (one task per run),
 * so we render one row summarising the current task status with applicable actions.
 *
 * Applicable actions by status:
 *   created / exported     → can cancel (status → cancelled)
 *   waiting_external       → Pause (→ cancelled), Upload Result
 *   result_uploaded        → Upload Result (duplicate, shown with warning)
 *   review_pending         → Upload Result
 *   synthesizing           → (no actions; automated)
 *   complete / cancelled   → (no actions; terminal)
 */
function TaskRow({ task, onTaskAction, onUploadResult, actionInFlight }: TaskRowProps) {
  // The run detail doesn't directly expose the task row status — we infer from
  // run status and surface events to pick the most useful action set.
  // This is a best-effort display; the PATCH endpoint enforces valid transitions.
  const currentStatus = task.status as ExternalResearchTaskStatus;

  const canPause = ["created", "exported", "waiting_external"].includes(currentStatus);
  const canResume = currentStatus === "cancelled";
  const canUpload = ["waiting_external", "result_uploaded", "review_pending"].includes(currentStatus);

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2">
      <TaskStatusIcon status={currentStatus} />
      <span className="flex-1 text-xs font-medium text-foreground">
        {TASK_STATUS_LABEL[currentStatus] ?? currentStatus}
      </span>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {canPause && (
          <ActionButton
            label="Pause / cancel task"
            icon={<Pause className="size-3" />}
            onClick={() => void onTaskAction("cancelled")}
            disabled={actionInFlight}
          />
        )}
        {canResume && (
          <ActionButton
            label="Resume task"
            icon={<Play className="size-3" />}
            onClick={() => void onTaskAction("waiting_external")}
            disabled={actionInFlight}
          />
        )}
        {canUpload && (
          <ActionButton
            label="Upload result"
            icon={<Upload className="size-3" />}
            onClick={onUploadResult}
            disabled={actionInFlight}
          />
        )}
        {actionInFlight && (
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ResearchRunCard({ run, onResultUploaded }: ResearchRunCardProps) {
  const headerId = useId();
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<WorkflowRunDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Track whether we've fetched detail at least once to avoid re-fetch on re-expand
  const fetchedRef = useRef(false);

  // ------------------------------------------------------------------
  // Expand — lazy detail fetch
  // ------------------------------------------------------------------

  const handleExpand = useCallback(async () => {
    const next = !expanded;
    setExpanded(next);

    if (next && !fetchedRef.current) {
      fetchedRef.current = true;
      setLoadingDetail(true);
      setDetailError(null);
      try {
        const envelope = await getWorkflowRunDetail(run.run_id);
        setDetail(envelope.data);
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : "Failed to load run detail");
      } finally {
        setLoadingDetail(false);
      }
    }
  }, [expanded, run.run_id]);

  // ------------------------------------------------------------------
  // Task action (PATCH status)
  // ------------------------------------------------------------------

  const handleTaskAction = useCallback(
    async (targetStatus: ExternalResearchTaskStatus) => {
      setActionInFlight(true);
      try {
        await patchResearchTaskStatus(run.run_id, { status: targetStatus });
        // Re-fetch detail to get updated task state
        const envelope = await getWorkflowRunDetail(run.run_id);
        setDetail(envelope.data);
      } catch {
        // Silently log; the card stays in the last known state
      } finally {
        setActionInFlight(false);
      }
    },
    [run.run_id],
  );

  // ------------------------------------------------------------------
  // Upload result callback
  // ------------------------------------------------------------------

  const handleUploadSuccess = useCallback(() => {
    setUploadOpen(false);
    // Refresh detail so task status updates in the card
    void getWorkflowRunDetail(run.run_id).then((env) => setDetail(env.data)).catch(() => undefined);
    onResultUploaded?.();
  }, [run.run_id, onResultUploaded]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const shortId = run.run_id.slice(-8);

  return (
    <>
      <article
        aria-labelledby={headerId}
        className={cn(
          "flex flex-col rounded-lg border bg-card shadow-sm",
          "transition-colors hover:border-border/80",
        )}
      >
        {/* ---------- Header (always visible) ---------- */}
        <button
          type="button"
          id={headerId}
          aria-expanded={expanded}
          aria-controls={`run-detail-${shortId}`}
          onClick={() => { void handleExpand(); }}
          className={cn(
            "flex w-full items-start justify-between gap-2 p-4 text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="truncate text-sm font-medium text-foreground">
              {run.topic ?? "Untitled research run"}
            </p>
            {run.research_question && (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {run.research_question}
              </p>
            )}
            {/* Run ID + timestamp */}
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock aria-hidden="true" className="size-3 shrink-0" />
              <span className="font-mono">{shortId}</span>
              <span aria-hidden="true">·</span>
              <span>{formatRelativeTime(run.created_at)}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <StatusPill status={run.status} />
            {expanded ? (
              <ChevronUp aria-hidden="true" className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* ---------- Expanded detail ---------- */}
        {expanded && (
          <div
            id={`run-detail-${shortId}`}
            role="region"
            aria-label={`Detail for run ${shortId}`}
            className="flex flex-col gap-2 border-t border-border/60 px-4 pb-4 pt-3"
          >
            {loadingDetail && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                <span>Loading run detail…</span>
              </div>
            )}

            {detailError && !loadingDetail && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
                <span>{detailError}</span>
              </div>
            )}

            {detail && !loadingDetail && (
              <div className="flex flex-col gap-2">
                {/* Task row */}
                <TaskRow
                  task={detail}
                  onTaskAction={handleTaskAction}
                  onUploadResult={() => setUploadOpen(true)}
                  actionInFlight={actionInFlight}
                />

                {/* Stage durations (if any) */}
                {Object.keys(detail.stage_durations).length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Stages
                    </p>
                    {Object.entries(detail.stage_durations).map(([stage, dur]) => (
                      <div key={stage} className="flex items-center justify-between gap-2 text-xs">
                        <span className="capitalize text-foreground">{stage.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground">
                          {dur.duration_ms != null ? `${Math.round(dur.duration_ms)}ms` : "–"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload result shortcut (always available in expanded view when applicable) */}
                {["waiting_external", "result_uploaded", "review_pending"].includes(detail.status) && (
                  <button
                    type="button"
                    onClick={() => setUploadOpen(true)}
                    className={cn(
                      "mt-1 inline-flex items-center gap-1.5 self-start rounded-md border px-3 py-1.5",
                      "text-xs font-medium text-foreground transition-colors",
                      "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <Upload aria-hidden="true" className="size-3.5" />
                    Upload result
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </article>

      {/* Upload result modal — mounted outside card layout to avoid nesting */}
      <UploadResultModal
        open={uploadOpen}
        runId={run.run_id}
        onOpenChange={setUploadOpen}
        onSuccess={handleUploadSuccess}
      />
    </>
  );
}
