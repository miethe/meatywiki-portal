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
 * ## Accessibility
 *
 * - Each pill is keyboard-focusable (tabIndex=0).
 * - Stage status is communicated via aria-label (not color alone).
 * - Color indicators: completed=emerald, current=sky (animated ring), pending=slate.
 *
 * Stitch reference: portal-v1.5-handoff-chain-integration.md §3.2, §4.1
 * P4-04 (Handoff Chain + Activity Timeline).
 */

import { cn } from "@/lib/utils";
import type { ArtifactDetail } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Stage definitions — engine compile pipeline (canonical order)
// ---------------------------------------------------------------------------

export type StageStatus = "completed" | "current" | "pending";

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
};

const STATUS_DOT_CLASSES: Record<StageStatus, string> = {
  completed: "bg-emerald-500 dark:bg-emerald-400",
  current:   "bg-sky-500 dark:bg-sky-400 animate-pulse",
  pending:   "bg-slate-300 dark:bg-slate-600",
};

interface StagePillProps {
  stage: StageInfo;
  status: StageStatus;
}

function StagePill({ stage, status }: StagePillProps) {
  const ariaLabel = `${stage.label}: ${status}`;

  return (
    <span
      tabIndex={0}
      role="listitem"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "text-[11px] font-medium leading-none transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        STATUS_PILL_CLASSES[status],
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
 */
export function HandoffChainRibbon({ artifact, className }: HandoffChainRibbonProps) {
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

  return (
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
            <StagePill stage={stage} status={chain.statuses[stage.id] ?? "pending"} />
            {idx < ENGINE_STAGES.length - 1 && <Connector />}
          </li>
        ))}
      </ol>
    </div>
  );
}
