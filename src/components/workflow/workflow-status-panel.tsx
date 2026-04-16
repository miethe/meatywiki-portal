"use client";

/**
 * WorkflowStatusPanel — sidebar/panel showing active and recent workflow runs.
 *
 * Scaffold for the Workflow Status Surface (/workflows route, P3-07).
 * Used as a compact widget in Inbox and Dashboard; as a full panel at /workflows.
 *
 * P3-07 wires GET /api/workflows/:run_id data; this scaffold defines the
 * component hierarchy and props shape that P3-07 will fill.
 *
 * Stitch reference: "Workflows Dashboard" screen (ID: 4f203d7cc78b4229b71c017c15c055cb).
 * Design spec §7 (workflow status surface), §3.2 (per-screen: row 10).
 */

import { cn } from "@/lib/utils";
import type { WorkflowRun } from "@/types/artifact";
import { WorkflowStatusBadge } from "@/components/ui/workflow-status-badge";
import { StageTracker } from "./stage-tracker";

// ---------------------------------------------------------------------------
// Single run row
// ---------------------------------------------------------------------------

interface WorkflowRunRowProps {
  run: WorkflowRun;
  className?: string;
}

function WorkflowRunRow({ run, className }: WorkflowRunRowProps) {
  const isActive = run.status === "pending" || run.status === "running";
  const templateLabel =
    {
      source_ingest_v1: "Source Ingest",
      research_synthesis_v1: "Research Synthesis",
      lint_scope_v1: "Lint Scope",
      compile_v1: "Full Compile",
    }[run.template_id] ?? run.template_id;

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-md border p-3",
        isActive && "border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20",
        className,
      )}
      aria-label={`Workflow run: ${templateLabel}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{templateLabel}</span>
        <WorkflowStatusBadge status={run.status} />
      </div>

      <div className="text-[11px] text-muted-foreground">
        <span>Initiated by {run.initiator}</span>
        {run.started_at && (
          <span className="ml-2">
            {new Date(run.started_at).toLocaleTimeString()}
          </span>
        )}
      </div>

      {isActive && (
        <StageTracker
          runId={run.id}
          templateId={run.template_id}
          status={run.status}
          currentStage={run.current_stage}
          variant="compact"
          mode="static"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

interface WorkflowStatusPanelProps {
  runs?: WorkflowRun[];
  /** "full" — /workflows page; "compact" — sidebar widget */
  variant?: "full" | "compact";
  className?: string;
}

export function WorkflowStatusPanel({
  runs = [],
  variant = "compact",
  className,
}: WorkflowStatusPanelProps) {
  const activeRuns = runs.filter(
    (r) => r.status === "pending" || r.status === "running",
  );
  const recentRuns = runs.filter(
    (r) => r.status !== "pending" && r.status !== "running",
  );

  return (
    <section
      aria-label="Workflow status"
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex items-center justify-between">
        <h2
          className={cn(
            "font-semibold",
            variant === "full" ? "text-base" : "text-sm",
          )}
        >
          Workflows
        </h2>
        {runs.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {activeRuns.length} active
          </span>
        )}
      </div>

      {runs.length === 0 && (
        <p className="text-sm text-muted-foreground">No recent runs.</p>
      )}

      {activeRuns.length > 0 && (
        <div className="flex flex-col gap-2">
          {variant === "full" && (
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Active
            </h3>
          )}
          {activeRuns.map((run) => (
            <WorkflowRunRow key={run.id} run={run} />
          ))}
        </div>
      )}

      {variant === "full" && recentRuns.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent
          </h3>
          {recentRuns.slice(0, 10).map((run) => (
            <WorkflowRunRow key={run.id} run={run} />
          ))}
        </div>
      )}
    </section>
  );
}
