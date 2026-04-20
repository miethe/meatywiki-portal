"use client";

/**
 * StageContextPanel — per-stage inputs / outputs / artifact lineage (Panel B).
 *
 * Renders when a stage is clicked in the TimelinePanel. Shows:
 *   - Stage name + status
 *   - inputs key-value pairs (from event_payload.inputs)
 *   - outputs key-value pairs (from event_payload.outputs)
 *   - produced artifact IDs (from event_payload.artifact_id / artifact_ids)
 *   - error message if the stage failed
 *   - duration
 *
 * Design reference: workflow-detail-synthesis-stage.html — "Current Stage
 * Detail Panel" section. Adapted to shadcn/ui + Tailwind tokens.
 *
 * FR-1.5-07 (P1.5-2-02).
 */

import { cn } from "@/lib/utils";
import type { TimelineStage, TimelineStageStatus } from "@/types/workflow-viewer";

// ---------------------------------------------------------------------------
// Status colour helpers
// ---------------------------------------------------------------------------

function statusBadgeClass(status: TimelineStageStatus): string {
  const map: Record<TimelineStageStatus, string> = {
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    error: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    pending: "bg-muted text-muted-foreground",
  };
  return cn(
    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
    map[status],
  );
}

function statusLabel(status: TimelineStageStatus): string {
  const map: Record<TimelineStageStatus, string> = {
    success: "Completed",
    error: "Failed",
    in_progress: "In Progress",
    pending: "Pending",
  };
  return map[status];
}

// ---------------------------------------------------------------------------
// Duration formatter
// ---------------------------------------------------------------------------

function formatDuration(s: number | null): string {
  if (s === null || s < 0) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}m${sec > 0 ? ` ${sec}s` : ""}`;
}

// ---------------------------------------------------------------------------
// Key-value list helper
// ---------------------------------------------------------------------------

function KVList({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown> | null | undefined;
}) {
  if (!data || Object.keys(data).length === 0) return null;

  return (
    <div>
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h4>
      <dl className="flex flex-col gap-1.5">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
            <dt className="font-medium text-foreground/70 shrink-0">{k}</dt>
            <dd className="truncate font-mono text-xs text-foreground/80 break-all whitespace-pre-wrap max-h-16 overflow-y-auto">
              {typeof v === "string" ? v : JSON.stringify(v, null, 2)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artifact ID chip
// ---------------------------------------------------------------------------

function ArtifactChip({ id }: { id: string }) {
  return (
    <span className="inline-flex items-center rounded bg-muted/60 px-2 py-0.5 font-mono text-[11px] text-foreground/70 truncate max-w-[14rem]">
      {id}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
      <svg
        aria-hidden="true"
        className="mb-3 size-8 opacity-40"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
      <p className="text-sm">Click a stage in the timeline to view its context.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

interface StageContextPanelProps {
  stage: TimelineStage | null;
  className?: string;
}

export function StageContextPanel({ stage, className }: StageContextPanelProps) {
  if (!stage) {
    return (
      <section
        aria-label="Stage context"
        className={cn(
          "rounded-xl border border-border bg-card p-6",
          className,
        )}
      >
        <EmptyState />
      </section>
    );
  }

  // Aggregate payload from all events in the stage.
  const payloads = stage.events
    .map((e) => e.event_payload)
    .filter(Boolean) as NonNullable<typeof stage.events[0]["event_payload"]>[];

  const inputs = payloads.find((p) => p.inputs != null)?.inputs as
    | Record<string, unknown>
    | null
    | undefined;
  const outputs = payloads.find((p) => p.outputs != null)?.outputs as
    | Record<string, unknown>
    | null
    | undefined;
  const artifactId = payloads.find((p) => p.artifact_id)?.artifact_id as
    | string
    | null
    | undefined;
  const artifactIds = payloads.find((p) => p.artifact_ids)?.artifact_ids as
    | string[]
    | null
    | undefined;
  const error = payloads.find((p) => p.error)?.error as string | null | undefined;

  const allArtifactIds: string[] = [
    ...(artifactId ? [artifactId] : []),
    ...(artifactIds ?? []),
  ];

  return (
    <section
      aria-label={`Stage context: ${stage.label}`}
      className={cn(
        "rounded-xl border border-border bg-card",
        // Left accent colour based on status.
        stage.status === "in_progress" && "border-l-4 border-l-blue-500",
        stage.status === "success" && "border-l-4 border-l-emerald-500",
        stage.status === "error" && "border-l-4 border-l-red-500",
        className,
      )}
    >
      {/* Panel header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h3 className="text-base font-bold text-foreground">{stage.label}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Duration: <span className="tabular-nums font-medium">{formatDuration(stage.durationS)}</span>
          </p>
        </div>
        <span className={statusBadgeClass(stage.status)} role="status">
          {statusLabel(stage.status)}
        </span>
      </div>

      {/* Panel body */}
      <div className="flex flex-col gap-5 p-6">
        {/* Error */}
        {error && (
          <div role="alert" className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Inputs */}
        <KVList title="Inputs" data={inputs} />

        {/* Outputs */}
        <KVList title="Outputs" data={outputs} />

        {/* Artifact lineage */}
        {allArtifactIds.length > 0 && (
          <div>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Produced Artifacts
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {allArtifactIds.map((id) => (
                <ArtifactChip key={id} id={id} />
              ))}
            </div>
          </div>
        )}

        {/* No payload fallback */}
        {!inputs && !outputs && allArtifactIds.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">
            No payload data recorded for this stage.
          </p>
        )}
      </div>
    </section>
  );
}
