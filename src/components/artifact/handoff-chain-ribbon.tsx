"use client";

/**
 * HandoffChainRibbon — horizontal workflow-stage pill ribbon.
 *
 * Renders the engine's compile pipeline as a horizontal row of stage pills
 * connected by thin divider lines. Sits between the title block and the
 * tabs/body split in the Artifact Detail layout (P4-04).
 *
 * ## Stage data strategy
 *
 * The backend does not yet expose a per-artifact stage-chain field on the
 * detail endpoint (P2-01 /lineage is the v1.5 timeline API; not landed as of
 * the design-pass sprint). Strategy per spec:
 *
 * 1. If `artifact.frontmatter_jsonb?.workflow_stage` is present, treat it as
 *    the current stage and highlight all preceding stages as completed.
 * 2. If `artifact.status` is "active" or "archived", infer "compile" as the
 *    last completed stage (artifact has been through the full pipeline).
 * 3. If `artifact.status` is "draft", infer "classify" as the current stage.
 * 4. Fallback: render all stages as pending (no stage data).
 *
 * **No mock six-stage chain when data is absent** — instead the inference
 * above provides a best-effort visual derived from available state. If even
 * that is absent, a single "Stage: {status}" badge row is shown per spec.
 *
 * ## Live event overlay
 *
 * When `liveEvents` is provided (from `useCompileEvents`), the static
 * inference is overridden by real SSE data: started → "current",
 * completed → "completed", failed → "failed".
 *
 * ## Accessibility
 *
 * - Each pill is keyboard-focusable (tabIndex=0).
 * - Stage status is communicated via aria-label (not color alone).
 * - Color indicators: completed=emerald, current=sky (animated ring), pending=slate, failed=red.
 *
 * Stitch reference: portal-v1.5-handoff-chain-integration.md §3.2, §4.1
 * P4-04 (Handoff Chain + Activity Timeline).
 */

import { cn } from "@/lib/utils";
import type { ArtifactDetail } from "@/types/artifact";
import type { WorkflowStageEventDTO } from "@/types/compileEvents";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Stage definitions — engine compile pipeline (canonical order)
// ---------------------------------------------------------------------------

export type StageStatus = "completed" | "current" | "pending" | "failed";

export interface StageInfo {
  id: string;
  label: string;
  shortLabel: string;
}

const ENGINE_STAGES: StageInfo[] = [
  { id: "ingest",    label: "Ingest",     shortLabel: "Ingest"   },
  { id: "classify",  label: "Classify",   shortLabel: "Classify" },
  { id: "extract",   label: "Extract",    shortLabel: "Extract"  },
  { id: "compile",   label: "Compile",    shortLabel: "Compile"  },
  { id: "file_back", label: "File-Back",  shortLabel: "File"     },
  { id: "lint",      label: "Lint",       shortLabel: "Lint"     },
];

// ---------------------------------------------------------------------------
// Stage detail (tooltip payload)
// ---------------------------------------------------------------------------

export interface StageDetail {
  durationMs?: number;
  summary?: string;
  errorDetail?: string;
}

// ---------------------------------------------------------------------------
// Stage status inference from artifact fields
// ---------------------------------------------------------------------------

/**
 * Map well-known lifecycle status strings to a current stage ID.
 * Returns null if no mapping exists for the given status.
 */
function inferCurrentStageFromStatus(status: string): string | null {
  switch (status) {
    case "active":
    case "archived":
      // Fully through pipeline
      return "lint";
    case "stale":
      // Was compiled but has drifted — still past compile
      return "lint";
    case "draft":
      // Not yet compiled
      return "classify";
    default:
      return null;
  }
}

/**
 * Derive per-stage statuses given the current stage ID.
 * All stages before currentStageId → "completed".
 * The current stage → "current".
 * All stages after → "pending".
 */
function deriveStageStatuses(
  stages: StageInfo[],
  currentStageId: string,
): Record<string, StageStatus> {
  const currentIdx = stages.findIndex((s) => s.id === currentStageId);
  if (currentIdx === -1) {
    // Unknown stage — mark all pending
    return Object.fromEntries(stages.map((s) => [s.id, "pending" as StageStatus]));
  }

  return Object.fromEntries(
    stages.map((s, i) => [
      s.id,
      i < currentIdx
        ? ("completed" as StageStatus)
        : i === currentIdx
          ? ("current" as StageStatus)
          : ("pending" as StageStatus),
    ]),
  );
}

interface ResolvedChain {
  type: "full";
  statuses: Record<string, StageStatus>;
}

interface FallbackChain {
  type: "fallback";
  statusLabel: string;
}

type ChainResolution = ResolvedChain | FallbackChain;

function resolveChain(artifact: ArtifactDetail): ChainResolution {
  // 1. Explicit frontmatter workflow_stage field
  const fmStage = artifact.frontmatter_jsonb?.["workflow_stage"];
  if (typeof fmStage === "string" && fmStage.length > 0) {
    // Map frontmatter stage name to engine stage ID
    const normalized = fmStage.toLowerCase().replace(/[- ]/g, "_");
    const matched = ENGINE_STAGES.find(
      (s) => s.id === normalized || s.label.toLowerCase() === normalized,
    );
    if (matched) {
      return {
        type: "full",
        statuses: deriveStageStatuses(ENGINE_STAGES, matched.id),
      };
    }
  }

  // 2. Infer from artifact lifecycle status
  const currentStageId = inferCurrentStageFromStatus(artifact.status);
  if (currentStageId) {
    return {
      type: "full",
      statuses: deriveStageStatuses(ENGINE_STAGES, currentStageId),
    };
  }

  // 3. No usable data — single badge fallback
  return {
    type: "fallback",
    statusLabel: artifact.status ?? "unknown",
  };
}

// ---------------------------------------------------------------------------
// Live event overlay
// ---------------------------------------------------------------------------

interface MergeResult {
  statuses: Record<string, StageStatus>;
  stageDetails: Record<string, StageDetail>;
}

/**
 * Merges SSE live events on top of the static resolved chain.
 *
 * - "ingest" is SSE-invisible (no events emitted); stays static.
 * - "terminal" events are skipped — they are not engine stages.
 * - For each engine stage: last started event → "current";
 *   completed event → "completed"; failed event → "failed".
 * - Duration is computed from the first "started" and first "completed"
 *   timestamps for the same stage.
 * - payload.output_summary → StageDetail.summary
 * - payload.error_detail   → StageDetail.errorDetail
 */
function mergeWithLiveEvents(
  chain: ResolvedChain,
  liveEvents: WorkflowStageEventDTO[],
): MergeResult {
  // Copy base statuses from static chain
  const statuses: Record<string, StageStatus> = { ...chain.statuses };
  const stageDetails: Record<string, StageDetail> = {};

  if (!liveEvents || liveEvents.length === 0) {
    return { statuses, stageDetails };
  }

  // Group events by stage (skip terminal and ingest — ingest is never emitted)
  const byStage: Record<string, WorkflowStageEventDTO[]> = {};
  for (const event of liveEvents) {
    if (event.stage === "terminal" || event.stage === "ingest") continue;
    const stageId = event.stage;
    if (!byStage[stageId]) {
      byStage[stageId] = [];
    }
    byStage[stageId].push(event);
  }

  for (const stageId of Object.keys(byStage)) {
    const events = byStage[stageId];
    const startedEvent = events.find((e) => e.status === "started");
    const completedEvent = events.find((e) => e.status === "completed");
    const failedEvent = events.find((e) => e.status === "failed");

    // Determine new status: failed > completed > current (started) > keep static
    if (failedEvent) {
      statuses[stageId] = "failed";
    } else if (completedEvent) {
      statuses[stageId] = "completed";
    } else if (startedEvent) {
      statuses[stageId] = "current";
    }

    // Build StageDetail
    const detail: StageDetail = {};

    // Duration: from started → completed timestamps
    if (startedEvent && completedEvent) {
      const startMs = new Date(startedEvent.created_at).getTime();
      const endMs = new Date(completedEvent.created_at).getTime();
      const duration = endMs - startMs;
      if (!isNaN(duration) && duration >= 0) {
        detail.durationMs = duration;
      }
    }

    // Summary from completed or failed payload
    const payloadSource = completedEvent ?? failedEvent ?? startedEvent;
    if (payloadSource) {
      const payload = payloadSource.payload;
      if (typeof payload["output_summary"] === "string" && payload["output_summary"]) {
        detail.summary = payload["output_summary"] as string;
      }
      if (typeof payload["error_detail"] === "string" && payload["error_detail"]) {
        detail.errorDetail = payload["error_detail"] as string;
      }
    }

    if (
      detail.durationMs !== undefined ||
      detail.summary !== undefined ||
      detail.errorDetail !== undefined
    ) {
      stageDetails[stageId] = detail;
    }
  }

  return { statuses, stageDetails };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const STATUS_PILL_CLASSES: Record<StageStatus, string> = {
  completed:
    "bg-emerald-100 border-emerald-300 text-emerald-800 " +
    "dark:bg-emerald-900/30 dark:border-emerald-700/60 dark:text-emerald-300",
  current:
    "bg-sky-100 border-sky-400 text-sky-900 " +
    "dark:bg-sky-900/40 dark:border-sky-500 dark:text-sky-200",
  pending:
    "bg-muted/50 border-border text-muted-foreground/60 " +
    "dark:bg-muted/30",
  failed:
    "bg-red-100 border-red-300 text-red-800 " +
    "dark:bg-red-900/30 dark:border-red-700/60 dark:text-red-300",
};

const STATUS_DOT_CLASSES: Record<StageStatus, string> = {
  completed: "bg-emerald-500 dark:bg-emerald-400",
  current:   "bg-sky-500 dark:bg-sky-400 animate-pulse",
  pending:   "bg-slate-300 dark:bg-slate-600",
  failed:    "bg-red-500 dark:bg-red-400",
};

interface StagePillProps {
  stage: StageInfo;
  status: StageStatus;
  detail?: StageDetail;
  onClick?: () => void;
}

function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

function StagePill({ stage, status, detail, onClick }: StagePillProps) {
  const ariaLabel = `${stage.label}: ${status}`;
  const hasDetail =
    detail !== undefined &&
    (detail.durationMs !== undefined ||
      detail.summary !== undefined ||
      detail.errorDetail !== undefined);

  const pillElement = (
    <span
      tabIndex={0}
      role={onClick ? "button" : "listitem"}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "text-[11px] font-medium leading-none transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        STATUS_PILL_CLASSES[status],
        onClick && "cursor-pointer",
      )}
    >
      {/* Status dot */}
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT_CLASSES[status])}
      />
      <span className="hidden sm:inline">{stage.label}</span>
      <span className="sm:hidden">{stage.shortLabel}</span>
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {pillElement}
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1 text-xs">
          <span className="font-semibold">
            {stage.label}{" "}
            <span className="font-normal capitalize text-muted-foreground">
              — {status}
            </span>
          </span>
          {hasDetail ? (
            <>
              {detail!.durationMs !== undefined && (
                <span>Duration: {formatDuration(detail!.durationMs)}</span>
              )}
              {detail!.summary && (
                <span>{truncate(detail!.summary, 80)}</span>
              )}
              {detail!.errorDetail && (
                <span className="text-red-500 dark:text-red-400">
                  {truncate(detail!.errorDetail, 80)}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">
              Click to view processing history
            </span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/** Thin connector line between stage pills */
function Connector() {
  return (
    <span aria-hidden="true" className="h-px w-3 shrink-0 bg-border sm:w-4" />
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HandoffChainRibbonProps {
  artifact: ArtifactDetail;
  className?: string;
  /** Live SSE events from useCompileEvents — when present, overrides static inference. */
  liveEvents?: WorkflowStageEventDTO[];
  /** Called when a stage pill is clicked — receives the stage ID. */
  onStageClick?: (stageId: string) => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * HandoffChainRibbon — horizontal stage-pill ribbon for Artifact Detail.
 *
 * Renders between `<ArtifactTitleBlock>` and the tabs/body split (P4-04 layout).
 * Infers stage progress from artifact lifecycle state when explicit chain data
 * is unavailable. Graceful fallback to a single status badge.
 *
 * When `liveEvents` is provided the static inference is overlaid with real-time
 * SSE data so in-flight stages animate live.
 */
export function HandoffChainRibbon({
  artifact,
  className,
  liveEvents,
  onStageClick,
}: HandoffChainRibbonProps) {
  const chain = resolveChain(artifact);

  if (chain.type === "fallback") {
    // Graceful fallback: single "Stage: {status}" badge — spec §A.2
    return (
      <div
        aria-label="Workflow stage"
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2",
          className,
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Stage
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1",
            "text-[11px] font-medium capitalize",
            "bg-muted/60 border-border text-foreground",
          )}
        >
          {chain.statusLabel}
        </span>
      </div>
    );
  }

  // Merge live events on top of static chain (only when events present)
  const { statuses, stageDetails } =
    liveEvents && liveEvents.length > 0
      ? mergeWithLiveEvents(chain, liveEvents)
      : { statuses: chain.statuses, stageDetails: {} as Record<string, StageDetail> };

  return (
    <TooltipProvider>
      <div
        aria-label="Artifact workflow stages"
        className={cn(
          "flex items-center gap-0 overflow-hidden rounded-lg border bg-muted/20 px-3 py-3",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="mr-3 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70"
        >
          Pipeline
        </span>
        <ol
          role="list"
          aria-label="Engine workflow stages"
          className="flex items-center"
        >
          {ENGINE_STAGES.map((stage, idx) => (
            <li key={stage.id} className="flex items-center">
              <StagePill
                stage={stage}
                status={statuses[stage.id] ?? "pending"}
                detail={stageDetails[stage.id]}
                onClick={onStageClick ? () => onStageClick(stage.id) : undefined}
              />
              {idx < ENGINE_STAGES.length - 1 && <Connector />}
            </li>
          ))}
        </ol>
      </div>
    </TooltipProvider>
  );
}
