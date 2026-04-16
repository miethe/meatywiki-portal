/**
 * Workflow Status Surface — Stitch-informed scaffold.
 *
 * Renders the WorkflowStatusPanel (full variant) listing active + recent runs.
 * P3-07 wires:
 *   - GET /api/workflows (run list — SSE or polling)
 *   - SSE multiplexing per active run (P3-08)
 *   - WorkflowStatusBadge on produced-artifact chips
 *
 * Stitch reference: "Workflows Dashboard" (ID: 4f203d7cc78b4229b71c017c15c055cb)
 * Shell: Standard Archival or Compact (per audit §3.2 row 10)
 */

import { WorkflowStatusPanel } from "@/components/workflow/workflow-status-panel";
import type { WorkflowRun } from "@/types/artifact";

// Placeholder runs — replaced by API call in P3-07
const PLACEHOLDER_RUNS: WorkflowRun[] = [
  {
    id: "wf-ingest-20260416-001",
    template_id: "source_ingest_v1",
    workspace: "inbox",
    status: "running",
    current_stage: 1,
    started_at: new Date(Date.now() - 45_000).toISOString(),
    initiator: "portal",
  },
  {
    id: "wf-compile-20260416-001",
    template_id: "compile_v1",
    workspace: "library",
    status: "complete",
    current_stage: 3,
    started_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    completed_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    initiator: "cli",
  },
  {
    id: "wf-lint-20260415-003",
    template_id: "lint_scope_v1",
    workspace: "library",
    status: "failed",
    current_stage: 1,
    started_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    initiator: "portal",
  },
];

export default function WorkflowsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Active and recent workflow runs
        </p>
      </div>

      <WorkflowStatusPanel runs={PLACEHOLDER_RUNS} variant="full" />
    </div>
  );
}
