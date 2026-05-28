"use client";

/**
 * HandoffChainRibbon — horizontal workflow-stage pill ribbon.
 *
 * Renders the engine's compile pipeline as a horizontal row of stage pills
 * connected by thin divider lines. Sits between the title block and the
 * tabs/body split in the Artifact Detail layout (P4-04).
 *
 * ## Stage data strategy (event-driven — lifecycle inference removed)
 *
 * Stage status is derived exclusively from real event data (no lifecycle
 * status inference). Two event sources are accepted:
 *
 *   1. `historicalEvents` — StageEventItem[] from the latest-run processing
 *      history (initial page load, no active compile in flight).
 *   2. `liveEvents` — WorkflowStageEventDTO[] from the SSE stream
 *      (useCompileEvents), supplied when a compile is in progress.
 *
 * Live events take precedence over historical for the same stage.
 *
 * Three display modes:
 *   A. ANY events present (historical or live) → derive 4 compile stages
 *      from events; ingest shown complete (it always precedes compile);
 *      stages with no events → pending.
 *   B. NO events + artifact NOT compiled → all stages pending, label
 *      "Not yet compiled".
 *   C. NO events + artifact IS compiled (legacy/CLI, status active/archived/
 *      stale) → all 4 compile stages shown as complete, tooltip "details
 *      unavailable (compiled outside Portal)".
 *
 * Compiled check: artifact.status in {"active","archived","stale"} OR
 * artifact.compiled_content is non-null.
 *
 * ## Stage normalization
 *
 * StageEventItem.stage_name values are canonical engine stage IDs:
 *   classify | extract | compile | file_back
 * WorkflowStageEventDTO.stage values are the same IDs.
 * No translation map needed; both sources use identical tokens.
 *
 * ## Lint pill
 *
 * Lint is a separate, visually distinct pill rendered after a divider.
 * If lint events exist in history/live → reflect their status.
 * If `onRunLint` is provided and no lint is in progress → show as
 * actionable "Run Lint" button. Clicking triggers onRunLint().
 *
 * ## Accessibility
 *
 * - Each pill is keyboard-focusable (tabIndex=0).
 * - Stage status is communicated via aria-label (not color alone).
 * - Lint button has role="button" with descriptive aria-label.
 *
 * Stitch reference: portal-v1.5-handoff-chain-integration.md §3.2, §4.1
 * P4-04 (Handoff Chain + Activity Timeline).
 */

import { cn } from "@/lib/utils";
import type { ArtifactDetail } from "@/types/artifact";
import type { WorkflowStageEventDTO } from "@/types/compileEvents";
import type { StageEventItem } from "@/hooks/use-processing-history";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Stage definitions — compile pipeline only (canonical order, no lint)
// ---------------------------------------------------------------------------

export type StageStatus = "completed" | "current" | "pending" | "failed" | "degraded";

export interface StageInfo {
  id: string;
  label: string;
  shortLabel: string;
}

/** The 4 real compile stages (ingest is implicit — always complete). */
const COMPILE_STAGES: StageInfo[] = [
  { id: "classify",  label: "Classify",   shortLabel: "Classify" },
  { id: "extract",   label: "Extract",    shortLabel: "Extract"  },
  { id: "compile",   label: "Compile",    shortLabel: "Compile"  },
  { id: "file_back", label: "File-Back",  shortLabel: "File"     },
];

/** Ingest — always displayed as a completed precursor pill. */
const INGEST_STAGE: StageInfo = { id: "ingest", label: "Ingest", shortLabel: "Ingest" };

/** Lint — displayed as a separate pill after a divider. */
const LINT_STAGE: StageInfo = { id: "lint", label: "Lint", shortLabel: "Lint" };

// ---------------------------------------------------------------------------
// Stage detail (tooltip payload)
// ---------------------------------------------------------------------------

export interface StageDetail {
  durationMs?: number;
  summary?: string;
  errorDetail?: string;
  degradedReason?: string;
  /** True when there were no events for this stage but the artifact is known compiled. */
  detailsUnavailable?: boolean;
}

// ---------------------------------------------------------------------------
// "Is compiled" check
// ---------------------------------------------------------------------------

function isArtifactCompiled(artifact: ArtifactDetail): boolean {
  if (artifact.status === "active" || artifact.status === "archived" || artifact.status === "stale") {
    return true;
  }
  // compiled_content may or may not be present on the type; check defensively
  const cc = (artifact as ArtifactDetail & { compiled_content?: string | null }).compiled_content;
  return Boolean(cc);
}

// ---------------------------------------------------------------------------
// Normalize historical StageEventItem[] → per-stage status + detail
// ---------------------------------------------------------------------------

interface NormalizedStageData {
  statuses: Record<string, StageStatus>;
  details: Record<string, StageDetail>;
}

/**
 * Map StageEventItem.event_type → StageStatus for a single stage.
 *
 * Priority within a stage (highest wins):
 *   stage_failed | compile_failed → failed
 *   stage_completed               → completed
 *   stage_degraded                → degraded
 *   stage_started                 → current
 */
function deriveStatusFromHistoricalEvents(
  items: StageEventItem[],
): { status: StageStatus; detail: StageDetail } {
  const failed  = items.find((e) => e.event_type === "stage_failed" || e.event_type === "compile_failed");
  const completed = items.find((e) => e.event_type === "stage_completed");
  const degraded  = items.find((e) => e.event_type === "stage_degraded");
  const started   = items.find((e) => e.event_type === "stage_started");

  let status: StageStatus = "pending";
  if (failed)    status = "failed";
  else if (completed) status = "completed";
  else if (degraded)  status = "degraded";
  else if (started)   status = "current";

  const detail: StageDetail = {};

  // Duration: started → completed
  if (started && completed) {
    const startMs = new Date(started.created_at).getTime();
    const endMs   = new Date(completed.created_at).getTime();
    const dur = endMs - startMs;
    if (!isNaN(dur) && dur >= 0) detail.durationMs = dur;
  } else if (started && (failed ?? degraded)) {
    const endEv = failed ?? degraded;
    if (endEv) {
      const startMs = new Date(started.created_at).getTime();
      const endMs   = new Date(endEv.created_at).getTime();
      const dur = endMs - startMs;
      if (!isNaN(dur) && dur >= 0) detail.durationMs = dur;
    }
  }

  // Use duration_ms from the event itself as fallback
  const bestEvent = completed ?? failed ?? degraded ?? started;
  if (bestEvent) {
    if (detail.durationMs === undefined && bestEvent.duration_ms != null) {
      detail.durationMs = bestEvent.duration_ms;
    }
    if (bestEvent.output_summary) detail.summary = bestEvent.output_summary;
    if (bestEvent.error_detail)   detail.errorDetail = bestEvent.error_detail;
    if (bestEvent.degraded_reason) detail.degradedReason = bestEvent.degraded_reason;
  }

  return { status, detail };
}

function normalizeHistoricalEvents(items: StageEventItem[]): NormalizedStageData {
  const statuses: Record<string, StageStatus> = {};
  const details: Record<string, StageDetail> = {};

  // Group by stage_name (null events are compile-level — attribute to "compile" stage)
  const byStage: Record<string, StageEventItem[]> = {};
  for (const item of items) {
    const key = item.stage_name ?? "compile";
    if (!byStage[key]) byStage[key] = [];
    byStage[key].push(item);
  }

  for (const [stageId, stageItems] of Object.entries(byStage)) {
    const { status, detail } = deriveStatusFromHistoricalEvents(stageItems);
    statuses[stageId] = status;
    if (
      detail.durationMs !== undefined ||
      detail.summary !== undefined ||
      detail.errorDetail !== undefined ||
      detail.degradedReason !== undefined
    ) {
      details[stageId] = detail;
    }
  }

  return { statuses, details };
}

// ---------------------------------------------------------------------------
// Merge live SSE events on top of historical data
// ---------------------------------------------------------------------------

/**
 * Merges SSE live WorkflowStageEventDTO[] on top of existing stage data.
 * Live events take precedence for the same stageId.
 *
 * - "ingest" and "terminal" events are ignored.
 * - For each stage: failed > completed > current (started).
 */
function mergeWithLiveEvents(
  base: NormalizedStageData,
  liveEvents: WorkflowStageEventDTO[],
): NormalizedStageData {
  const statuses: Record<string, StageStatus> = { ...base.statuses };
  const details: Record<string, StageDetail>  = { ...base.details };

  if (!liveEvents || liveEvents.length === 0) return { statuses, details };

  const byStage: Record<string, WorkflowStageEventDTO[]> = {};
  for (const ev of liveEvents) {
    if (ev.stage === "terminal" || ev.stage === "ingest") continue;
    if (!byStage[ev.stage]) byStage[ev.stage] = [];
    byStage[ev.stage].push(ev);
  }

  for (const [stageId, evs] of Object.entries(byStage)) {
    const failedEv    = evs.find((e) => e.status === "failed");
    const completedEv = evs.find((e) => e.status === "completed");
    const startedEv   = evs.find((e) => e.status === "started");

    if (failedEv)       statuses[stageId] = "failed";
    else if (completedEv) statuses[stageId] = "completed";
    else if (startedEv)   statuses[stageId] = "current";

    const detail: StageDetail = {};
    if (startedEv && completedEv) {
      const startMs = new Date(startedEv.created_at).getTime();
      const endMs   = new Date(completedEv.created_at).getTime();
      const dur = endMs - startMs;
      if (!isNaN(dur) && dur >= 0) detail.durationMs = dur;
    }
    const src = completedEv ?? failedEv ?? startedEv;
    if (src) {
      const payload = src.payload;
      if (typeof payload["output_summary"] === "string" && payload["output_summary"]) {
        detail.summary = payload["output_summary"] as string;
      }
      if (typeof payload["error_detail"] === "string" && payload["error_detail"]) {
        detail.errorDetail = payload["error_detail"] as string;
      }
    }
    if (
      detail.durationMs !== undefined ||
      detail.summary     !== undefined ||
      detail.errorDetail !== undefined
    ) {
      details[stageId] = detail;
    }
  }

  return { statuses, details };
}

// ---------------------------------------------------------------------------
// Build final per-stage display data (mode A / B / C)
// ---------------------------------------------------------------------------

interface DisplayData {
  statuses: Record<string, StageStatus>;
  details: Record<string, StageDetail>;
  /** Mode B: no events, not compiled. */
  notYetCompiled: boolean;
  /** Mode C: no events, compiled (legacy). */
  legacyCompiled: boolean;
}

function buildDisplayData(
  artifact: ArtifactDetail,
  historicalEvents: StageEventItem[],
  liveEvents: WorkflowStageEventDTO[],
): DisplayData {
  const hasLive = liveEvents.length > 0;
  const hasHistorical = historicalEvents.length > 0;
  const hasAny = hasLive || hasHistorical;

  if (hasAny) {
    // Mode A: derive from events
    const base   = normalizeHistoricalEvents(historicalEvents);
    const merged = mergeWithLiveEvents(base, liveEvents);
    return { ...merged, notYetCompiled: false, legacyCompiled: false };
  }

  const compiled = isArtifactCompiled(artifact);

  if (!compiled) {
    // Mode B: no events, not compiled
    const statuses: Record<string, StageStatus> = {};
    const details: Record<string, StageDetail>  = {};
    for (const s of COMPILE_STAGES) { statuses[s.id] = "pending"; }
    statuses[LINT_STAGE.id] = "pending";
    return { statuses, details, notYetCompiled: true, legacyCompiled: false };
  }

  // Mode C: no events, compiled (CLI/legacy)
  const statuses: Record<string, StageStatus> = {};
  const details: Record<string, StageDetail>  = {};
  for (const s of COMPILE_STAGES) {
    statuses[s.id] = "completed";
    details[s.id] = { detailsUnavailable: true };
  }
  statuses[LINT_STAGE.id] = "pending"; // unknown lint state for legacy
  return { statuses, details, notYetCompiled: false, legacyCompiled: true };
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
  degraded:
    "bg-amber-100 border-amber-300 text-amber-800 " +
    "dark:bg-amber-900/30 dark:border-amber-700/60 dark:text-amber-300",
};

const STATUS_DOT_CLASSES: Record<StageStatus, string> = {
  completed: "bg-emerald-500 dark:bg-emerald-400",
  current:   "bg-sky-500 dark:bg-sky-400 animate-pulse",
  pending:   "bg-slate-300 dark:bg-slate-600",
  failed:    "bg-red-500 dark:bg-red-400",
  degraded:  "bg-amber-500 dark:bg-amber-400",
};

interface StagePillProps {
  stage: StageInfo;
  status: StageStatus;
  detail?: StageDetail;
  onClick?: () => void;
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

function StagePill({ stage, status, detail, onClick }: StagePillProps) {
  const ariaLabel = `${stage.label}: ${status}`;
  const hasRealDetail =
    detail !== undefined &&
    !detail.detailsUnavailable &&
    (detail.durationMs !== undefined ||
      detail.summary !== undefined ||
      detail.errorDetail !== undefined ||
      detail.degradedReason !== undefined);

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
              — {status === "degraded" ? "degraded (with warnings)" : status}
            </span>
          </span>
          {detail?.detailsUnavailable ? (
            <span className="text-muted-foreground">
              Compiled outside Portal — per-stage details unavailable
            </span>
          ) : hasRealDetail ? (
            <>
              {detail!.durationMs !== undefined && (
                <span>Duration: {formatDuration(detail!.durationMs)}</span>
              )}
              {detail!.degradedReason && (
                <span className="text-amber-600 dark:text-amber-400">
                  Warning: {truncate(detail!.degradedReason, 80)}
                </span>
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

/** Lint pill — actionable when onRunLint is provided and lint not in-progress. */
interface LintPillProps {
  status: StageStatus;
  detail?: StageDetail;
  onRunLint?: () => void;
  onClick?: () => void;
}

function LintPill({ status, detail, onRunLint, onClick }: LintPillProps) {
  const isActionable = onRunLint !== undefined && status === "pending";
  const isRunning    = status === "current";

  const ariaLabel = isActionable
    ? "Run lint check on this artifact"
    : `Lint: ${status}`;

  const pillElement = (
    <span
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      onClick={isActionable ? onRunLint : onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (isActionable) onRunLint?.();
          else onClick?.();
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "text-[11px] font-medium leading-none transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        isActionable
          ? "cursor-pointer bg-violet-50 border-violet-300 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/20 dark:border-violet-700/60 dark:text-violet-300 dark:hover:bg-violet-900/40"
          : STATUS_PILL_CLASSES[status],
        (onClick && !isActionable) && "cursor-pointer",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          isActionable
            ? "bg-violet-400 dark:bg-violet-500"
            : STATUS_DOT_CLASSES[status],
          isRunning && "animate-pulse",
        )}
      />
      <span className="hidden sm:inline">
        {isActionable ? "Run Lint" : LINT_STAGE.label}
      </span>
      <span className="sm:hidden">Lint</span>
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{pillElement}</TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1 text-xs">
          {isActionable ? (
            <>
              <span className="font-semibold">Run Lint</span>
              <span className="text-muted-foreground">
                Run a lint-scope pass to check for issues
              </span>
            </>
          ) : (
            <>
              <span className="font-semibold">
                Lint{" "}
                <span className="font-normal capitalize text-muted-foreground">
                  — {status}
                </span>
              </span>
              {detail?.durationMs !== undefined && (
                <span>Duration: {formatDuration(detail.durationMs)}</span>
              )}
              {detail?.summary && (
                <span>{truncate(detail.summary, 80)}</span>
              )}
              {detail?.errorDetail && (
                <span className="text-red-500 dark:text-red-400">
                  {truncate(detail.errorDetail, 80)}
                </span>
              )}
              {!detail?.durationMs && !detail?.summary && !detail?.errorDetail && (
                <span className="text-muted-foreground">
                  Click to view processing history
                </span>
              )}
            </>
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

/** Vertical divider separating compile stages from lint */
function SectionDivider() {
  return (
    <span
      aria-hidden="true"
      className="mx-2 h-4 w-px shrink-0 bg-border/60"
    />
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HandoffChainRibbonProps {
  artifact: ArtifactDetail;
  className?: string;
  /**
   * Historical stage events from the latest compile run (useProcessingHistory).
   * Used as the base layer when no live SSE events are present.
   */
  historicalEvents?: StageEventItem[];
  /** Live SSE events from useCompileEvents — takes precedence over historical. */
  liveEvents?: WorkflowStageEventDTO[];
  /** Called when a compile stage pill is clicked — opens Processing tab. */
  onStageClick?: (stageId: string) => void;
  /**
   * Called when the Lint pill is clicked in "Run Lint" mode (pending state,
   * no lint events). When omitted the lint pill shows status only.
   */
  onRunLint?: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * HandoffChainRibbon — horizontal stage-pill ribbon for Artifact Detail.
 *
 * Derives stage progress from real event data (historical + live SSE).
 * Never infers state from artifact lifecycle status.
 *
 * Render layout:
 *   [Ingest] → [Classify] → [Extract] → [Compile] → [File-Back] | [Lint]
 *                                                     ^divider^
 */
export function HandoffChainRibbon({
  artifact,
  className,
  historicalEvents = [],
  liveEvents = [],
  onStageClick,
  onRunLint,
}: HandoffChainRibbonProps) {
  const { statuses, details, notYetCompiled, legacyCompiled } = buildDisplayData(
    artifact,
    historicalEvents,
    liveEvents,
  );

  const lintStatus   = statuses[LINT_STAGE.id] ?? "pending";
  const lintDetail   = details[LINT_STAGE.id];

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
          {/* Ingest — always complete */}
          <li className="flex items-center">
            <StagePill
              stage={INGEST_STAGE}
              status="completed"
              onClick={onStageClick ? () => onStageClick(INGEST_STAGE.id) : undefined}
            />
            <Connector />
          </li>

          {/* Compile stages */}
          {COMPILE_STAGES.map((stage, idx) => (
            <li key={stage.id} className="flex items-center">
              <StagePill
                stage={stage}
                status={statuses[stage.id] ?? "pending"}
                detail={details[stage.id]}
                onClick={onStageClick ? () => onStageClick(stage.id) : undefined}
              />
              {idx < COMPILE_STAGES.length - 1 && <Connector />}
            </li>
          ))}

          {/* Lint — separate section after divider */}
          <li className="flex items-center" aria-label="Lint stage">
            <SectionDivider />
            <LintPill
              status={lintStatus}
              detail={lintDetail}
              onRunLint={onRunLint}
              onClick={onStageClick ? () => onStageClick(LINT_STAGE.id) : undefined}
            />
          </li>
        </ol>

        {/* Mode labels */}
        {notYetCompiled && (
          <span
            aria-live="polite"
            className="ml-3 text-[10px] font-medium text-muted-foreground/70 italic"
          >
            Not yet compiled
          </span>
        )}
        {legacyCompiled && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-3 cursor-default text-[10px] font-medium text-muted-foreground/50 italic">
                details unavailable
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <span className="text-xs">
                Compiled outside Portal — per-stage event history not recorded
              </span>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
