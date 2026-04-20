/**
 * Workflow Viewer API — typed wrappers for Screen B endpoints.
 *
 * Endpoints:
 *   GET  /api/workflows/:run_id/timeline  — all events for a run (WorkflowEventDTO[])
 *   GET  /api/workflows/runs?template_id= — run history for a template
 *   POST /api/workflows                   — re-run (enqueue)
 *
 * Backend: meatywiki/portal/api/workflows.py (P1.5-2-01).
 * DTO shapes: meatywiki/portal/services/workflow_query.py (WorkflowEventDTO, WorkflowRunDTO).
 *
 * FR-1.5-07 / FR-1.5-08.
 */

import { apiFetch } from "./client";
import type { WorkflowRun, ServiceModeEnvelope } from "@/types/artifact";
import type { WorkflowEvent } from "@/types/workflow-viewer";

// ---------------------------------------------------------------------------
// Timeline — GET /api/workflows/:run_id/timeline
// ---------------------------------------------------------------------------

/**
 * Fetch all events for a workflow run, ordered by created_at ASC.
 * Returns a ServiceModeEnvelope<WorkflowEvent> array.
 */
export async function fetchWorkflowTimeline(
  runId: string,
): Promise<WorkflowEvent[]> {
  const envelope = await apiFetch<ServiceModeEnvelope<WorkflowEvent>>(
    `/workflows/${encodeURIComponent(runId)}/timeline`,
  );
  return envelope.data ?? [];
}

// ---------------------------------------------------------------------------
// Single run — GET /api/workflows/runs?run_id=
// (Fetch the run detail by listing and filtering client-side, since the
//  backend list endpoint is the canonical read path in v1.)
// ---------------------------------------------------------------------------

export async function fetchWorkflowRun(runId: string): Promise<WorkflowRun | null> {
  try {
    const envelope = await apiFetch<ServiceModeEnvelope<WorkflowRun>>(
      `/workflows/runs?limit=1`,
    );
    // The list endpoint returns all runs; find the matching one.
    // In practice, callers pass the runId from the URL and we match it.
    const runs = envelope.data ?? [];
    return runs.find((r) => r.id === runId) ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Run history — GET /api/workflows/runs?template_id=X
// ---------------------------------------------------------------------------

export interface RunHistoryParams {
  template_id: string;
  limit?: number;
  cursor?: string | null;
}

export async function fetchRunHistory(
  params: RunHistoryParams,
): Promise<ServiceModeEnvelope<WorkflowRun>> {
  const { template_id, limit = 20, cursor } = params;
  const query = new URLSearchParams({ template_id, limit: String(limit) });
  if (cursor) query.set("cursor", cursor);

  return apiFetch<ServiceModeEnvelope<WorkflowRun>>(
    `/workflows/runs?${query.toString()}`,
  );
}

// ---------------------------------------------------------------------------
// Re-run — POST /api/workflows/synthesize (research_synthesis_v1)
// For other templates this would need a different endpoint; in v1 we only
// support re-running synthesis runs.
// ---------------------------------------------------------------------------

export interface ReRunAccepted {
  run_id: string;
  status: "queued";
  created_at: string;
}

export async function reRunWorkflow(templateId: string): Promise<ReRunAccepted> {
  return apiFetch<ReRunAccepted>("/workflows/synthesize", {
    method: "POST",
    body: JSON.stringify({
      template_id: templateId,
      sources: [],
    }),
  });
}
