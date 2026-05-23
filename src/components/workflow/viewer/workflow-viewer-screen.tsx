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
import { WorkflowStatusBadge } from "@/components/ui/workflow-status-badge";
import { useWorkflowRun } from "@/hooks/useWorkflowRun";
import { useWorkflowTimeline } from "@/hooks/useWorkflowTimeline";
import { useRunHistory } from "@/hooks/useRunHistory";
import { TimelinePanel } from "./timeline-panel";
import { StageContextPanel } from "./stage-context-panel";
import { ArtifactLineageGraph } from "./artifact-lineage-graph";
import { RunHistoryList } from "./run-history-list";
import { OperatorActionsBlock } from "./operator-actions-block";
import { AuditLogPanel } from "./audit-log-panel";
import type { ArtifactRef, WorkflowRun } from "@/types/artifact";
import type { WorkflowEvent } from "@/types/workflow-viewer";

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

function outputSource(event: WorkflowEvent): string {
  return event.stage
    ? `${event.stage.replace(/_/g, " ")} (${event.event_type.replace(/_/g, " ")})`
    : event.event_type.replace(/_/g, " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatOutputValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

interface CreatedArtifactOutput {
  id: string;
  title: string | null;
  source: string;
}

interface OutputDetail {
  key: string;
  label: string;
  value: string;
}

interface WorkflowOutputs {
  artifacts: CreatedArtifactOutput[];
  details: OutputDetail[];
}

function addArtifactOutput(
  artifacts: CreatedArtifactOutput[],
  seen: Set<string>,
  id: string,
  title: string | null | undefined,
  source: string,
): void {
  if (seen.has(id)) return;
  seen.add(id);
  artifacts.push({
    id,
    title: title?.trim() || null,
    source,
  });
}

function isArtifactIdKey(key: string): boolean {
  return key === "artifact_id" || key === "artifactId" || key.endsWith("_artifact_id");
}

function isArtifactIdsKey(key: string): boolean {
  return key === "artifact_ids" || key === "artifactIds" || key.endsWith("_artifact_ids");
}

function collectArtifactOutputs(
  value: unknown,
  artifacts: CreatedArtifactOutput[],
  seen: Set<string>,
  source: string,
  depth = 0,
): void {
  if (depth > 4) return;

  if (Array.isArray(value)) {
    value.forEach((item) =>
      collectArtifactOutputs(item, artifacts, seen, source, depth + 1),
    );
    return;
  }

  if (!isRecord(value)) return;

  for (const [key, directValue] of Object.entries(value)) {
    const titleValue =
      value[`${key.replace(/_artifact_ids?$/, "")}_artifact_title`] ??
      value["artifact_title"] ??
      value["artifactTitle"] ??
      value["title"] ??
      value["name"];

    if (isArtifactIdKey(key) && typeof directValue === "string" && directValue.trim()) {
      addArtifactOutput(
        artifacts,
        seen,
        directValue,
        typeof titleValue === "string" ? titleValue : null,
        source,
      );
    }

    if (isArtifactIdsKey(key) && Array.isArray(directValue)) {
      directValue
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        .forEach((id) => addArtifactOutput(artifacts, seen, id, null, source));
    }
  }

  Object.entries(value).forEach(([key, nested]) => {
    if (key === "inputs") return;
    collectArtifactOutputs(nested, artifacts, seen, source, depth + 1);
  });
}

function aggregateWorkflowOutputs(events: WorkflowEvent[]): WorkflowOutputs {
  const artifacts: CreatedArtifactOutput[] = [];
  const details: OutputDetail[] = [];
  const seenArtifacts = new Set<string>();

  events.forEach((event) => {
    const payload = event.event_payload;
    if (!payload) return;

    const source = outputSource(event);
    collectArtifactOutputs(payload, artifacts, seenArtifacts, source);

    (["outputs", "output_summary"] as const).forEach((field) => {
      const value = payload[field];
      if (value === undefined || value === null) return;
      details.push({
        key: `${event.id}-${field}`,
        label: `${source} ${field.replace("_", " ")}`,
        value: formatOutputValue(value),
      });
    });
  });

  return { artifacts, details };
}

function titleFromRef(ref: ArtifactRef | null): string | null {
  const title = ref?.title?.trim();
  return title && title.length > 0 ? title : null;
}

function primarySourceArtifact(run: WorkflowRun): ArtifactRef | null {
  const source = run.source_artifacts?.[0];
  if (source && (source.artifact_id.trim() || source.title?.trim())) return source;
  if (run.artifact_id || run.artifact_title) {
    return {
      artifact_id: run.artifact_id ?? "",
      title: run.artifact_title ?? null,
    };
  }
  return null;
}

function createdArtifactsFromRun(run: WorkflowRun | null): CreatedArtifactOutput[] {
  const artifacts: CreatedArtifactOutput[] = [];
  const seen = new Set<string>();

  run?.created_artifacts?.forEach((artifact) => {
    const id = artifact.artifact_id.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    artifacts.push({
      id,
      title: titleFromRef(artifact),
      source: "workflow run",
    });
  });

  return artifacts;
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
  const sourceArtifact = run ? primarySourceArtifact(run) : null;
  const sourceTitle = titleFromRef(sourceArtifact);
  const sourceId = sourceArtifact?.artifact_id.trim();

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

        <div className="mt-3 rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
            Source artifact
          </p>
          {sourceId && sourceTitle ? (
            <div className="mt-1 flex flex-col gap-2">
              <Link
                href={`/artifact/${sourceId}`}
                className="text-sm font-medium text-primary hover:text-primary/80 hover:underline underline-offset-2"
              >
                {sourceTitle}
              </Link>
              <span className="font-mono text-xs text-muted-foreground">{sourceId}</span>
            </div>
          ) : sourceTitle ? (
            <p className="mt-1 text-sm font-medium text-foreground">{sourceTitle}</p>
          ) : (
            <p className="mt-1 text-sm font-medium text-foreground">
              No linked source artifact
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface WorkflowOutputsPanelProps {
  events: WorkflowEvent[];
  currentRun: WorkflowRun | null;
}

function WorkflowOutputsPanel({ events, currentRun }: WorkflowOutputsPanelProps) {
  const eventOutputs = useMemo(() => aggregateWorkflowOutputs(events), [events]);
  const runArtifacts = useMemo(
    () => createdArtifactsFromRun(currentRun),
    [currentRun],
  );
  const outputs = useMemo(
    () => ({
      artifacts: runArtifacts.length > 0 ? runArtifacts : eventOutputs.artifacts,
      details: eventOutputs.details,
    }),
    [eventOutputs, runArtifacts],
  );

  return (
    <section
      className="rounded-xl border border-border bg-card p-6"
      aria-labelledby="workflow-outputs-heading"
      data-testid="workflow-outputs-panel"
    >
      <h2 id="workflow-outputs-heading" className="text-sm font-semibold text-foreground">
        Outputs
      </h2>

      {outputs.artifacts.length === 0 && outputs.details.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No workflow outputs recorded yet.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          {outputs.artifacts.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground">
                Created artifacts
              </h3>
              <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                {outputs.artifacts.map((artifact) => (
                  <li key={artifact.id} className="flex flex-col gap-1 px-3 py-2">
                    {artifact.title ? (
                      <Link
                        href={`/artifact/${artifact.id}`}
                        className="text-sm font-medium text-foreground hover:text-primary hover:underline underline-offset-2"
                      >
                        {artifact.title}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-foreground">
                        Untitled artifact
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {artifact.id}
                    </span>
                    <span className="text-[11px] capitalize text-muted-foreground">
                      {artifact.source}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {outputs.details.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground">
                Output details
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {outputs.details.map((detail) => (
                  <li key={detail.key} className="rounded-md border border-border p-3">
                    <p className="text-xs font-medium capitalize text-foreground">
                      {detail.label}
                    </p>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-[11px] text-muted-foreground">
                      {detail.value}
                    </pre>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
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

  const { run: fetchedRun, refetch: refetchRun } = useWorkflowRun(runId);
  const { events, stages, isLoading, error, refetch: refetchTimeline } = useWorkflowTimeline(runId);

  // Derive templateId from either the pre-fetched run or the first event's run metadata.
  const templateId = useMemo<string | null>(() => {
    if (fetchedRun?.template_id) return fetchedRun.template_id;
    if (run?.template_id) return run.template_id;
    // Fallback — timeline events don't carry template_id, so default to research_synthesis_v1
    // for run history (the primary use-case in v1).
    return events.length > 0 ? "research_synthesis_v1" : null;
  }, [fetchedRun, run, events]);

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
    if (fetchedRun) return fetchedRun;
    if (run) return run;
    return historyRuns.find((r) => r.id === runId) ?? null;
  }, [fetchedRun, run, historyRuns, runId]);

  // Called after any operator action succeeds — refresh timeline, history and audit log.
  const handleOperatorAction = useCallback(() => {
    setRefreshKey((k) => k + 1);
    void refetchRun();
    void refetchTimeline();
    void refetchHistory();
  }, [refetchRun, refetchTimeline, refetchHistory]);

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
          {/* Panel E: Operator actions — only rendered when run is actionable */}
          {currentRun && (
            <div data-tour="workflow-operator-actions">
            <OperatorActionsBlock
              runId={runId}
              status={currentRun.status}
              onAction={handleOperatorAction}
              data-testid="operator-actions-block"
            />
            </div>
          )}

          {/* Panel A: Timeline */}
          <div
            className="rounded-xl border border-border bg-card p-6"
            data-testid="timeline-panel-container"
            data-tour="workflow-timeline"
          >
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Stage Timeline
            </h2>
            <div data-tour="workflow-stage-tracker">
            <TimelinePanel
              stages={stages}
              selectedStageName={selectedStageName}
              onSelectStage={setSelectedStageName}
              isLoading={isLoading}
              error={error}
            />
            </div>
          </div>

          {/* Panel B: Stage context — appears when a stage is selected */}
          <div data-tour="workflow-stage-details">
          <StageContextPanel
            stage={selectedStage}
            data-testid="stage-context-panel"
          />
          </div>

          <WorkflowOutputsPanel events={events} currentRun={currentRun} />

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
