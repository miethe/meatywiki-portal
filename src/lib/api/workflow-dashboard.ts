/**
 * Workflow Dashboard API — GET /api/workflows/dashboard
 *
 * Returns a single aggregated snapshot: in-progress queue, recent completed
 * runs, computed metrics, and available filter options.
 *
 * Also wraps POST /api/workflows/runs/bulk-action for cancel/retry operations.
 *
 * Backend: meatywiki/portal/api/workflows.py (P2-4 scope).
 */

import { apiFetch } from "./client";
import type { WorkflowRun, WorkflowRunStatus } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Dashboard response types
// ---------------------------------------------------------------------------

export interface DashboardMetrics {
  success_rate: number;       // 0–100 percent, 1 decimal
  p95_latency_ms: number | null;
  queue_depth: number;
  total_runs_7d: number;
  failed_runs_7d: number;
}

export interface AvailableFilters {
  templates: Array<{ id: string; label: string }>;
  statuses: WorkflowRunStatus[];
}

export interface WorkflowDashboardResponse {
  in_progress_queue: WorkflowRun[];
  recent_completed: WorkflowRun[];
  metrics: DashboardMetrics;
  available_filters: AvailableFilters;
}

// ---------------------------------------------------------------------------
// Bulk action types
// ---------------------------------------------------------------------------

export type BulkAction = "cancel" | "retry";

export interface BulkActionRequest {
  action: BulkAction;
  run_ids: string[];
  reason?: string;
}

export interface BulkActionResult {
  processed: string[];
  failed: Array<{ run_id: string; error: string }>;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function fetchWorkflowDashboard(): Promise<WorkflowDashboardResponse> {
  return apiFetch<WorkflowDashboardResponse>("/workflows/dashboard");
}

export async function postBulkAction(
  req: BulkActionRequest,
): Promise<BulkActionResult> {
  return apiFetch<BulkActionResult>("/workflows/runs/bulk-action", {
    method: "POST",
    body: JSON.stringify(req),
  });
}
