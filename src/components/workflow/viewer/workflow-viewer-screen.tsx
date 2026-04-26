"use client";

/**
 * WorkflowViewerScreen — Screen B: 4-panel workflow detail view (P1.5-2-02).
 *
 * Panels:
 *   A) TimelinePanel        — horizontal stage timeline, click to select
 *   B) StageContextPanel    — inputs / outputs / artifact lineage for selected stage
 *   C) ArtifactLineageGraph — SVG DAG of produced artifact nodes + edges
 *   D) RunHistoryList       — previous runs + re-run button
 *   E) OperatorActionsBlock — pause / resume / cancel (P7-03, shown above timeline)
 *   F) AuditLogPanel        — compact operator audit log (P7-03, below lineage)
 *
 * Layout (2-column on lg+):
 *   Left col (lg:col-span-9): [E] + [A] + [B] + [C] + [F] stacked
 *   Right rail (lg:col-span-3): [D]
 *
 * Data:
 *   - useWorkflowTimeline(runId) → events + derived stages
 *   - useRunHistory(templateId)  → run history + re-run
 *
 * Accessibility:
 *   - Keyboard navigation on timeline (tab + Enter/Space to select stage)
 *   - ARIA labels on all panels
 *   - Focus management: panel headings are section landmarks
 *
 * Design reference: workflow-viewer-screen-b.html (Stitch export),
 * adapted to shadcn/ui + Tailwind. Visual hierarchy matches the Stitch
 * layout (top timeline, left-heavy main content, right artifact chain).
 * Deviation: lineage graph uses SVG instead of the Stitch mermaid-style
 * diagram (no external mermaid dep to keep bundle ≤80 KB gz).
 *
 * Traces FR-1.5-07.
 */

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { OPERATOR_CONTROL_ENABLED } from "@/lib/env";
import { WorkflowStatusBadge } from "@/components/ui/workflow-status-badge";
import { useWorkflowTimeline } from "@/hooks/useWorkflowTimeline";
import { useRunHistory } from "@/hooks/useRunHistory";
import { TimelinePanel } from "./timeline-panel";
import { StageContextPanel } from "./stage-context-panel";
import { ArtifactLineageGraph } from "./artifact-lineage-graph";
import { RunHistoryList } from "./run-history-list";
import { OperatorActionsBlock } from "./operator-actions-block";
import { AuditLogPanel } from "./audit-log-panel";
import type { WorkflowRun } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Template label
// ---------------------------------------------------------------------------

const TEMPLATE_LABELS: Record<string, string> = {
  source_ingest_v1: "Source Ingest",
  research_synthesis_v1: "Research Synthesis",
  lint_scope_v1: "Lint Scope",
  compile_v1: "Full Compile",
};

function templateLabel(id: string): string {
  return TEMPLATE_LABELS[id] ?? id;
}

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Back chevron
// ---------------------------------------------------------------------------

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Run header
// ---------------------------------------------------------------------------

interface RunHeaderProps {
  run: WorkflowRun | null;
  runId: string;
}

function RunHeader({ run, runId }: RunHeaderProps) {
  const label = run ? templateLabel(run.template_id) : "Workflow Run";

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      {/* Back + title */}
      <div className="space-y-2">
        <Link
          href="/workflows"
          aria-label="Back to workflows list"
          className={cn(
            "inline-flex items-center gap-1.5 text-sm text-muted-foreground",
            "hover:text-foreground transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded",
          )}
        >
          <BackIcon />
          Workflows
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          {run && <WorkflowStatusBadge status={run.status} />}
          <span className="text-xs text-muted-foreground">
            Started: {relativeTime(run?.started_at)}
          </span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {label}
        </h1>

        <p className="font-mono text-xs text-muted-foreground">
          {runId}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

interface WorkflowViewerScreenProps {
  runId: string;
  /** Pre-fetched run metadata, if available (passed from the page for SSR). */
  run?: WorkflowRun | null;
}

export function WorkflowViewerScreen({ runId, run = null }: WorkflowViewerScreenProps) {
  const [selectedStageName, setSelectedStageName] = useState<string | null>(null);
  // Incrementing this key triggers a refetch of the audit log and timeline
  // after any operator action completes.
  const [refreshKey, setRefreshKey] = useState(0);

  const { events, stages, isLoading, error, refetch: refetchTimeline } = useWorkflowTimeline(runId);

  // Derive templateId from either the pre-fetched run or the first event's run metadata.
  const templateId = useMemo<string | null>(() => {
    if (run?.template_id) return run.template_id;
    // Fallback — timeline events don't carry template_id, so default to research_synthesis_v1
    // for run history (the primary use-case in v1).
    return events.length > 0 ? "research_synthesis_v1" : null;
  }, [run, events]);

  const {
    runs: historyRuns,
    isLoading: historyLoading,
    isReRunning,
    error: historyError,
    reRunError,
    reRun,
    refetch: refetchHistory,
  } = useRunHistory(templateId);

  // Resolve the selected stage object.
  const selectedStage = useMemo(
    () => stages.find((s) => s.name === selectedStageName) ?? null,
    [stages, selectedStageName],
  );

  // Synthesise a WorkflowRun-like object for the header if not pre-fetched.
  // Use the best available run from history that matches this runId.
  const currentRun: WorkflowRun | null = useMemo(() => {
    if (run) return run;
    return historyRuns.find((r) => r.id === runId) ?? null;
  }, [run, historyRuns, runId]);

  // Called after any operator action succeeds — refresh timeline, history and audit log.
  const handleOperatorAction = useCallback(() => {
    setRefreshKey((k) => k + 1);
    void refetchTimeline();
    void refetchHistory();
  }, [refetchTimeline, refetchHistory]);

  return (
    <div className="flex flex-col gap-8" data-testid="workflow-viewer-screen">
      {/* Page header */}
      <RunHeader run={currentRun} runId={runId} />

      {/* Main grid */}
      <div
        className="grid grid-cols-12 gap-6 lg:gap-8"
        data-testid="viewer-grid"
      >
        {/* Left column — operator actions + timeline + context + lineage + audit log */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-6">
          {/* Panel E: Operator actions — only rendered when feature flag is on AND run is actionable */}
          {OPERATOR_CONTROL_ENABLED && currentRun && (
            <OperatorActionsBlock
              runId={runId}
              status={currentRun.status}
              onAction={handleOperatorAction}
              data-testid="operator-actions-block"
            />
          )}

          {/* Panel A: Timeline */}
          <div
            className="rounded-xl border border-border bg-card p-6"
            data-testid="timeline-panel-container"
          >
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Stage Timeline
            </h2>
            <TimelinePanel
              stages={stages}
              selectedStageName={selectedStageName}
              onSelectStage={setSelectedStageName}
              isLoading={isLoading}
              error={error}
            />
          </div>

          {/* Panel B: Stage context — appears when a stage is selected */}
          <StageContextPanel
            stage={selectedStage}
            data-testid="stage-context-panel"
          />

          {/* Panel C: Artifact lineage graph */}
          <ArtifactLineageGraph
            stages={stages}
            data-testid="artifact-lineage-graph"
          />

          {/* Panel F: Audit log — only rendered when entries exist */}
          <AuditLogPanel
            runId={runId}
            refreshKey={refreshKey}
          />
        </div>

        {/* Right rail — run history */}
        <div className="col-span-12 lg:col-span-3">
          <RunHistoryList
            runs={historyRuns}
            currentRunId={runId}
            isLoading={historyLoading}
            isReRunning={isReRunning}
            error={historyError}
            reRunError={reRunError}
            onReRun={reRun}
            data-testid="run-history-list"
          />
        </div>
      </div>
    </div>
  );
}
