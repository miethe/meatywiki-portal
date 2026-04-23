"use client";

/**
 * ActiveWorkflowCard — card for a single active (pending/running) workflow run.
 *
 * Shows: workflow template name, workspace badge, lens badge (fidelity from run
 * metadata if available), stage progress (StageTracker compact), and a
 * "View Details" link to the run detail page.
 *
 * Stitch reference: §4.6 Active Workflows section.
 * Task: P6-02 (portal-v1.5-stitch-reskin)
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { WorkflowStatusBadge } from "@/components/ui/workflow-status-badge";
import { StageTracker } from "./stage-tracker";
import type { WorkflowRun } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Template label map (matches WorkflowStatusPanel)
// ---------------------------------------------------------------------------

const TEMPLATE_LABELS: Record<string, string> = {
  source_ingest_v1: "Source Ingest",
  research_synthesis_v1: "Research Synthesis",
  lint_scope_v1: "Lint Scope",
  compile_v1: "Full Compile",
};

function templateLabel(templateId: string): string {
  return TEMPLATE_LABELS[templateId] ?? templateId;
}

// ---------------------------------------------------------------------------
// Stage description helper
// ---------------------------------------------------------------------------

const STAGE_DESCRIPTIONS: Record<number, string> = {
  0: "Initializing",
  1: "Ingesting source",
  2: "Contextual mapping",
  3: "Extracting knowledge",
  4: "Compiling artifacts",
  5: "Linting + filing back",
};

function stageDescription(stage: number | null | undefined): string {
  if (stage == null) return "Pending";
  return STAGE_DESCRIPTIONS[stage] ?? `Step ${stage + 1}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ActiveWorkflowCardProps {
  run: WorkflowRun;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActiveWorkflowCard({ run, className }: ActiveWorkflowCardProps) {
  const label = templateLabel(run.template_id);
  const stageCopy = stageDescription(run.current_stage);

  return (
    <article
      aria-label={`Active workflow: ${label}`}
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm",
        "min-w-[220px]",
        className,
      )}
    >
      {/* Header: name + status badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground capitalize">
            {run.workspace}
          </p>
        </div>
        <WorkflowStatusBadge status={run.status} className="shrink-0" />
      </div>

      {/* Stage description */}
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{stageCopy}</span>
      </p>

      {/* Stage tracker */}
      <StageTracker
        runId={run.id}
        templateId={run.template_id}
        status={run.status}
        currentStage={run.current_stage}
        variant="compact"
        className="w-full"
      />

      {/* Footer: run ID + view details link */}
      <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <span className="font-mono text-[10px] text-muted-foreground/60">
          {run.id.slice(-6)}
        </span>
        <Link
          href={`/workflows/${run.id}`}
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-medium text-primary",
            "hover:text-primary/80 underline-offset-2 hover:underline transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
          )}
          aria-label={`View details for workflow run ${run.id}`}
        >
          View Details
        </Link>
      </div>
    </article>
  );
}
